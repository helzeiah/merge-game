// ═══════════════════════════════════════════════════════════
//  DROP — aim clamps to wall centers so the ball can be dropped
//  over either wall and bounce in.
// ═══════════════════════════════════════════════════════════
function dropBall() {
  if (gameOver || cashedOut || dropCooldown > 0) return;
  playSwoosh();
  const r  = TIERS[nextTier - 1].radius;
  const cx = Math.max(lWallX, Math.min(rWallX, aimX));
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
    ab.cooldown = 40;

  } else if (key === 'earthquake') {
    playQuakeSound();
    ab.cooldown  = 1200;
    quakeActive  = true;
    quakeTimer   = 960;
    quakePulse   = 0;

  } else if (key === 'walls') {
    playWallsSound();
    wallAbilityOn    = true;
    wallAbilityTimer = 2880;
    ab.cooldown      = 2880;
    const extH = wallH * 0.44;
    const eLX  = lWallX - Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eLY  = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eRX  = rWallX + Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const eRY  = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    extraWalls.push(makeWall(eLX, eLY, wallThick, extH, -wallAngle, 'right'));
    extraWalls.push(makeWall(eRX, eRY, wallThick, extH,  wallAngle, 'left'));
    wallStuckBalls = [];
    balls.forEach(function(ball) {
      if (ball.merging || ball.spawning) return;
      const c = blobCentroid(ball);
      extraWalls.forEach(function(wall) {
        const hw = wall.w / 2, hh = wall.h / 2;
        const ca = Math.cos(wall.angle), sa = Math.sin(wall.angle);
        let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
        [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].forEach(function(c2) {
          const x = wall.cx + c2[0]*ca - c2[1]*sa;
          const y = wall.cy + c2[0]*sa + c2[1]*ca;
          if (x < mnx) mnx = x; if (x > mxx) mxx = x;
          if (y < mny) mny = y; if (y > mxy) mxy = y;
        });
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
//  LOSE — ball has spilled out and fallen past floor level.
// ═══════════════════════════════════════════════════════════
function checkLose() {
  if (gameOver || cashedOut) return;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.merging || b.spawning || b.dyingAnim) continue;
    const c = blobCentroid(b);
    if (c.y > cBottom + 40) {
      if (loseBean) return;
      loseBean = b;
      b.dyingAnim  = true;
      b.dyingTick  = 0;
      b.dyingFromX = c.x;
      b.dyingFromY = Math.min(c.y, H + b.r);
      physicsEnabled = false;
      gameOver = true;
      return;
    }
  }
}

function restart() {
  balls = [];
  extraWalls.length = 0;
  wallAbilityOn = false; wallAbilityTimer = 0;
  wallStuckBalls = [];
  score = 0; gameOver = false; cashedOut = false;
  seenTiers = new Set([1,2,3,4]);
  dropCooldown = 120;
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

function startGame() {
  showScreen(null);
  gameActive = true; gameOver = false; cashedOut = false;
  restart();
  gameSession = null;
}

function playAgain() { startGame(); }
