// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
//
//  Fixed-timestep accumulator: Matter.js Engine.update runs at a
//  constant 120Hz regardless of display refresh rate. A 120Hz
//  monitor runs one physics step per frame; a 60Hz phone runs two.
//  Same game speed everywhere.
// ═══════════════════════════════════════════════════════════

const PHYSICS_HZ     = 120;
const PHYSICS_DT_MS  = 1000 / PHYSICS_HZ;
const MAX_TICKS_PER_FRAME = 8;   // catch-up cap

let _physAccum  = 0;
let _lastMs     = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  _frameSec = now / 1000;
  const frameDelta = Math.min(now - _lastMs, PHYSICS_DT_MS * MAX_TICKS_PER_FRAME);
  _lastMs = now;

  if (physicsEnabled) {
    _physAccum += frameDelta;
    let ticks = 0;
    while (_physAccum >= PHYSICS_DT_MS && ticks < MAX_TICKS_PER_FRAME) {
      Engine.update(engine, PHYSICS_DT_MS);
      tickGame();
      _physAccum -= PHYSICS_DT_MS;
      ticks++;
    }
  }

  renderFrame();
}

// ── Game-logic tick — runs at fixed 120Hz ──────────────────
function tickGame() {
  if (hasTieDye && bgSands < 1) bgSands = Math.min(1, bgSands + 0.002);
  if (hasPlanet && bgDark  < 1) bgDark  = Math.min(1, bgDark  + 0.002);
  if (dropCooldown > 0) dropCooldown--;

  ['swap','earthquake','walls'].forEach(function(k){ if (AB[k].cooldown > 0) AB[k].cooldown--; });

  if (wallAbilityOn) {
    wallAbilityTimer--;
    if (wallAbilityTimer <= 0) {
      wallAbilityOn = false;
      extraWalls.forEach(function(w){ try { World.remove(world, w); } catch(_) {} });
      extraWalls = [];
      wallStuckBalls.forEach(function(ball) {
        if (ball.isWallStuck) {
          Body.setStatic(ball.body, false);
          ball.isWallStuck = false;
        }
      });
      wallStuckBalls = [];
    }
  }

  if (quakeActive) {
    quakeTimer--;
    quakePulse--;
    if (quakePulse <= 0) {
      quakePulse = 130;
      playQuakeSound();
      Composite.allBodies(world).forEach(function(b) {
        if (b.isStatic) return;
        if (b.position.y < cTop) return;
        if (b.velocity.y < -0.5) return;
        const cmap = bodyContacts[b.id] || {};
        if (Object.keys(cmap).length === 0) return;
        b.isSleeping = false;
        Body.setVelocity(b, {
          x: b.velocity.x + (Math.random() - 0.5) * 7,
          y: -(4 + Math.random() * 4),
        });
      });
    }
    if (quakeTimer <= 0) quakeActive = false;
  }

  // Per-ball animation state
  balls.forEach(function(ball) {
    if (ball.spawning) {
      ball.spawnTick++;
      ball.popScale = Math.min(1.0, ball.spawnTick / 16);
      if (ball.popScale >= 1.0) ball.spawning = false;
    }
    if (ball.faceDelay > 0) ball.faceDelay--;

    const speed = ball.body.speed;
    ball._speed = speed;

    if (speed > 1.2) {
      ball.eyeTargetX = Math.max(-0.75, Math.min(0.75, ball.body.velocity.x * 0.22));
      ball.eyeTargetY = Math.max(-0.55, Math.min(0.55, ball.body.velocity.y * 0.16));
    } else if (Math.random() < 0.0015) {
      ball.eyeTargetX = (Math.random() - 0.5) * 1.0;
      ball.eyeTargetY = (Math.random() - 0.5) * 0.5;
    }
    ball.eyeX = lerp(ball.eyeX, ball.eyeTargetX, 0.035);
    ball.eyeY = lerp(ball.eyeY, ball.eyeTargetY, 0.035);

    if (ball.tier === 8) ball.hueOffset = (ball.hueOffset + 0.4) % 360;

    if (ball.tier === 9 && ball.element && !ball.spawning && sparks.length < 120 && Math.random() < 0.04) {
      emitElementalSpark(ball);
    }

    if (!ball.merging) updatePerimeter(ball);
  });

  if (comboTimer > 0) comboTimer--;
  if (shakeFrames > 0) shakeFrames--;

  if (!gameOver && !cashedOut && balls.length > 0) checkLose();
}

