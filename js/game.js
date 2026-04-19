// ═══════════════════════════════════════════════════════════
//  DROP
// ═══════════════════════════════════════════════════════════
function dropBall() {
  if (gameOver||cashedOut||dropCooldown>0) return;
  playSwoosh();
  const r  = TIERS[nextTier-1].radius;
  const cx = Math.max(CX - cW*0.50 + r, Math.min(CX + cW*0.50 - r, aimX));
  const nb = createBall(cx, dropZoneY - r, nextTier);
  nb.popScale=0.1; nb.spawning=true; nb.spawnTick=0;
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
  // Block if no uses, active cooldown, or walls already on
  if (ab.uses<=0) return;
  if (ab.cooldown>0) return;
  if (key==='walls' && wallAbilityOn) return;
  if (gameOver||cashedOut) return;

  ab.uses--;

  if (key==='swap') {
    playSwapSound();
    nextTier = randDropTier();
    ab.cooldown = 20; // short lock so double-tap doesn't consume 2

  } else if (key==='earthquake') {
    playQuakeSound();
    ab.cooldown  = 600;
    quakeActive  = true;
    quakeTimer   = 480; // 8 seconds
    quakePulse   = 0;   // fire immediately

  } else if (key==='walls') {
    playWallsSound();
    wallAbilityOn    = true;
    wallAbilityTimer = 1440;  // 24 seconds
    ab.cooldown      = 1440;
    const extH = wallH * 0.44;
    const eLX  = lWallX - Math.sin(wallAngle)*(wallH*0.5+extH*0.5);
    const eLY  = wallCY  - Math.cos(wallAngle)*(wallH*0.5+extH*0.5);
    const eRX  = rWallX + Math.sin(wallAngle)*(wallH*0.5+extH*0.5);
    const eRY  = wallCY  - Math.cos(wallAngle)*(wallH*0.5+extH*0.5);
    extraWalls = [
      Bodies.rectangle(eLX, eLY, wallThick, extH, Object.assign({},wallOpts,{angle:-wallAngle})),
      Bodies.rectangle(eRX, eRY, wallThick, extH, Object.assign({},wallOpts,{angle: wallAngle})),
    ];
    World.add(world, extraWalls);
    // Balls caught inside the new walls get stuck there
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
            Body.setVelocity(ball.body, {x:0, y:0});
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
// ═══════════════════════════════════════════════════════════
function checkLose() {
  for (let i=0; i<balls.length; i++) {
    const b = balls[i];
    if (b.merging||b.spawning||b.dyingAnim) continue;
    if (b.body.position.y > cBottom + 60) {
      if (!loseBean) {
        loseBean = b;
        b.dyingAnim  = true;
        b.dyingTick  = 0;
        b.dyingFromX = b.body.position.x;
        b.dyingFromY = Math.min(b.body.position.y, H + b.r);
        physicsEnabled = false;
        gameOver = true;
      }
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════
function restart() {
  balls.forEach(function(b){ try{World.remove(world,b.body);}catch(_){} });
  balls=[];
  extraWalls.forEach(function(w){ try{World.remove(world,w);}catch(_){} });
  extraWalls=[];
  wallAbilityOn=false; wallAbilityTimer=0;
  wallStuckBalls.forEach(function(b){ b.isWallStuck=false; }); wallStuckBalls=[];
  score=0; gameOver=false; cashedOut=false;
  seenTiers = new Set([1,2,3,4]);
  dropCooldown=60; nextTier=randDropTier(); nextNextTier=randDropTier(); aimX=CX;
  physicsEnabled=true;
  comboCount=0; comboTimer=0; comboLabel=''; shakeFrames=0;
  popups=[]; sparks=[];
  AB.swap.uses=3;       AB.swap.cooldown=0;
  AB.earthquake.uses=3; AB.earthquake.cooldown=0;
  AB.walls.uses=3;      AB.walls.cooldown=0;
  quakeActive=false; quakeTimer=0; quakePulse=0;
  Object.keys(bodyContacts).forEach(function(k){ delete bodyContacts[k]; });
  hasTieDye=false; hasPlanet=false; bgSands=0; bgDark=0; sandDust=null; loseBean=null;
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
  gameSession = null; // fresh session fetched in openSubmit() right when game ends
}

// Called by submit screen's Play Again button — skips home screen
function playAgain() {
  startGame();
}
