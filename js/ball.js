// ═══════════════════════════════════════════════════════════
//  CREATE BALL
// ═══════════════════════════════════════════════════════════
function createBall(x, y, tier, vy) {
  vy = vy || 0;
  const td   = TIERS[tier-1];
  const r    = td.radius;
  const body = Bodies.circle(x, y, r, {
    restitution:0.18, friction:0.55, frictionAir:0.01,
    frictionStatic:0.6, density:0.002, slop:0.5,
    label:'ball_' + tier
  });
  Body.setVelocity(body, { x:0, y:vy });
  World.add(world, body);

  const ball = {
    body, tier, r,
    color: td.color,
    merging:   false,
    pts:       null,  // soft-body perimeter points (initialized on first stepSoftBody call)
    wobble:    0,
    seed:      Math.random() * 6.28,
    popScale:  0.1,
    spawning:  true,
    spawnTick: 0,
    origMass: body.mass, origR: r,
    expression: tier===9 ? EXPRESSIONS[randInt(0,EXPRESSIONS.length)] : (tier===10?'stoic':null),
    planet:     tier===10 ? PLANETS[randInt(0,PLANETS.length)] : null,
    tieDye:     null,
    element:    tier===9  ? ELEMENTS[randInt(0,ELEMENTS.length)] : null,
    hueOffset:  0,
    eyeX: 0.15, eyeY: 0, eyeTargetX: 0.15, eyeTargetY: 0,
    faceDelay:  20,
  };
  balls.push(ball);
  seenTiers.add(tier);
  if (tier===9  && !hasTieDye) hasTieDye = true;
  if (tier===10 && !hasPlanet) hasPlanet = true;
  return ball;
}

// ═══════════════════════════════════════════════════════════
//  MERGE
// ═══════════════════════════════════════════════════════════
function emitMergeSparks(mx, my, color) {
  // Burst — firework-style radial spray
  for (let i = 0; i < 28; i++) {
    const a     = Math.random() * Math.PI * 2;
    const speed = 1.8 + Math.random() * 5.5;
    sparks.push({ x:mx, y:my,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1.2,
      life: 0.85 + Math.random() * 0.5,
      size: 2 + Math.random() * 3.5,
      color: (Math.random() < 0.3) ? '#fff' : color,
      grav: 0.13, decay: 0.022 + Math.random() * 0.018 });
  }
  // Small inner flash
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    sparks.push({ x:mx, y:my,
      vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2,
      life: 0.6, size: 5 + Math.random() * 4,
      color: '#fff', grav: 0, decay: 0.06 });
  }
}

function triggerMerge(a, b) {
  a.merging = true; b.merging = true;
  a.mergePair = b; b.mergePair = a;
  // Bias merge point 60% toward whichever ball is falling faster (the dropper)
  const aFalling = a.body.velocity.y >= b.body.velocity.y;
  const mx  = aFalling
    ? a.body.position.x * 0.60 + b.body.position.x * 0.40
    : b.body.position.x * 0.60 + a.body.position.x * 0.40;
  const my  = aFalling
    ? a.body.position.y * 0.60 + b.body.position.y * 0.40
    : b.body.position.y * 0.60 + a.body.position.y * 0.40;
  const avx = (a.body.velocity.x + b.body.velocity.x) * 0.5;
  const nt  = Math.min(a.tier + 1, 10);
  seenTiers.add(nt);
  const now = Date.now();
  const base= TIER_SCORES[nt];
  let mult  = 1.0;
  if (now - lastMergeMs < 1500) {
    comboCount++;
    if (comboCount===2){ mult=1.2;  comboLabel='Combo!';   comboColor='#FFE84A'; }
    if (comboCount>=3) { mult=1.44; comboLabel='INSANE!!'; comboColor='#4AFFFF'; }
  } else {
    comboCount=1; comboLabel='';
  }
  lastMergeMs = now;
  comboTimer  = 90;
  playSlosh(nt);
  playChime(nt, comboCount);
  const earned = Math.round(base * mult);
  score += earned;
  if (score > bestScore) bestScore = score;
  popups.push({ x:mx, y:my-20, text:'+'+earned, life:1.0, color:comboCount>1?'#FFE84A':'#fff', combo:comboCount>1 });

  // Remove physics bodies immediately; animation is purely visual
  delete bodyContacts[a.body.id]; delete bodyContacts[b.body.id];
  try { World.remove(world, a.body); } catch(_){}
  try { World.remove(world, b.body); } catch(_){}

  // Store animation state so drawBallFill can animate them flying toward midpoint
  const mergeColor = TIERS[nt-1] ? TIERS[nt-1].color : a.color;
  a.mergeFromX=a.body.position.x; a.mergeFromY=a.body.position.y;
  b.mergeFromX=b.body.position.x; b.mergeFromY=b.body.position.y;
  a.mergeToX=mx; a.mergeToY=my;
  b.mergeToX=mx; b.mergeToY=my;
  a.mergeStartMs=now; b.mergeStartMs=now;
  a.mergeColor=mergeColor; b.mergeColor=mergeColor;

  setTimeout(function() {
    balls = balls.filter(function(bb){ return bb!==a && bb!==b; });
    if (nt >= 5) emitMergeSparks(mx, my, mergeColor);
    if (nt > 10) return;
    const nb = createBall(mx, my, nt, -2);
    Body.setVelocity(nb.body, { x:avx * 0.5, y:-2 });
  }, 150);
}

