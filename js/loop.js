// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
let _lastFrameMs = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const _now = performance.now();
  const _rawDt = Math.min(_now - _lastFrameMs, 50); // cap at 50ms to prevent spiral of death
  _lastFrameMs = _now;
  _frameSec = _now / 1000;

  // Physics sub-stepping: 3 steps/frame — smoother stacking + collision resolution
  // Using actual elapsed time so physics runs at correct speed on any refresh rate (60/120/etc)
  if (physicsEnabled) {
    const _dt = _rawDt / 3;
    Engine.update(engine, _dt);
    Engine.update(engine, _dt);
    Engine.update(engine, _dt);
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
      // Add this ball to the persistent graveyard
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
      loseBean=null; gameActive=false; openSubmit();
    }
    return;
  }

  if (!gameActive) {
    if (deadBalls.length > 0) {
      ctx.clearRect(0,0,W,H);
      drawBackground();
      deadBalls.forEach(drawDeadBall);
    }
    return;
  }

  if (hasTieDye  && bgSands<1) bgSands=Math.min(1,bgSands+0.004);
  if (hasPlanet  && bgDark<1)  bgDark =Math.min(1,bgDark +0.004);
  if (dropCooldown>0) dropCooldown--;

  // Ability cooldowns
  ['swap','earthquake','walls'].forEach(function(k){ if(AB[k].cooldown>0) AB[k].cooldown--; });

  // Walls timer
  if (wallAbilityOn){ wallAbilityTimer--; if(wallAbilityTimer<=0){
    wallAbilityOn=false;
    extraWalls.forEach(function(w){ try{World.remove(world,w);}catch(_){} });
    extraWalls=[];
    wallStuckBalls.forEach(function(ball) {
      if (ball.isWallStuck) {
        Body.setStatic(ball.body, false);
        ball.isWallStuck = false;
      }
    });
    wallStuckBalls = [];
  }}

  // Quake multi-pulse: small hop every 22 frames for ~4 seconds
  if (quakeActive) {
    quakeTimer--;
    quakePulse--;
    if (quakePulse <= 0) {
      quakePulse = 65; // ~1.1s between pulses
      playQuakeSound();
      Composite.allBodies(world).forEach(function(b) {
        if (b.isStatic) return;
        // Don't directly toss balls above the container — they get pushed by physics below
        if (b.position.y < cTop) return;
        // Only toss resting balls — skip any already moving upward from a prior pulse
        if (b.velocity.y < -0.5) return;
        const cmap = bodyContacts[b.id] || {};
        const hasContact = Object.keys(cmap).length > 0;
        if (!hasContact) return;
        b.isSleeping   = false;
        b.sleepCounter = 0;
        Body.setVelocity(b, {
          x: b.velocity.x + (Math.random()-0.5) * 7,
          y: -(4 + Math.random() * 4)
        });
      });
    }
    if (quakeTimer <= 0) quakeActive = false;
  }

  // ── Soft-body simulation: step all perimeter points ──────────
  balls.forEach(function(ball) { stepSoftBody(ball); });

  // ── Per-ball animation updates ──────────────────────────────
  balls.forEach(function(ball) {
    // Spawn pop
    if (ball.spawning) {
      ball.spawnTick++;
      ball.popScale=Math.min(1.0, ball.spawnTick/8);
      if (ball.popScale>=1.0) ball.spawning=false;
    }
    if (ball.faceDelay > 0) ball.faceDelay--;

    const speed = ball.body.speed;

    // Eye tracking — follows velocity; random glances when idle
    if (speed > 1.2) {
      ball.eyeTargetX = Math.max(-0.75, Math.min(0.75, ball.body.velocity.x * 0.22));
      ball.eyeTargetY = Math.max(-0.55, Math.min(0.55, ball.body.velocity.y * 0.16));
    } else if (Math.random() < 0.003) {
      ball.eyeTargetX = (Math.random() - 0.5) * 1.0;
      ball.eyeTargetY = (Math.random() - 0.5) * 0.5;
    }
    ball.eyeX = lerp(ball.eyeX, ball.eyeTargetX, 0.07);
    ball.eyeY = lerp(ball.eyeY, ball.eyeTargetY, 0.07);

    // Rainbow hue rotation
    if (ball.tier === 8) ball.hueOffset = (ball.hueOffset + 0.8) % 360;

    // Elemental particle emission (capped so sparks array never blooms)
    if (ball.tier === 9 && ball.element && !ball.spawning && sparks.length < 120 && Math.random() < 0.08) {
      const el = ball.element;
      const cfg = ELEMENT_CFG[el];
      const _r = ball.r;
      const _ang = Math.random() * Math.PI * 2;
      const _d   = _r * (0.55 + Math.random() * 0.45);
      const _ex  = ball.body.position.x + Math.cos(_ang) * _d;
      const _ey  = ball.body.position.y + Math.sin(_ang) * _d;
      let _vx, _vy, _life, _sz, _grav, _decay, _col;
      if (el==='fire') {
        _vx=(Math.random()-0.5)*1.5; _vy=-(1.5+Math.random()*2.5);
        _life=0.7+Math.random()*0.4; _sz=2+Math.random()*3;
        _grav=-0.06; _decay=0.035;
        _col=['#FF6B00','#FF3300','#FF9900','#FFD700'][randInt(0,4)];
      } else if (el==='water') {
        _vx=(Math.random()-0.5)*1.0; _vy=1.5+Math.random()*2.0;
        _life=0.6+Math.random()*0.3; _sz=1.5+Math.random()*2.5;
        _grav=0.12; _decay=0.04;
        _col=['#00AAFF','#0077DD','#66CCFF'][randInt(0,3)];
      } else if (el==='ice') {
        _vx=(Math.random()-0.5)*2.2; _vy=(Math.random()-0.5)*2.2;
        _life=0.8+Math.random()*0.5; _sz=1.5+Math.random()*2.5;
        _grav=0.01; _decay=0.025;
        _col=['#AADDFF','#FFFFFF','#88CCEE'][randInt(0,3)];
      } else if (el==='earth') {
        _vx=(Math.random()-0.5)*1.5; _vy=-(0.5+Math.random()*1.5);
        _life=0.5+Math.random()*0.3; _sz=2+Math.random()*3;
        _grav=0.18; _decay=0.048;
        _col=['#8B4513','#556B2F','#CD853F','#D2691E'][randInt(0,4)];
      } else if (el==='lightning') {
        _vx=(Math.random()-0.5)*6; _vy=(Math.random()-0.5)*6;
        _life=0.25+Math.random()*0.2; _sz=1+Math.random()*2;
        _grav=0; _decay=0.12;
        _col=Math.random()<0.7?'#FFFF00':'#FFFFFF';
      } else { // wind
        _vx=(Math.random()-0.5)*3.5; _vy=-(0.4+Math.random()*1.5);
        _life=0.6+Math.random()*0.4; _sz=1+Math.random()*2;
        _grav=-0.04; _decay=0.04;
        _col=['#CCFFCC','#88DD88','#FFFFFF'][randInt(0,3)];
      }
      sparks.push({ x:_ex, y:_ey, vx:_vx, vy:_vy, life:_life, size:_sz, color:_col, grav:_grav, decay:_decay });
    }
  });

  if (comboTimer>0) comboTimer--;

  // Screen shake
  const sx2=shakeFrames>0?(Math.random()-0.5)*7:0;
  const sy2=shakeFrames>0?(Math.random()-0.5)*7:0;
  if (shakeFrames>0) shakeFrames--;

  if (!gameOver&&!cashedOut&&balls.length>0) checkLose();

  // Proximity merge — catches same-tier balls that are touching but whose
  // collision event was missed (e.g. slow settle, post-squish contact).
  if (!gameOver&&!cashedOut) {
    for (let _i=0;_i<balls.length;_i++) {
      for (let _j=_i+1;_j<balls.length;_j++) {
        const _a=balls[_i], _b=balls[_j];
        if (_a.tier!==_b.tier||_a.merging||_b.merging||_a.spawning||_b.spawning) continue;
        const _dx=_a.body.position.x-_b.body.position.x;
        const _dy=_a.body.position.y-_b.body.position.y;
        if (_dx*_dx+_dy*_dy < (_a.r+_b.r)*(_a.r+_b.r)*1.18) triggerMerge(_a,_b);
      }
    }
  }

  ctx.save();
  if (shakeFrames>0) ctx.translate(sx2,sy2);
  drawBackground();
  drawContainer();
  balls.forEach(drawBallAura);
  // Merge neck connectors (jello bridge — drawn before fills so balls sit on top)
  const _neckDrawn = new Set();
  balls.forEach(function(ball) {
    if (!ball.merging || !ball.mergePair || _neckDrawn.has(ball)) return;
    _neckDrawn.add(ball); _neckDrawn.add(ball.mergePair);
    drawMergeNeck(ball, ball.mergePair);
  });
  balls.forEach(drawBallFill);
  balls.forEach(drawBallStroke);
  balls.forEach(drawBallFace);
  // Sparks (merge trails + firework burst) — hard cap at 160 oldest-first
  sparks = sparks.filter(function(s){ return s.life > 0; });
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
    // Force SW update check on every load so new versions activate quickly
    reg.update();
    // When a new SW is waiting, skip waiting and reload to apply it immediately
    reg.addEventListener('updatefound', function() {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });
  // Reload once when SW takes control so the fresh SW serves the page
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (!refreshing) { refreshing = true; location.reload(); }
  });
}
