// ═══════════════════════════════════════════════════════════
//  DROP
// ═══════════════════════════════════════════════════════════
function dropBall() {
  if (gameOver || cashedOut || dropCooldown > 0) return;
  playSwoosh();
  const r  = TIERS[nextTier - 1].radius;
  const cx = Math.max(CX - cW * 0.50 + r, Math.min(CX + cW * 0.50 - r, aimX));
  createBall(cx, dropZoneY - r, nextTier);
  dropCooldown  = COOLDOWN;
  nextTier      = nextNextTier;
  nextNextTier  = randDropTier();
  seenTiers.add(nextNextTier);
}

// ═══════════════════════════════════════════════════════════
//  ABILITIES
// ═══════════════════════════════════════════════════════════
function useAbility(key) {
  const ab = AB[key];
  if (ab.uses <= 0) return;
  if (ab.cooldown > 0) return;
  if (key === 'walls' && wallAbilityOn) return;
  if (gameOver || cashedOut) return;

  ab.uses--;

  if (key === 'swap') {
    playSwapSound();
    nextTier = randDropTier();
    ab.cooldown = 40;            // 120Hz basis (~0.33 s)

  } else if (key === 'earthquake') {
    playQuakeSound();
    ab.cooldown  = 1200;         // 10 s
    quakeActive  = true;
    quakeTimer   = 960;          // 8 s
    quakePulse   = 0;

  } else if (key === 'walls') {
    playWallsSound();
    wallAbilityOn    = true;
    wallAbilityTimer = 2880;     // 24 s
    ab.cooldown      = 2880;
    // Extend the container upward — two vertical extensions on top of
    // the existing angled walls. Interior side matches the parent wall.
    const extH = wallH * 0.44;
    const eLX  = lWallX - Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eLY  = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eRX  = rWallX + Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eRY  = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    extraWalls.push(makeWall(eLX, eLY, wallThick, extH, -wallAngle, 'right'));
    extraWalls.push(makeWall(eRX, eRY, wallThick, extH,  wallAngle, 'left'));
    // Any ball whose centroid lies within the extra-wall AABB gets pinned.
    // All its particles become invMass = 0 (static) until the wall expires.
    wallStuckBalls = [];
    balls.forEach(function(ball) {
      if (ball.merging || ball.spawning) return;
      const c = blobCentroid(ball);
      extraWalls.forEach(function(wall) {
        // Build AABB from the wall rectangle (cx, cy, w, h, angle).
        const ca = Math.cos(wall.angle), sa = Math.sin(wall.angle);
        const hw = wall.w / 2, hh = wall.h / 2;
        const corners = [
          { x: wall.cx + (-hw) * ca - (-hh) * sa, y: wall.cy + (-hw) * sa + (-hh) * ca },
          { x: wall.cx + ( hw) * ca - (-hh) * sa, y: wall.cy + ( hw) * sa + (-hh) * ca },
          { x: wall.cx + ( hw) * ca - ( hh) * sa, y: wall.cy + ( hw) * sa + ( hh) * ca },
          { x: wall.cx + (-hw) * ca - ( hh) * sa, y: wall.cy + (-hw) * sa + ( hh) * ca },
        ];
        let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
        for (const k of corners) {
          if (k.x < mnx) mnx = k.x; if (k.x > mxx) mxx = k.x;
          if (k.y < mny) mny = k.y; if (k.y > mxy) mxy = k.y;
        }
        if (c.x >= mnx - ball.r && c.x <= mxx + ball.r &&
            c.y >= mny - ball.r && c.y <= mxy + ball.r) {
          if (!ball.isWallStuck) {
            for (let i = 0; i < ball.particles.length; i++) ball.particles[i].invMass = 0;
            ball.isWallStuck = true;
            wallStuckBalls.push(ball);
          }
        }
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  LOSE CHECK
//
//  Two ways to lose:
//   (1) safety: a ball fell through the floor (shouldn't happen
//       normally, but catches runaway state);
//   (2) Suika-style: a ball has come to rest with its TOP above the
//       container rim. To avoid false-positives during a bounce, a
//       ball only "counts" once it's been continuously above the rim
//       AND slow enough for a short grace period.
// ═══════════════════════════════════════════════════════════
const LOSE_LINE_Y   = cTop + 4;   // top of container (ball top must clear this)
const LOSE_GRACE    = 60;         // ticks of sustained overflow before game over
const LOSE_MAX_SPEED = 1.2;       // px/tick — "at rest" threshold
function checkLose() {
  if (gameOver || cashedOut) return;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.merging || b.spawning || b.dyingAnim) continue;
    const c = blobCentroid(b);

    // (1) safety — fell through floor
    if (c.y > cBottom + 60) { _startLose(b, c); return; }

    // (2) settled overflow — ball's top (c.y - r) sits above LOSE_LINE_Y
    //      AND its speed is below LOSE_MAX_SPEED for LOSE_GRACE frames.
    const speed = b._speed || 0;
    const topY  = c.y - b.r;
    if (topY < LOSE_LINE_Y && speed < LOSE_MAX_SPEED) {
      b._overflowTicks = (b._overflowTicks || 0) + 1;
      if (b._overflowTicks >= LOSE_GRACE) { _startLose(b, c); return; }
    } else {
      b._overflowTicks = 0;
    }
  }
}

function _startLose(b, c) {
  if (loseBean) return;
  loseBean = b;
  b.dyingAnim  = true;
  b.dyingTick  = 0;
  b.dyingFromX = c.x;
  b.dyingFromY = Math.min(c.y, H + b.r);
  physicsEnabled = false;
  gameOver = true;
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════
function restart() {
  balls = [];
  extraWalls.length = 0;
  wallAbilityOn = false; wallAbilityTimer = 0;
  wallStuckBalls = [];
  score = 0; gameOver = false; cashedOut = false;
  seenTiers = new Set([1,2,3,4]);
  dropCooldown = 120;  // 1s startup grace at 120Hz ticks
  nextTier = randDropTier();
  nextNextTier = randDropTier();
  aimX = CX;
  physicsEnabled = true;
  comboCount = 0; comboTimer = 0; comboLabel = ''; shakeFrames = 0;
  popups = []; sparks = [];
  AB.swap.uses = 3;       AB.swap.cooldown = 0;
  AB.earthquake.uses = 3; AB.earthquake.cooldown = 0;
  AB.walls.uses = 3;      AB.walls.cooldown = 0;
  quakeActive = false; quakeTimer = 0; quakePulse = 0;
  hasTieDye = false; hasPlanet = false;
  bgSands = 0; bgDark = 0; sandDust = null;
  loseBean = null;
}

// ═══════════════════════════════════════════════════════════
//  GAME FLOW
// ═══════════════════════════════════════════════════════════
function startGame() {
  showScreen(null);
  gameActive = true;
  gameOver   = false;
  cashedOut  = false;
  restart();
  gameSession = null;
}

function playAgain() {
  startGame();
}
