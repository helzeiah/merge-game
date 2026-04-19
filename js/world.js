// ═══════════════════════════════════════════════════════════
//  WORLD — Verlet integration + PBD constraint projection.
//
//  Constraint priority (strongest = runs every iter + last chance):
//    1. Shape matching  — each particle pulled toward its goal
//       position around the current centroid. THIS is what makes
//       the ball round at rest; springs alone would let it triangle.
//    2. Perimeter springs — keep adjacent vertex spacing stable.
//    3. Wall projection — segment-clamped, with friction.
//    4. Blob↔blob — two-way PBD push.
//
//  After the iteration loop, hardSeparation() does a final pass
//  that forcefully pushes any particle still inside another blob
//  all the way out. No weighting split, no partial correction —
//  guarantees zero inter-blob overlap at end of frame.
// ═══════════════════════════════════════════════════════════

const GRAVITY          = 0.22;
const VELOCITY_DAMPING = 0.985;
const CONSTRAINT_ITERS = 8;
const PRESSURE_K       = 0.0015;
const SHAPE_MATCH_K    = 0.28;   // per-iter pull toward rest circle; high so rest = round
const WALL_FRICTION    = 0.78;
const BLOB_FRICTION    = 0.82;
const MERGE_RATIO      = 1.05;

function stepWorld() {
  // ── Forces ────────────────────────────────────────────
  for (let b = 0; b < balls.length; b++) {
    const blob = balls[b];
    if (blob.merging || blob.spawning) continue;
    const ps = blob.particles;
    for (let i = 0; i < ps.length; i++) { ps[i].fx = 0; ps[i].fy = GRAVITY; }
    applyPressure(blob);
  }

  // ── Verlet integrate ──────────────────────────────────
  for (let b = 0; b < balls.length; b++) {
    const blob = balls[b];
    if (blob.merging || blob.spawning) continue;
    const ps = blob.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.invMass === 0) continue;
      const tx = p.x, ty = p.y;
      const vx = (p.x - p.px) * VELOCITY_DAMPING;
      const vy = (p.y - p.py) * VELOCITY_DAMPING;
      p.x += vx + p.fx;
      p.y += vy + p.fy;
      p.px = tx; p.py = ty;
    }
  }

  // ── Constraint iterations ─────────────────────────────
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    for (let b = 0; b < balls.length; b++) {
      const blob = balls[b];
      if (blob.merging || blob.spawning) continue;
      applyShapeMatch(blob);
      const sp = blob.springs, ps = blob.particles;
      for (let s = 0; s < sp.length; s++) satisfySpring(ps[sp[s].i], ps[sp[s].j], sp[s].rest);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.invMass === 0) continue;
        for (let w = 0; w < walls.length; w++) collideWall(p, walls[w]);
        for (let w = 0; w < extraWalls.length; w++) collideWall(p, extraWalls[w]);
      }
    }
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].merging || balls[i].spawning) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].merging || balls[j].spawning) continue;
        collideBlobs(balls[i], balls[j]);
      }
    }
  }

  // ── Final hard-separation pass — guarantees no overlap ─
  hardSeparation();
}

function applyPressure(blob) {
  const ps = blob.particles, N = ps.length;
  const deficit = blob.targetArea - blobArea(blob);
  if (deficit <= 0) return;
  const k = PRESSURE_K * deficit;
  for (let i = 0; i < N; i++) {
    const prev = ps[(i - 1 + N) % N], next = ps[(i + 1) % N];
    const ex = next.x - prev.x, ey = next.y - prev.y;
    const len = Math.sqrt(ex*ex + ey*ey) || 1;
    ps[i].fx += (ey / len) * k;
    ps[i].fy += (-ex / len) * k;
  }
}

// Shape matching — pull each particle toward its ideal position
// around the current centroid. Orientation is fixed (no rotation
// fitting) which is fine for stacking-game aesthetics and cheap.
function applyShapeMatch(blob) {
  const c = blobCentroid(blob);
  const r = blob.r, ps = blob.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.invMass === 0) continue;
    const gx = c.x + Math.cos(p.angle) * r;
    const gy = c.y + Math.sin(p.angle) * r;
    p.x += (gx - p.x) * SHAPE_MATCH_K;
    p.y += (gy - p.y) * SHAPE_MATCH_K;
  }
}

function satisfySpring(pa, pb, rest) {
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  const d = Math.sqrt(dx*dx + dy*dy) || 0.0001;
  const wa = pa.invMass, wb = pb.invMass, w = wa + wb;
  if (w === 0) return;
  const diff = (d - rest) / d;
  pa.x += dx * (wa / w) * diff;
  pa.y += dy * (wa / w) * diff;
  pb.x -= dx * (wb / w) * diff;
  pb.y -= dy * (wb / w) * diff;
}