// ═══════════════════════════════════════════════════════════
//  COLLISION
// ═══════════════════════════════════════════════════════════
// ── Contact normal tracking via events ───────────────────────
// Matter.js collision.normal points FROM bodyB TOWARD bodyA (pushes A away).
// "toward-contact" for A = toward B = NEGATE normal.
// "toward-contact" for B = toward A = SAME as normal.
function applyContactPair(pair) {
  const a  = pair.bodyA, b = pair.bodyB;
  const nx = pair.collision.normal.x, ny = pair.collision.normal.y;
  const d  = pair.collision.depth || 0;
  if (!bodyContacts[a.id]) bodyContacts[a.id] = {};
  if (!bodyContacts[b.id]) bodyContacts[b.id] = {};
  bodyContacts[a.id][b.id] = { nx: -nx, ny: -ny, depth: d, om: b.isStatic ? 1e6 : (b.mass||0) };
  bodyContacts[b.id][a.id] = { nx:  nx, ny:  ny, depth: d, om: a.isStatic ? 1e6 : (a.mass||0) };
}

function applyImpactSquish(ball, nx, ny, impulse) {
  const sq = Math.min(impulse * 0.28, 0.22);
  if (Math.abs(ny) >= Math.abs(nx)) {
    ball.squishY = Math.max(0.72, ball.squishY - sq);
    ball.squishX = Math.min(1.40, 1.0 / Math.sqrt(ball.squishY));
  } else {
    ball.squishX = Math.max(0.72, ball.squishX - sq);
    ball.squishY = Math.min(1.40, 1.0 / Math.sqrt(ball.squishX));
  }
}

Events.on(engine, 'collisionStart', function(ev) {
  ev.pairs.forEach(function(pair) {
    applyContactPair(pair);
    const { bodyA, bodyB, collision } = pair;
    const ba  = getBall(bodyA);
    const bb  = getBall(bodyB);
    const dep = (collision && collision.depth) ? collision.depth : 1;
    const nx  = collision.normal.x, ny = collision.normal.y;
    // Velocity-based impulse: a fast-falling ball squishes harder than a slow one
    const relVn = Math.max(0,
      (bodyA.velocity.x - bodyB.velocity.x) * nx +
      (bodyA.velocity.y - bodyB.velocity.y) * ny
    );
    const imp = Math.min(relVn * 0.06 + dep * 0.3, 0.42);
    if (ba && imp > 0.04) applySoftImpulse(ba, -nx, -ny, imp);
    if (bb && imp > 0.04) applySoftImpulse(bb,  nx,  ny, imp);
    if (!ba||!bb) return;
    if (ba.tier===bb.tier && !ba.merging && !bb.merging) triggerMerge(ba, bb);
  });
});

Events.on(engine, 'collisionActive', function(ev) {
  ev.pairs.forEach(function(pair) {
    applyContactPair(pair);
    const ba = getBall(pair.bodyA), bb = getBall(pair.bodyB);
    if (ba && bb && ba.tier===bb.tier && !ba.merging && !bb.merging) triggerMerge(ba, bb);
  });
});

Events.on(engine, 'collisionEnd', function(ev) {
  ev.pairs.forEach(function(pair) {
    const a = pair.bodyA, b = pair.bodyB;
    if (bodyContacts[a.id]) delete bodyContacts[a.id][b.id];
    if (bodyContacts[b.id]) delete bodyContacts[b.id][a.id];
  });
});
