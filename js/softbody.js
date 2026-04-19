// ═══════════════════════════════════════════════════════════
//  SOFT BODY  — spring-mass jello balls with contact deformation
// ═══════════════════════════════════════════════════════════

function restPt(r, i, N) {
  const a = (i / N) * Math.PI * 2;
  // Oblate spheroid shifted down — wider than tall, center of mass below geometry center
  return { x: Math.cos(a) * r * 1.08, y: Math.sin(a) * r * 0.88 + r * 0.09 };
}

function initSoftBody(ball) {
  const r = ball.r;
  ball.pts = [];
  for (let i = 0; i < SOFT_N; i++) {
    const rp = restPt(r, i, SOFT_N);
    ball.pts.push({ ox: rp.x, oy: rp.y, vx: 0, vy: 0 });
  }
}

function snapSoftBody(ball) {
  if (!ball.pts) { initSoftBody(ball); return; }
  const r = ball.r;
  for (let i = 0; i < SOFT_N; i++) {
    const rp = restPt(r, i, SOFT_N);
    ball.pts[i].ox = lerp(ball.pts[i].ox, rp.x, 0.30);
    ball.pts[i].oy = lerp(ball.pts[i].oy, rp.y, 0.30);
    ball.pts[i].vx = 0; ball.pts[i].vy = 0;
  }
}

function applySoftImpulse(ball, nx, ny, impulse) {
  if (!ball.pts) initSoftBody(ball);
  const N = SOFT_N, r = ball.r;
  // Find point closest to impact direction
  let bestIdx = 0, bestDot = -Infinity;
  for (let i = 0; i < N; i++) {
    const rp = restPt(r, i, N);
    const d = Math.sqrt(rp.x*rp.x + rp.y*rp.y) || 1;
    const dot = (rp.x/d)*nx + (rp.y/d)*ny;
    if (dot > bestDot) { bestDot = dot; bestIdx = i; }
  }
  const mag = Math.min(impulse * r * 4.5, r * 0.55);
  for (let di = -2; di <= 2; di++) {
    const idx = (bestIdx + di + N) % N;
    const w   = Math.max(0, 1.0 - Math.abs(di) * 0.44);
    ball.pts[idx].vx -= nx * mag * w;
    ball.pts[idx].vy -= ny * mag * w;
  }
}