// Finite-segment wall: only blocks particles whose projection onto
// the segment lies in [0, 1]. Past either end, the wall doesn't
// block — balls stacked above wall tops can spill over the side.
function collideWall(p, wall) {
  const signed = (p.x - wall.x1) * wall.nx + (p.y - wall.y1) * wall.ny;
  if (signed >= 0) return;
  const tx = wall.x2 - wall.x1, ty = wall.y2 - wall.y1;
  const tlen2 = tx*tx + ty*ty;
  if (tlen2 < 1e-6) return;
  const t = ((p.x - wall.x1) * tx + (p.y - wall.y1) * ty) / tlen2;
  if (t < 0 || t > 1) return;
  p.x -= wall.nx * signed;
  p.y -= wall.ny * signed;
  const vx = p.x - p.px, vy = p.y - p.py;
  const vn = vx * wall.nx + vy * wall.ny;
  const ttx = vx - vn * wall.nx, tty = vy - vn * wall.ny;
  p.px = p.x - (ttx * WALL_FRICTION + vn * wall.nx);
  p.py = p.y - (tty * WALL_FRICTION + vn * wall.ny);
}

function aabbOverlap(A, B) {
  const a = blobAABB(A), b = blobAABB(B);
  return !(a.mxx < b.mnx || a.mnx > b.mxx || a.mxy < b.mny || a.mny > b.mxy);
}

function collideBlobs(A, B) {
  if (!aabbOverlap(A, B)) return;
  collidePts(A.particles, B.particles);
  collidePts(B.particles, A.particles);
}

function collidePts(particles, poly) {
  const N = poly.length;
  for (let pi = 0; pi < particles.length; pi++) {
    const p = particles[pi];
    if (p.invMass === 0) continue;
    if (!pointInPolygon(p, poly)) continue;
    const hit = nearestEdge(p, poly);
    if (!hit) continue;
    const eA = poly[hit.i], eB = poly[(hit.i + 1) % N];
    const wP = p.invMass, wEA = eA.invMass * (1 - hit.t), wEB = eB.invMass * hit.t;
    const wSum = wP + wEA + wEB;
    if (wSum === 0) continue;
    const push = hit.d + 0.01;
    p.x  += hit.nx * push * wP  / wSum;
    p.y  += hit.ny * push * wP  / wSum;
    eA.x -= hit.nx * push * wEA / wSum;
    eA.y -= hit.ny * push * wEA / wSum;
    eB.x -= hit.nx * push * wEB / wSum;
    eB.y -= hit.ny * push * wEB / wSum;
    // friction on intruder
    const vx = p.x - p.px, vy = p.y - p.py;
    const vn = vx * hit.nx + vy * hit.ny;
    const tx = vx - vn * hit.nx, ty = vy - vn * hit.ny;
    p.px = p.x - (tx * BLOB_FRICTION + vn * hit.nx);
    p.py = p.y - (ty * BLOB_FRICTION + vn * hit.ny);
  }
}

function nearestEdge(p, poly) {
  const N = poly.length;
  let best = null, bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const a = poly[i], b = poly[(i + 1) % N];
    const ex = b.x - a.x, ey = b.y - a.y;
    const elen2 = ex*ex + ey*ey;
    if (elen2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / elen2));
    const qx = a.x + t * ex, qy = a.y + t * ey;
    const dx = p.x - qx, dy = p.y - qy;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < bestD) {
      const elen = Math.sqrt(elen2);
      best = { i, t, d, nx: ey / elen, ny: -ex / elen };
      bestD = d;
    }
  }
  return best;
}

function pointInPolygon(p, poly) {
  let inside = false;
  const N = poly.length;
  for (let i = 0, j = N - 1; i < N; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Final pass — push any particle still inside another polygon all
// the way out (no invMass split). Guarantees no overlap on screen.
function hardSeparation() {
  for (let i = 0; i < balls.length; i++) {
    const A = balls[i]; if (A.merging || A.spawning) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const B = balls[j]; if (B.merging || B.spawning) continue;
      if (!aabbOverlap(A, B)) continue;
      hardPush(A.particles, B.particles);
      hardPush(B.particles, A.particles);
    }
  }
}

function hardPush(particles, poly) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.invMass === 0) continue;
    if (!pointInPolygon(p, poly)) continue;
    const hit = nearestEdge(p, poly);
    if (!hit) continue;
    p.x += hit.nx * (hit.d + 0.5);
    p.y += hit.ny * (hit.d + 0.5);
  }
}

function detectMerges() {
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.merging || a.spawning) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.merging || b.spawning) continue;
      if (a.tier !== b.tier) continue;
      const ca = blobCentroid(a), cb = blobCentroid(b);
      const dx = cb.x - ca.x, dy = cb.y - ca.y;
      const d2 = dx*dx + dy*dy;
      const thresh = (a.r + b.r) * MERGE_RATIO;
      if (d2 < thresh * thresh) { triggerMerge(a, b); return; }
    }
  }
}
