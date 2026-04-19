// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════

function loop() {
  requestAnimationFrame(loop);
  const _now = performance.now();
  _frameSec = _now / 1000;

  // Physics: fixed step (particle sims are sensitive to variable dt).
  // Run twice per frame for smoother response at 60Hz without being
  // twice as fast on 120Hz displays — each call advances one tick.
  if (physicsEnabled) {
    stepWorld();
    stepWorld();
    detectMerges();
  }

  // Death animation runs outside normal gameActive gating
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

  if (hasTieDye && bgSands < 1) bgSands = Math.min(1, bgSands + 0.004);
  if (hasPlanet && bgDark  < 1) bgDark  = Math.min(1, bgDark  + 0.004);
  if (dropCooldown > 0) dropCooldown--;

  // Ability cooldowns
  ['swap','earthquake','walls'].forEach(function(k){ if (AB[k].cooldown > 0) AB[k].cooldown--; });

  // Walls timer: when it expires, release stuck balls back to physics.
  if (wallAbilityOn) {
    wallAbilityTimer--;
    if (wallAbilityTimer <= 0) {
      wallAbilityOn = false;
      extraWalls.length = 0;
      wallStuckBalls.forEach(function(ball) {
        if (ball.isWallStuck) {
          for (let i = 0; i < ball.particles.length; i++) ball.particles[i].invMass = 1;
          ball.isWallStuck = false;
        }
      });
      wallStuckBalls = [];
    }
  }

  // Quake multi-pulse: every ~1s, give every resting blob an upward kick
  // by offsetting each particle's prev-position (Verlet infers velocity).
  if (quakeActive) {
    quakeTimer--;
    quakePulse--;
    if (quakePulse <= 0) {
      quakePulse = 65;
      playQuakeSound();
      for (let bi = 0; bi < balls.length; bi++) {
        const blob = balls[bi];
        if (blob.merging || blob.spawning) continue;
        const c = blobCentroid(blob);
        if (c.y < cTop) continue; // skip balls already above the container
        const v = blobVelocity(blob);
        if (v.y < -0.5) continue; // already moving upward from a prior pulse
        const kickY = -(4 + Math.random() * 4);
        const kickX = (Math.random() - 0.5) * 7;
        for (let pi = 0; pi < blob.particles.length; pi++) {
          const p = blob.particles[pi];
          if (p.invMass === 0) continue;
          p.px = p.x - kickX;
          p.py = p.y - kickY;
        }
      }
    }
    if (quakeTimer <= 0) quakeActive = false;
  }

  // ── Per-ball animation state (eyes, spawn pop, element sparks) ──
  balls.forEach(function(ball) {
    if (ball.spawning) {
      ball.spawnTick++;
      ball.popScale = Math.min(1.0, ball.spawnTick / 8);
      if (ball.popScale >= 1.0) ball.spawning = false;
    }
    if (ball.faceDelay > 0) ball.faceDelay--;

    const v = blobVelocity(ball);
    const speed = Math.sqrt(v.x * v.x + v.y * v.y);
    ball._speed = speed;  // cached for face/render

    // Eye tracking — follows velocity; random glances when idle.
    if (speed > 1.2) {
      ball.eyeTargetX = Math.max(-0.75, Math.min(0.75, v.x * 0.22));
      ball.eyeTargetY = Math.max(-0.55, Math.min(0.55, v.y * 0.16));
    } else if (Math.random() < 0.003) {
      ball.eyeTargetX = (Math.random() - 0.5) * 1.0;
      ball.eyeTargetY = (Math.random() - 0.5) * 0.5;
    }
    ball.eyeX = lerp(ball.eyeX, ball.eyeTargetX, 0.07);
    ball.eyeY = lerp(ball.eyeY, ball.eyeTargetY, 0.07);

    if (ball.tier === 8) ball.hueOffset = (ball.hueOffset + 0.8) % 360;

    // Elemental particle emission (capped so sparks array never blooms)
    if (ball.tier === 9 && ball.element && !ball.spawning && sparks.length < 120 && Math.random() < 0.08) {
      const el = ball.element;
      const _r = ball.r;
      const c  = blobCentroid(ball);
      const _ang = Math.random() * Math.PI * 2;
      const _d   = _r * (0.55 + Math.random() * 0.45);
      const _ex  = c.x + Math.cos(_ang) * _d;
      const _ey  = c.y + Math.sin(_ang) * _d;
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
  });

  if (comboTimer > 0) comboTimer--;

  const sx2 = shakeFrames > 0 ? (Math.random() - 0.5) * 7 : 0;
  const sy2 = shakeFrames > 0 ? (Math.random() - 0.5) * 7 : 0;
  if (shakeFrames > 0) shakeFrames--;

  if (!gameOver && !cashedOut && balls.length > 0) checkLose();

  ctx.save();
  if (shakeFrames > 0) ctx.translate(sx2, sy2);
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
