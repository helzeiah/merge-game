// ═══════════════════════════════════════════════════════════
//  DROP
//
//  Aim clamps to [lWallX, rWallX] — the wall centers. You can drop
//  directly above the walls; the ball falls and bounces off them
//  into the container.
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
    extraWalls = [
      Bodies.rectangle(eLX, eLY, wallThick, extH, Object.assign({}, wallOpts, { angle: -wallAngle })),
      Bodies.rectangle(eRX, eRY, wallThick, extH, Object.assign({}, wallOpts, { angle:  wallAngle })),
    ];
    World.add(world, extraWalls);
    wallStuckBalls = [];
    balls.forEach(function(ball) {
      if (ball.merging || ball.spawning) return;
      extraWalls.forEach(function(wall) {
        const b = wall.bounds;
        const bx = ball.body.position.x, by = ball.body.position.y;
        if (bx >= b.min.x - ball.r && bx <= b.max.x + ball.r &&
            by >= b.min.y - ball.r && by <= b.max.y + ball.r) {
          if (!ball.isWallStuck) {
            Body.setStatic(ball.body, true);
            Body.setVelocity(ball.body, { x: 0, y: 0 });
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
//  A ball's physics body has fallen past the floor's y level —
//  only possible if it spilled over a wall top first.
// ═══════════════════════════════════════════════════════════
function checkLose() {
  if (gameOver || cashedOut) return;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.merging || b.spawning || b.dyingAnim) continue;
    if (b.body.position.y > cBottom + 40) {
      if (loseBean) return;
      loseBean = b;
      b.dyingAnim  = true;
      b.dyingTick  = 0;
      b.dyingFromX = b.body.position.x;
      b.dyingFromY = Math.min(b.body.position.y, H + b.r);
      physicsEnabled = false;
      gameOver = true;
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════
function restart() {
  balls.forEach(function(b) { try { World.remove(world, b.body); } catch(_) {} });
  balls = [];
  extraWalls.forEach(function(w) { try { World.remove(world, w); } catch(_) {} });
  extraWalls = [];
  wallAbilityOn = false; wallAbilityTimer = 0;
  wallStuckBalls.forEach(function(b) { b.isWallStuck = false; });
  wallStuckBalls = [];
  Object.keys(bodyContacts).forEach(function(k) { delete bodyContacts[k]; });
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
