// ═══════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  if (id) document.getElementById('screen-' + id).classList.add('active');
}

// ═══════════════════════════════════════════════════════════
//  SUBMIT SCREEN
// ═══════════════════════════════════════════════════════════
function openSubmit() {
  document.querySelector('#screen-submit h2').textContent = cashedOut ? 'Cashed Out!' : 'Game Over';
  document.getElementById('final-score').textContent = score.toLocaleString();
  document.getElementById('name-err').textContent = '';
  document.getElementById('submit-name').value = playerName || '';
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('submit-btn').textContent = 'Submit Score';
  updateCharCount();
  showScreen('submit');
  // Always fetch a fresh session here — the one from startGame() may have expired
  // if the player spent a long time in game
  gameSession = null;
  fetch(WORKER_URL + '/session')
    .then(function(r) { return r.json(); })
    .then(function(s) { gameSession = s; })
    .catch(function() { gameSession = null; });
}

function updateCharCount() {
  var v = document.getElementById('submit-name').value;
  document.getElementById('char-count').textContent = v.length + ' / 20';
}

async function submitScore() {
  const nameEl  = document.getElementById('submit-name');
  const errEl   = document.getElementById('name-err');
  const btn     = document.getElementById('submit-btn');
  const name    = nameEl.value.trim();

  if (!name)          { errEl.textContent = 'Enter a name first.'; return; }
  if (name.length > 20) { errEl.textContent = 'Max 20 characters.'; return; }

  btn.disabled = true;
  btn.textContent = 'Submitting...';
  errEl.textContent = '';

  if (!gameSession) {
    // Session fetch may still be in-flight (slow connection) — try once more
    try {
      const _sr = await fetch(WORKER_URL + '/session');
      gameSession = await _sr.json();
    } catch(e) { gameSession = null; }
  }
  if (!gameSession) {
    errEl.textContent = 'Could not verify session — check your connection.';
    btn.disabled = false;
    btn.textContent = 'Submit Score';
    return;
  }

  try {
    const res  = await fetch(WORKER_URL + '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce: gameSession.nonce, sig: gameSession.sig, score: score, name: name }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Submission failed.';
      btn.disabled = false;
      btn.textContent = 'Submit Score';
      return;
    }

    // Save identity and update HUD state
    playerName = data.name;
    localStorage.setItem('playerName', playerName);
    myRank = data.rank;
    if (myBest === null || score > myBest) myBest = score;

    // Show rank reveal
    const rank = data.rank;
    const cls  = rank === 1 ? 'rank-r1' : rank === 2 ? 'rank-r2' : rank === 3 ? 'rank-r3' : 'rank-rn';
    document.getElementById('rank-badge').className  = 'rank-badge ' + cls;
    document.getElementById('rank-badge').textContent = '#' + rank;
    document.getElementById('rank-name-disp').textContent  = data.name;
    document.getElementById('rank-score-disp').textContent = 'Score: ' + score.toLocaleString();
    showScreen('rank');

  } catch (e) {
    errEl.textContent = 'Connection error. Try again.';
    btn.disabled = false;
    btn.textContent = 'Submit Score';
  }
}

// ═══════════════════════════════════════════════════════════
//  LEADERBOARD SCREEN
// ═══════════════════════════════════════════════════════════
async function showLeaderboard(fromScreen) {
  document.getElementById('lb-from').value = fromScreen || 'home';
  document.getElementById('lb-list').innerHTML = '<p class="lb-loading">Loading...</p>';
  showScreen('leaderboard');

  try {
    const res   = await fetch(WORKER_URL + '/leaderboard');
    const board = await res.json();
    renderLeaderboard(board);
  } catch (e) {
    document.getElementById('lb-list').innerHTML = '<p class="lb-empty">Could not load — check your connection.</p>';
  }
}

function renderLeaderboard(board) {
  if (!board || board.length === 0) {
    document.getElementById('lb-list').innerHTML = '<p class="lb-empty">No scores yet — be the first!</p>';
    return;
  }
  var html = '';
  board.forEach(function(entry, i) {
    var rank = i + 1;
    var cls  = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : 'rn';
    html += '<div class="lb-row ' + cls + '">'
          + '<span class="lb-rank">#' + rank + '</span>'
          + '<span class="lb-name">'  + escHtml(entry.name)  + '</span>'
          + '<span class="lb-score">' + Number(entry.score).toLocaleString() + '</span>'
          + '<span class="lb-date">'  + (entry.date || '') + '</span>'
          + '</div>';
  });
  document.getElementById('lb-list').innerHTML = html;
}

function lbBack() {
  var from = document.getElementById('lb-from').value;
  showScreen(from === 'rank' ? 'rank' : 'home');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function loadMyStats() {
  if (!playerName) return;
  fetch(WORKER_URL + '/leaderboard')
    .then(function(r) { return r.json(); })
    .then(function(board) {
      var entry = board.find(function(e) { return e.name.toLowerCase() === playerName.toLowerCase(); });
      if (entry) {
        myBest = entry.score;
        myRank = board.indexOf(entry) + 1;
      }
    })
    .catch(function() {});
}

// Show home screen once the screen divs exist in the DOM
window.addEventListener('DOMContentLoaded', function() { showScreen('home'); loadMyStats(); });
