// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function randDropTier() {
  const total = DROP_WEIGHTS.reduce(function(a,b){ return a+b; }, 0);
  let r = Math.random() * total;
  for (let i=0; i<DROP_WEIGHTS.length; i++) {
    r -= DROP_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}
function randInt(lo, hi) { return lo + Math.floor(Math.random()*(hi-lo)); }
function lerp(a, b, t)   { return a + (b-a)*t; }

function lighten(hex, amt) {
  if (hex==='RAINBOW'||hex==='TIEDYE'||hex==='PLANET') return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n>>16)&0xff)+amt);
  const g = Math.min(255, ((n>>8) &0xff)+amt);
  const b = Math.min(255, ((n)    &0xff)+amt);
  return '#' + [r,g,b].map(function(v){ return v.toString(16).padStart(2,'0'); }).join('');
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba('+((n>>16)&0xff)+','+((n>>8)&0xff)+','+(n&0xff)+','+a+')';
}

function getBall(body) {
  for (let i=0; i<balls.length; i++) { if (balls[i].body===body) return balls[i]; }
  return null;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,   x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h, x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,   x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,     x+r,y);
  ctx.closePath();
}

// ── Contact-normal deformed blob ──────────────────────────────
// contacts: [{cx,cy,amt}]  cx/cy = unit vector TOWARD the contact surface
// Each contact pushes the ball surface INWARD at the contact angle,
// and compensates with a slight outward bulge perpendicular to it.
// squishX/squishY = impact squish applied as ellipse pre-scale.
// 32-sample polygon — smooth enough, < 0.5 ms per ball at 60 fps.
function deformedBlobPath(r, contacts, sqX, sqY, wobble, seed) {
  const N = 16;
  const s = seed || 0;
  // Directional contact squish: vertical contact → shorter+wider; horizontal → narrower+taller.
  // Normalize by sqrt(count) so stacked contacts don't over-accumulate.
  let cSX = 1.0, cSY = 1.0;
  let droopAmt = 0; // smooth bottom-droop from above-pressure
  const cn = Math.sqrt(Math.max(1, contacts.length));
  for (let j = 0; j < contacts.length; j++) {
    const c = contacts[j];
    const p = Math.min(0.36, c.amt / r) / cn;
    if (Math.abs(c.cy) >= Math.abs(c.cx)) {
      if (c.cy < -0.3) {
        cSY = Math.min(cSY, 1.0 - p * 0.88);
        cSX = Math.max(cSX, 1.0 + p * 0.55);
        droopAmt = Math.max(droopAmt, p);
      }
    } else {
      cSX = Math.min(cSX, 1.0 - p * 0.70);
      cSY = Math.max(cSY, 1.0 + p * 0.42);
    }
  }
  const eSX = sqX * cSX;
  const eSY = sqY * cSY;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a    = (i / N) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    let rx  = cosA * eSX;
    let ry  = sinA * eSY;
    let rad = Math.sqrt(rx*rx + ry*ry) * r;
    const mag = rad / r;
    const ux  = (mag > 0.001) ? rx / mag : cosA;
    const uy  = (mag > 0.001) ? ry / mag : sinA;
    // Extend toward contact point (fills gap between touching balls)
    for (let j = 0; j < contacts.length; j++) {
      const c   = contacts[j];
      const dot = ux*c.cx + uy*c.cy;
      if (dot > 0.65) rad += Math.pow(dot - 0.65, 2) * c.amt * 0.22;
    }
    // Smooth bottom droop — spreads evenly across lower hemisphere, no spike
    if (droopAmt > 0) {
      const bottomness = Math.max(0, sinA - 0.18) / 0.82;
      rad *= 1.0 + droopAmt * bottomness * 0.40;
    }
    rad += Math.sin(a * 2 + (wobble||0) * 12) * (wobble||0);
    rad += Math.sin(a * 3 + s) * r * 0.013 + Math.cos(a * 5 + s * 1.7) * r * 0.007;
    rad  = Math.max(r * 0.65, rad); // raised floor prevents whitespace flat-chord artifacts
    pts.push({ x: cosA * rad, y: sinA * rad });
  }
  // Catmull-Rom spline — smooth organic outline through the radial samples
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.closePath();
}

// Legacy wrapper (used for preview balls that have no contacts)
function blobPath(r, sqX, sqY, wobble) {
  deformedBlobPath(r, [], sqX, sqY, wobble);
}