function stepSoftBody(ball) {
  if (!ball.pts) { initSoftBody(ball); return; }
  if (ball.merging || ball.spawning) { snapSoftBody(ball); return; }
  const N = SOFT_N, r = ball.r;
  // Rest length based on oblate perimeter spacing
  const restLen = 2 * r * 1.04 * Math.sin(Math.PI / N);
  const bMap = bodyContacts[ball.body.id] || {};
  const bvx = ball.body.velocity.x, bvy = ball.body.velocity.y;
  const bodySpeed = ball.body.speed;

  for (let i = 0; i < N; i++) {
    const p  = ball.pts[i];
    const rp = restPt(r, i, N);

    // Start with oblate rest target (already droopy/gravity-sagged by shape)
    let tx = rp.x, ty = rp.y;

    // Velocity stretch: elongate in travel direction
    if (bodySpeed > 1.2) {
      const bvs = bodySpeed;
      const uvx = bvx/bvs, uvy = bvy/bvs;
      const ca = rp.x / (Math.sqrt(rp.x*rp.x+rp.y*rp.y)||r);
      const sa = rp.y / (Math.sqrt(rp.x*rp.x+rp.y*rp.y)||r);
      const along = ca*uvx + sa*uvy;
      const strV = Math.min(bodySpeed * r * 0.030, r * 0.28);
      tx += uvx * along * strV;
      ty += uvy * along * strV;
    }

    // Contact deformation: compress face inward, expand perpendicular outward
    Object.keys(bMap).forEach(function(otherId) {
      const c = bMap[otherId];
      if (c.om >= 1e6) return;
      const massRatio = Math.min(3.5, (c.om || 0.001) / (ball.body.mass || 0.001));
      const press = Math.min(r * 0.24 * Math.sqrt(massRatio), r * 0.36);
      const ca = rp.x / (Math.sqrt(rp.x*rp.x+rp.y*rp.y)||r);
      const sa = rp.y / (Math.sqrt(rp.x*rp.x+rp.y*rp.y)||r);
      const dot = ca*c.nx + sa*c.ny;
      const dPos = Math.max(0, dot);
      // Compress along contact normal at the contact face
      tx -= c.nx * press * dPos * dPos * 0.8;
      ty -= c.ny * press * dPos * dPos * 0.8;
      // Expand perpendicular — outward from ball center (eliminates gap)
      const dist = Math.sqrt(p.ox*p.ox + p.oy*p.oy) || r;
      const ux = p.ox/dist, uy = p.oy/dist;
      const perpW = Math.max(0, 1.0 - dPos*dPos) * (dot > -0.1 ? 1 : 0);
      tx += ux * press * perpW * 0.65;
      ty += uy * press * perpW * 0.65;
    });

    // Clamp target to prevent degenerate spline paths
    const td = Math.sqrt(tx*tx + ty*ty) || 0.001;
    if (td > r * 1.55) { tx = (tx/td)*r*1.55; ty = (ty/td)*r*1.55; }
    if (td < r * 0.46) { tx = (tx/td)*r*0.46; ty = (ty/td)*r*0.46; }

    // Spring toward target (jelly feel: inertia + spring = oscillation)
    p.vx += (tx - p.ox) * 0.16;
    p.vy += (ty - p.oy) * 0.16;

    // Neighbor springs (keep blob coherent)
    [-1, 1].forEach(function(di) {
      const nb  = ball.pts[(i + di + N) % N];
      const ndx = p.ox - nb.ox, ndy = p.oy - nb.oy;
      const nd  = Math.sqrt(ndx*ndx + ndy*ndy) || 0.001;
      p.vx -= (ndx / nd) * (nd - restLen) * 0.07;
      p.vy -= (ndy / nd) * (nd - restLen) * 0.07;
    });

    p.vx *= 0.72; p.vy *= 0.72;
    p.ox += p.vx; p.oy += p.vy;

    // Hard clamp — prevents self-intersecting spline paths
    const cd = Math.sqrt(p.ox*p.ox + p.oy*p.oy) || 0.001;
    if      (cd > r * 1.56) { p.ox = (p.ox/cd)*r*1.56; p.oy = (p.oy/cd)*r*1.56; }
    else if (cd < r * 0.44) { p.ox = (p.ox/cd)*r*0.44; p.oy = (p.oy/cd)*r*0.44; }
  }
}

// Draw blob using offset points (already in local/body-relative space)
function softBlobPath(ball) {
  if (!ball.pts) initSoftBody(ball);
  const pts = ball.pts, N = pts.length, r = ball.r;
  // Snap degenerate blobs before drawing — prevents invisible balls from self-intersecting splines
  for (let _i = 0; _i < N; _i++) {
    const _d = Math.sqrt(pts[_i].ox*pts[_i].ox + pts[_i].oy*pts[_i].oy);
    if (_d > r * 1.72 || _d < r * 0.28) { snapSoftBody(ball); break; }
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].ox, pts[0].oy);
  for (let i = 0; i < N; i++) {
    const i0 = (i-1+N)%N, i2 = (i+1)%N, i3 = (i+2)%N;
    const cp1x = pts[i].ox  + (pts[i2].ox - pts[i0].ox) / 6;
    const cp1y = pts[i].oy  + (pts[i2].oy - pts[i0].oy) / 6;
    const cp2x = pts[i2].ox - (pts[i3].ox - pts[i].ox)  / 6;
    const cp2y = pts[i2].oy - (pts[i3].oy - pts[i].oy)  / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pts[i2].ox, pts[i2].oy);
  }
  ctx.closePath();
}
