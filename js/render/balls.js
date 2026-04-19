// ═══════════════════════════════════════════════════════════
//  DRAW — BALL FILL GRADIENT (applied per-tier)
// ═══════════════════════════════════════════════════════════
function applyFill(ball, r) {
  const c = ball.color;
  if (c==='RAINBOW') {
    const ho = ball.hueOffset || 0;
    const g=ctx.createLinearGradient(-r,0,r,0);
    [0,40,80,140,200,270,320].forEach(function(h,i,a){
      g.addColorStop(i/(a.length-1),'hsl('+((h+ho)%360)+',100%,55%)');
    });
    ctx.fillStyle=g;
  } else if (c==='TIEDYE') {
    const el = ball.element || 'fire';
    const cfg = ELEMENT_CFG[el];
    const cols = cfg ? cfg.fill : ['#f0f','#0ff','#ff0'];
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.05,0,0,r);
    g.addColorStop(0,cols[0]); g.addColorStop(0.5,cols[1]); g.addColorStop(1,cols[2]);
    ctx.fillStyle=g;
  } else if (c==='PLANET') {
    const pc=PLANET_COLORS[ball.planet]||PLANET_COLORS.earth;
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.07,0,0,r);
    g.addColorStop(0,pc[2]); g.addColorStop(0.45,pc[0]); g.addColorStop(1,pc[1]);
    ctx.fillStyle=g;
  } else {
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.07,0,0,r);
    g.addColorStop(0,lighten(c,44)); g.addColorStop(1,c);
    ctx.fillStyle=g;
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — FACE (eyes, mouth, expression variants)
// ═══════════════════════════════════════════════════════════
function drawFace(ball, r) {
  const tier=ball.tier;
  const expr=ball.expression||tier;
  ctx.save();
  // blob is world-aligned, no body-angle to undo — face is naturally upright

  const es  = r*0.21;
  const esp = r*0.30;
  const eyY = -r*0.08;
  const moY = r*0.34;

  // Eye tracking: pupil drifts toward velocity direction + random glances
  const eyeDX = (ball.eyeX !== undefined ? ball.eyeX : 0.15) * es;
  const eyeDY = (ball.eyeY !== undefined ? ball.eyeY : 0) * es * 0.65;

  function drawEye(ex, ey, type) {
    const ow = r * 0.07;
    if (type==='dot') {
      ctx.fillStyle='#fff';  ctx.beginPath();ctx.arc(ex,ey,es*0.85,0,6.283);ctx.fill();
      ctx.strokeStyle='#111';ctx.lineWidth=ow;ctx.beginPath();ctx.arc(ex,ey,es*0.85,0,6.283);ctx.stroke();
      ctx.fillStyle='#111';  ctx.beginPath();ctx.arc(ex+eyeDX,ey+eyeDY,es*0.5,0,6.283);ctx.fill();
    } else if (type==='half') {
      ctx.save();
      ctx.beginPath();ctx.arc(ex,ey,es*1.35,0,6.283);ctx.clip();
      ctx.fillStyle='#fff';ctx.fillRect(ex-es*2,ey-es*2,es*4,es*2+1);
      ctx.restore();
      ctx.strokeStyle='#111';ctx.lineWidth=ow;
      ctx.beginPath();ctx.arc(ex,ey,es*1.35,Math.PI,0);ctx.stroke();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+eyeDX,ey+Math.max(0,eyeDY)+es*0.2,es*0.65,0,6.283);ctx.fill();
    } else if (type==='furrow') {
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,es*1.25,0,6.283);ctx.fill();
      ctx.strokeStyle='#111';ctx.lineWidth=ow;ctx.beginPath();ctx.arc(ex,ey,es*1.25,0,6.283);ctx.stroke();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+eyeDX*0.4,ey+es*0.1+eyeDY*0.4,es*0.72,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-es*0.1,ey-es*0.1,es*0.26,0,6.283);ctx.fill();
      ctx.strokeStyle='#111';ctx.lineWidth=r*0.055;ctx.lineCap='round';
      ctx.beginPath();
      if(ex<0){ctx.moveTo(ex-es*1.3,ey-es*1.6);ctx.lineTo(ex+es*0.8,ey-es*1.1);}
      else    {ctx.moveTo(ex-es*0.8,ey-es*1.1);ctx.lineTo(ex+es*1.3,ey-es*1.6);}
      ctx.stroke();
    } else {
      const big=(type==='wide'||type==='star')?1.5:1.28;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,es*big,0,6.283);ctx.fill();
      ctx.strokeStyle='#111';ctx.lineWidth=ow;ctx.beginPath();ctx.arc(ex,ey,es*big,0,6.283);ctx.stroke();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+eyeDX,ey+eyeDY,es*big*0.58,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+eyeDX-es*0.18,ey+eyeDY-es*0.25,es*0.3,0,6.283);ctx.fill();
    }
    if (type==='star') {
      ctx.fillStyle='#FFD700';
      for(let k=0;k<4;k++){
        const a=(k/4)*6.283;
        ctx.beginPath();ctx.arc(ex+Math.cos(a)*es*1.15,ey+Math.sin(a)*es*1.15,es*0.2,0,6.283);ctx.fill();
      }
    }
  }

  let eyeT='round';
  if(tier===1) eyeT='dot';
  else if(tier===4) eyeT='furrow';
  else if(tier===5||tier===7||tier===8) eyeT='wide';
  else if(tier===8) eyeT='star';
  else if(tier===6||expr==='sleepy') eyeT='half';
  else if(expr==='surprised') eyeT='wide';
  if(tier===8) eyeT='star';

  drawEye(-esp,eyY,eyeT);
  drawEye( esp,eyY,eyeT);

  ctx.strokeStyle='#111';ctx.lineWidth=r*0.066;ctx.lineCap='round';
  const mT=(tier===1||tier===4||expr==='mad')?'flat':
            (tier===7||expr==='sad')?'frown':
            (tier===3||tier===8)?'grin':
            (tier===5)?'smirk':
            (tier===2||tier===6||expr==='sleepy')?'gentle':'smile';
  ctx.beginPath();
  if(mT==='flat')  { ctx.moveTo(-r*0.22,moY);ctx.lineTo(r*0.22,moY); }
  else if(mT==='frown') { ctx.arc(0,moY+r*0.28,r*0.24,Math.PI+0.25,-0.25); }
  else if(mT==='grin')  { ctx.arc(0,moY-r*0.08,r*0.34,0.1,Math.PI-0.1); }
  else if(mT==='smirk') { ctx.moveTo(-r*0.15,moY+r*0.05);ctx.quadraticCurveTo(r*0.05,moY-r*0.12,r*0.26,moY-r*0.04); }
  else if(mT==='gentle'){ ctx.arc(0,moY-r*0.08,r*0.2,0.25,Math.PI-0.25); }
  else                   { ctx.arc(0,moY-r*0.08,r*0.27,0.2,Math.PI-0.2); }
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — SPLIT BALL PASSES (fill → stroke → face)
//  Drawn in separate passes so neck connectors layer correctly.
// ═══════════════════════════════════════════════════════════
function ballTransform(ball, sc) {
  ctx.translate(ball.body.position.x, ball.body.position.y);
  const va = ball.velAngle;
  ctx.rotate(va);
  ctx.scale(ball.velStretch * sc, ball.velCompress * sc);
  ctx.rotate(-va);
}