// ═══════════════════════════════════════════════════════════
//  JELLO PERIMETER — visual deformation on top of Matter's rigid
//  circle. Each tick, compute a target offset for each perimeter
//  vertex based on gravity droop + contact flattening, then lerp
//  the current offset toward it. Stays within ~10% of the physics
//  radius so visual and physical shape stay aligned.
// ═══════════════════════════════════════════════════════════
const PERIM_LERP        = 0.18;     // per-tick smoothing toward target
const PERIM_DROOP       = 0.035;    // gravity sag strength (fraction of r)
const PERIM_CONTACT     = 0.11;     // contact flattening (fraction of r)
const PERIM_VEL_STRETCH = 0.008;    // velocity elongation (fraction of r per px/tick)
const PERIM_MIN         = 0.82;     // clamp vertex radius to this much of r
const PERIM_MAX         = 1.08;     // ... and this much

function updatePerimeter(ball) {
  if (!ball.perim) return;
  const r  = ball.r;
  const contacts = bodyContacts[ball.body.id] || {};
  const vx = ball.body.velocity.x;
  const vy = ball.body.velocity.y;
  const speed = Math.min(ball._speed || 0, 8);
  const ivs = speed > 0.1 ? 1 / speed : 0;
  const uvx = vx * ivs, uvy = vy * ivs;

  for (let i = 0; i < PERIM_N; i++) {
    const a  = (i / PERIM_N) * Math.PI * 2 - Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);

    // Start on a perfect circle
    let rad = r;

    // Gravity droop — bottom slightly bulged, top slightly pulled in
    rad += sa * r * PERIM_DROOP;

    // Velocity stretch — subtle elongation along motion direction
    const along = ca * uvx + sa * uvy;
    rad += along * speed * r * PERIM_VEL_STRETCH;

    // Contact flattening — push vertex inward where it faces a contact
    const cks = Object.keys(contacts);
    for (let ci = 0; ci < cks.length; ci++) {
      const c = contacts[cks[ci]];
      const dot = ca * c.nx + sa * c.ny;
      if (dot > 0.15) {
        // strength: stronger near the direct contact axis, mild falloff
        rad -= ((dot - 0.15) / 0.85) * r * PERIM_CONTACT;
      }
    }

    // Hard clamp — keeps visual close to physics
    if (rad < r * PERIM_MIN) rad = r * PERIM_MIN;
    else if (rad > r * PERIM_MAX) rad = r * PERIM_MAX;

    const tx = ca * rad;
    const ty = sa * rad;
    const p  = ball.perim[i];
    p.x = lerp(p.x, tx, PERIM_LERP);
    p.y = lerp(p.y, ty, PERIM_LERP);
  }
}

function emitElementalSpark(ball) {
  const el = ball.element;
  const _r = ball.r;
  const _ang = Math.random() * Math.PI * 2;
  const _d   = _r * (0.55 + Math.random() * 0.45);
  const _ex  = ball.body.position.x + Math.cos(_ang) * _d;
  const _ey  = ball.body.position.y + Math.sin(_ang) * _d;
  let _vx, _vy, _life, _sz, _grav, _decay, _col;
  if (el === 'fire') {
    _vx = (Math.random() - 0.5) * 1.5; _vy = -(1.5 + Math.random() * 2.5);
    _life = 0.7 + Math.random() * 0.4; _sz = 2 + Math.random() * 3;
    _grav = -0.06; _decay = 0.035;
    _col = ['#FF6B00','#FF3300','#FF9900','#FFD700'][randInt(0,4)];
  } else if (el === 'water') {
    _vx = (Math.random() - 0.5) * 1.0; _vy = 1.5 + Math.random() * 2.0;
    _life = 0.6 + Math.random() * 0.3; _sz = 1.5 + Math.random() * 2.5;
    _grav = 0.12; _decay = 0.04;
    _col = ['#00AAFF','#0077DD','#66CCFF'][randInt(0,3)];
  } else if (el === 'ice') {
    _vx = (Math.random() - 0.5) * 2.2; _vy = (Math.random() - 0.5) * 2.2;
    _life = 0.8 + Math.random() * 0.5; _sz = 1.5 + Math.random() * 2.5;
    _grav = 0.01; _decay = 0.025;
    _col = ['#AADDFF','#FFFFFF','#88CCEE'][randInt(0,3)];
  } else if (el === 'earth') {
    _vx = (Math.random() - 0.5) * 1.5; _vy = -(0.5 + Math.random() * 1.5);
    _life = 0.5 + Math.random() * 0.3; _sz = 2 + Math.random() * 3;
    _grav = 0.18; _decay = 0.048;
    _col = ['#8B4513','#556B2F','#CD853F','#D2691E'][randInt(0,4)];
  } else if (el === 'lightning') {
    _vx = (Math.random() - 0.5) * 6; _vy = (Math.random() - 0.5) * 6;
    _life = 0.25 + Math.random() * 0.2; _sz = 1 + Math.random() * 2;
    _grav = 0; _decay = 0.12;
    _col = Math.random() < 0.7 ? '#FFFF00' : '#FFFFFF';
  } else {
    _vx = (Math.random() - 0.5) * 3.5; _vy = -(0.4 + Math.random() * 1.5);
    _life = 0.6 + Math.random() * 0.4; _sz = 1 + Math.random() * 2;
    _grav = -0.04; _decay = 0.04;
    _col = ['#CCFFCC','#88DD88','#FFFFFF'][randInt(0,3)];
  }
  sparks.push({ x:_ex, y:_ey, vx:_vx, vy:_vy, life:_life, size:_sz, color:_col, grav:_grav, decay:_decay });
}