function drawBallFill(ball) {
  if (ball.merging) {
    const elapsed = Date.now() - ball.mergeStartMs;
    const t  = Math.min(1, elapsed / 150);
    const t2 = t * t;            // ease-in: accelerates toward target
    const px = ball.mergeFromX + (ball.mergeToX - ball.mergeFromX) * t2;
    const py = ball.mergeFromY + (ball.mergeToY - ball.mergeFromY) * t2;
    const sc = Math.max(0, 1 - t * 0.88);
    if (sc < 0.04) return;
    // Trail sparks every other frame
    if (t > 0.05 && Math.random() < 0.55) {
      sparks.push({ x:px, y:py,
        vx:(Math.random()-0.5)*1.8, vy:(Math.random()-0.5)*1.8 - 0.3,
        life:0.65+Math.random()*0.2, size:2+Math.random()*2,
        color:ball.mergeColor||ball.color, grav:0.04, decay:0.055 });
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = 1 - t * 0.6;
    ctx.scale(sc, sc);
    applyFill(ball, ball.r);
    blobPath(ball.r, 1, 1, 0); ctx.fill();
    ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(3, ball.r*0.13);
    blobPath(ball.r, 1, 1, 0); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }
  const r  = ball.r;
  const sc = ball.spawning ? ball.popScale : 1.0;
  ctx.save();
  ctx.translate(ball.body.position.x, ball.body.position.y);
  if (ball.spawning) ctx.scale(sc, sc);
  applyFill(ball, r);
  softBlobPath(ball);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const _shd = ctx.createRadialGradient(0, 0, r*0.35, 0, 0, r);
  _shd.addColorStop(0,   'rgba(0,0,0,0)');
  _shd.addColorStop(0.6, 'rgba(0,0,0,0)');
  _shd.addColorStop(1.0, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = _shd; ctx.fillRect(-r*2,-r*2,r*4,r*4);
  const _glr = ctx.createRadialGradient(-r*0.38,-r*0.42,0,-r*0.3,-r*0.35,r*0.56);
  _glr.addColorStop(0,   'rgba(255,255,255,0.45)');
  _glr.addColorStop(0.55,'rgba(255,255,255,0.07)');
  _glr.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = _glr; ctx.fillRect(-r*2,-r*2,r*4,r*4);
  ctx.restore();
  if (ball.planet==='saturn') {
    ctx.strokeStyle='rgba(210,180,100,0.8)';
    ctx.lineWidth=r*0.13;
    ctx.beginPath();ctx.ellipse(0,r*0.07,r*1.55,r*0.32,0,0,6.283);ctx.stroke();
  }
  ctx.restore();
}

function drawBallStroke(ball) {
  if (ball.merging) return;
  const r  = ball.r;
  const sc = ball.spawning ? ball.popScale : 1.0;
  ctx.save();
  ctx.translate(ball.body.position.x, ball.body.position.y);
  if (ball.spawning) ctx.scale(sc, sc);
  ctx.strokeStyle='#111';
  ctx.lineWidth=Math.max(4, r*0.14);
  softBlobPath(ball);
  ctx.stroke();
  ctx.restore();
}

function drawBallFace(ball) {
  if (ball.merging || ball.faceDelay > 0) return;
  if (ball.body.speed >= 1.6) return;
  const r  = ball.r;
  const sc = ball.spawning ? ball.popScale : 1.0;
  ctx.save();
  ctx.translate(ball.body.position.x, ball.body.position.y);
  if (ball.spawning) ctx.scale(sc, sc);
  drawFace(ball, r);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — BALL AURA (tier 9 elemental glow, tier 10 planet glow)
// ═══════════════════════════════════════════════════════════
function drawBallAura(ball) {
  if (ball.merging || ball.spawning) return;
  const r  = ball.r;
  const px = ball.body.position.x, py = ball.body.position.y;
  const t  = _frameSec;
  if (ball.tier === 9 && ball.element) {
    const cfg   = ELEMENT_CFG[ball.element];
    const pulse = 0.55 + Math.sin(t * 3.8) * 0.25;
    const grd   = ctx.createRadialGradient(px, py, r*0.65, px, py, r*1.6);
    grd.addColorStop(0,   'rgba('+cfg.aura+','+(pulse*0.50)+')');
    grd.addColorStop(0.6, 'rgba('+cfg.aura+','+(pulse*0.20)+')');
    grd.addColorStop(1,   'rgba('+cfg.aura+',0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(px, py, r*1.6, 0, 6.283); ctx.fill();
  }
  if (ball.tier === 10 && ball.planet) {
    const pc    = PLANET_COLORS[ball.planet] || PLANET_COLORS.earth;
    const pulse = 0.45 + Math.sin(t * 2.4) * 0.20;
    const grd   = ctx.createRadialGradient(px, py, r*0.75, px, py, r*1.65);
    grd.addColorStop(0,   hexToRgba(pc[0], pulse*0.45));
    grd.addColorStop(0.5, hexToRgba(pc[0], pulse*0.15));
    grd.addColorStop(1,   hexToRgba(pc[0], 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(px, py, r*1.65, 0, 6.283); ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — MERGE NECK (jello bridge between merging balls)
// ═══════════════════════════════════════════════════════════
function drawMergeNeck(a, b) {
  const elapsed = Date.now() - a.mergeStartMs;
  const t = Math.min(1, elapsed / 150);
  if (t >= 0.92) return;
  const t2 = t * t;

  const ax = a.mergeFromX + (a.mergeToX - a.mergeFromX) * t2;
  const ay = a.mergeFromY + (a.mergeToY - a.mergeFromY) * t2;
  const bx = b.mergeFromX + (b.mergeToX - b.mergeFromX) * t2;
  const by = b.mergeFromY + (b.mergeToY - b.mergeFromY) * t2;

  const dx = bx - ax, dy = by - ay;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 2) return;

  const sc  = Math.max(0, 1 - t * 0.88);
  const ra  = a.r * sc, rb = b.r * sc;
  const ux  = dx / dist, uy = dy / dist;
  const px  = -uy, py = ux;

  const halfW = Math.min(ra, rb) * 0.55 * (1 - t);
  if (halfW < 0.5) return;
  const neckW = halfW * 0.38;

  const aex = ax + ux * ra * 0.75, aey = ay + uy * ra * 0.75;
  const bex = bx - ux * rb * 0.75, bey = by - uy * rb * 0.75;
  const midX = (aex + bex) / 2, midY = (aey + bey) / 2;

  const c = a.mergeColor || a.color;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.88;
  ctx.fillStyle   = (c === 'RAINBOW' || c === 'TIEDYE' || c === 'PLANET') ? '#ccc' : c;

  ctx.beginPath();
  ctx.moveTo(aex + px * halfW, aey + py * halfW);
  ctx.quadraticCurveTo(midX + px * neckW, midY + py * neckW, bex + px * halfW, bey + py * halfW);
  ctx.lineTo(bex - px * halfW, bey - py * halfW);
  ctx.quadraticCurveTo(midX - px * neckW, midY - py * neckW, aex - px * halfW, aey - py * halfW);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth   = Math.max(1.5, Math.min(ra, rb) * 0.10);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — DYING BALL (game-over animation)
// ═══════════════════════════════════════════════════════════
function drawDyingBall(ball) {
  const tick  = ball.dyingTick;
  const r     = ball.r;
  const destX = W / 2;
  const destY = H / 2;
  let px, py, spin, sc;

  if (tick <= 45) {
    // Phase 1: fly from overflow to screen center
    const t    = tick / 45;
    const ease = 1 - Math.pow(1 - t, 3);
    px   = ball.dyingFromX + (destX - ball.dyingFromX) * ease;
    py   = ball.dyingFromY + (destY - ball.dyingFromY) * ease;
    px  += Math.sin(tick * 0.38) * 14 * (1 - ease);
    spin = t * Math.PI * 0.6;
    sc   = 1.0;
  } else if (tick <= 110) {
    // Phase 2: lazy slow rotation (~1.5 turns over 65 frames)
    const t = (tick - 45) / 65;
    px   = destX; py = destY;
    spin = Math.PI * 0.6 + t * Math.PI * 3;
    sc   = 1.0;
  } else {
    // Phase 3: spin decelerates, ball zooms to 2.5x over 80 frames
    const t    = Math.min(1, (tick - 110) / 80);
    const ease = t * t * (3 - 2 * t); // smoothstep
    px   = destX; py = destY;
    spin = Math.PI * 3.6 + (1 - ease) * Math.PI * 0.8;
    sc   = 1.0 + ease * 1.5;
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(spin);
  ctx.scale(sc, sc);

  applyFill(ball, r);
  blobPath(r, 1, 1, 0); ctx.fill();

  // Inner shadow + glare
  ctx.save();
  blobPath(r, 1, 1, 0); ctx.clip();
  const _ds = ctx.createRadialGradient(r*0.3,r*0.35,0,0,0,r*1.15);
  _ds.addColorStop(0.35,'rgba(0,0,0,0)'); _ds.addColorStop(1,'rgba(0,0,0,0.30)');
  ctx.fillStyle=_ds; ctx.fillRect(-r*1.6,-r*1.6,r*3.2,r*3.2);
  ctx.restore();

  ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(3, r*0.13);
  blobPath(r, 1, 1, 0); ctx.stroke();

  // Red X eyes
  const es  = r * 0.22;
  const esp = r * 0.30;
  const eyY = -r * 0.08;
  ctx.strokeStyle='#dd1111'; ctx.lineWidth=Math.max(2.5, r*0.10); ctx.lineCap='round';
  [-esp, esp].forEach(function(ex) {
    ctx.beginPath(); ctx.moveTo(ex-es,eyY-es); ctx.lineTo(ex+es,eyY+es); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex-es,eyY+es); ctx.lineTo(ex+es,eyY-es); ctx.stroke();
  });
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — DEAD BALL GRAVEYARD (game-over screen background)
// ═══════════════════════════════════════════════════════════
function drawDeadBall(db) {
  const r = db.r;
  ctx.save();
  ctx.globalAlpha = 0.80;
  ctx.translate(db.x, db.y);
  ctx.rotate(db.angle);
  const _fb = { color:db.color, tier:db.tier, planet:db.planet, element:db.element, hueOffset:0, tieDye:null };
  applyFill(_fb, r);
  blobPath(r, 1, 1, db.seed); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.clip();
  const _shd = ctx.createRadialGradient(0,0,r*0.35,0,0,r);
  _shd.addColorStop(0,'rgba(0,0,0,0)'); _shd.addColorStop(0.6,'rgba(0,0,0,0)'); _shd.addColorStop(1,'rgba(0,0,0,0.28)');
  ctx.fillStyle=_shd; ctx.fillRect(-r,-r,r*2,r*2);
  const _glr = ctx.createRadialGradient(-r*0.38,-r*0.42,0,-r*0.3,-r*0.35,r*0.56);
  _glr.addColorStop(0,'rgba(255,255,255,0.48)'); _glr.addColorStop(0.55,'rgba(255,255,255,0.08)'); _glr.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=_glr; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.restore();
  ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(3,r*0.13);
  blobPath(r, 1, 1, db.seed); ctx.stroke();
  const es=r*0.22, esp=r*0.30, eyY=-r*0.08;
  ctx.strokeStyle='#dd1111'; ctx.lineWidth=Math.max(2.5,r*0.10); ctx.lineCap='round';
  [-esp,esp].forEach(function(ex){
    ctx.beginPath(); ctx.moveTo(ex-es,eyY-es); ctx.lineTo(ex+es,eyY+es); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex-es,eyY+es); ctx.lineTo(ex+es,eyY-es); ctx.stroke();
  });
  ctx.restore();
}