// ── Rendering — runs once per display frame ────────────────
function renderFrame() {
  if (loseBean) {
    loseBean.dyingTick++;
    ctx.save(); drawBackground(); drawContainer();
    balls.forEach(function(b){ if(!b.dyingAnim) drawBallAura(b); });
    balls.forEach(function(b){ if(!b.dyingAnim) drawBallFill(b); });
    balls.forEach(function(b){ if(!b.dyingAnim) drawBallStroke(b); });
    balls.forEach(function(b){ if(!b.dyingAnim) drawBallFace(b); });
    drawDyingBall(loseBean);
    ctx.restore(); drawUI();
    if (loseBean.dyingTick >= 190) {
      const _m = loseBean.r * 1.6;
      deadBalls.push({
        x: _m + Math.random() * (W - _m*2),
        y: _m + Math.random() * (H - _m*2),
        r: loseBean.r, color: loseBean.color, tier: loseBean.tier,
        planet: loseBean.planet, element: loseBean.element,
        angle: Math.random() * Math.PI * 2,
        seed:  loseBean.seed || Math.random() * 6.28,
      });
      if (deadBalls.length > 50) deadBalls.shift();
      try { localStorage.setItem('deadBalls', JSON.stringify(deadBalls)); } catch(e){}
      loseBean = null; gameActive = false; openSubmit();
    }
    return;
  }

  if (!gameActive) {
    if (deadBalls.length > 0) {
      ctx.clearRect(0, 0, W, H);
      drawBackground();
      deadBalls.forEach(drawDeadBall);
    }
    return;
  }

  const sx = shakeFrames > 0 ? (Math.random() - 0.5) * 7 : 0;
  const sy = shakeFrames > 0 ? (Math.random() - 0.5) * 7 : 0;

  ctx.save();
  if (shakeFrames > 0) ctx.translate(sx, sy);
  drawBackground();
  drawContainer();
  balls.forEach(drawBallAura);

  const _neckDrawn = new Set();
  balls.forEach(function(ball) {
    if (!ball.merging || !ball.mergePair || _neckDrawn.has(ball)) return;
    _neckDrawn.add(ball); _neckDrawn.add(ball.mergePair);
    drawMergeNeck(ball, ball.mergePair);
  });
  balls.forEach(drawBallFill);
  balls.forEach(drawBallStroke);
  balls.forEach(drawBallFace);

  sparks = sparks.filter(function(s) { return s.life > 0; });
  if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
  sparks.forEach(function(s) {
    s.x += s.vx; s.y += s.vy;
    s.vy += s.grav; s.vx *= 0.96;
    s.life -= s.decay;
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(0.5, s.size * s.life), 0, 6.283);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  drawAimLine();
  ctx.restore();
  drawUI();
}

requestAnimationFrame(loop);

// ═══════════════════════════════════════════════════════════
//  SERVICE WORKER  — PWA auto-update on every reload
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(function(reg) {
    reg.update();
    reg.addEventListener('updatefound', function() {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (!refreshing) { refreshing = true; location.reload(); }
  });
}
