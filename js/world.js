// ═══════════════════════════════════════════════════════════
//  WORLD — physics step for all blobs.
//
//  Uses Verlet integration + position-based constraint projection.
//  Each frame:
//    1. accumulate forces (gravity + pressure)
//    2. integrate positions (Verlet)
//    3. iterate constraints (springs → walls → blob/blob)
//    4. damp velocities (light air drag)
//
//  Pressure keeps blobs inflated: when current area < target, push
//  each particle along its outward normal. Without this, constraint
//  projections would collapse a compressed blob.
// ═══════════════════════════════════════════════════════════

const GRAVITY           = 0.35;    // pixels / frame²
const PRESSURE_K        = 0.0009;  // outward push per unit area deficit
const CONSTRAINT_ITERS  = 5;
const VELOCITY_DAMPING  = 0.995;   // air drag (per frame)
const WALL_FRICTION     = 0.78;    // tangential velocity kept after wall hit
const BLOB_FRICTION     = 0.85;    // tangential velocity kept after blob hit
const MERGE_RATIO       = 0.85;    // merge when centroid dist < (r_a + r_b) * this

function stepWorld() {
  // ── 1. Forces ──────────────────────────────────────────────
  for (let b = 0; b < balls.length; b++) {
    const blob = balls[b];
    if (blob.merging || blob.spawning) continue;
    const pts = blob.particles;
    for (let i = 0; i < pts.length; i++) {
      pts[i].fx = 0;
      pts[i].fy = GRAVITY;
    }
    applyPressure(blob);
  }

  // ── 2. Verlet integrate ───────────────────────────────────
  for (let b = 0; b < balls.length; b++) {
    const blob = balls[b];
    if (blob.merging || blob.spawning) continue;
    const pts = blob.particles;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.invMass === 0) continue;  // pinned (e.g., wall-stuck)
      const tx = p.x, ty = p.y;
      // Verlet: next = current + (current - prev) * damping + force
      const vx = (p.x - p.px) * VELOCITY_DAMPING;
      const vy = (p.y - p.py) * VELOCITY_DAMPING;
      p.x = p.x + vx + p.fx;
      p.y = p.y + vy + p.fy;
      p.px = tx;
      p.py = ty;
    }
  }

  // ── 3. Constraint projection (iterated) ───────────────────
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    // Springs
    for (let b = 0; b < balls.length; b++) {
      const blob = balls[b];
      if (blob.merging || blob.spawning) continue;
      const pts = blob.particles, springs = blob.springs;
      for (let s = 0; s < springs.length; s++) {
        const sp = springs[s];
        satisfySpring(pts[sp.i], pts[sp.j], sp.rest, sp.k);
      }
    }
    // Walls (container + extra walls from ability)
    for (let b = 0; b < balls.length; b++) {
      const blob = balls[b];
      if (blob.merging || blob.spawning) continue;
      const pts = blob.particles;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.invMass === 0) continue;
        for (let w = 0; w < walls.length; w++) collideWall(p, walls[w]);
        for (let w = 0; w < extraWalls.length; w++) collideWall(p, extraWalls[w]);
      }
    }
    // Blob ↔ blob
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].merging || balls[i].spawning) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].merging || balls[j].spawning) continue;
        collideBlobs(balls[i], balls[j]);
      }
    }
  }
}

// ── Pressure ──────────────────────────────────────────────
// For a clockwise polygon in y-down canvas, the outward normal of
// the edge from particle (i-1) to (i+1) is (dy, -dx). Pressure force
// is scaled by area deficit; acts only when the blob is compressed.
function applyPressure(blob) {
  const pts = blob.particles;
  const N = pts.length;
  const area = blobArea(blob);
  const deficit = blob.targetArea - area;
  if (deficit <= 0) return;
  const k = PRESSURE_K * deficit;
  for (let i = 0; i < N; i++) {
    const prev = pts[(i - 1 + N) % N];
    const next = pts[(i + 1) % N];
    const ex = next.x - prev.x;
    const ey = next.y - prev.y;
    const len = Math.sqrt(ex*ex + ey*ey) || 1;
    pts[i].fx += (ey / len) * k;
    pts[i].fy += (-ex / len) * k;
  }
}

// ── Spring constraint (PBD projection) ───────────────────
// Moves each endpoint fractionally toward rest length, weighted by
// inverse mass. `k ∈ (0, 1]` controls stiffness — higher per-iteration
// k plus more iterations = stiffer spring.
function satisfySpring(pa, pb, rest, k) {
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 0.0001;
  const wa = pa.invMass, wb = pb.invMass;
  const w  = wa + wb;
  if (w === 0) return;
  const diff = k * (d - rest) / d;
  const fa   = wa / w, fb = wb / w;
  pa.x += dx * fa * diff;
  pa.y += dy * fa * diff;
  pb.x -= dx * fb * diff;
  pb.y -= dy * fb * diff;
}

// ── Wall collision ────────────────────────────────────────
// Wall inside-face line passes through (x1,y1) with inward-pointing
// unit normal (nx,ny). Signed distance > 0 means particle is inside
// the container; < 0 means it has crossed into the wall and must be
// pushed back. On contact, apply tangential friction by nudging the
// prev-position so Verlet reads a reduced tangential velocity.
function collideWall(p, wall) {
  const signed = (p.x - wall.x1) * wall.nx + (p.y - wall.y1) * wall.ny;
  if (signed >= 0) return;
  // Push out to wall surface
  p.x -= wall.nx * signed;
  p.y -= wall.ny * signed;
  // Friction: keep normal velocity, dampen tangential
  const vx = p.x - p.px, vy = p.y - p.py;
  const vn = vx * wall.nx + vy * wall.ny;
  const tx = vx - vn * wall.nx;
  const ty = vy - vn * wall.ny;
  p.px = p.x - (tx * WALL_FRICTION + vn * wall.nx);
  p.py = p.y - (ty * WALL_FRICTION + vn * wall.ny);
}

// ── Blob ↔ blob collision ─────────────────────────────────
// For each particle of one blob that lies inside the other's polygon,
// push it out along the nearest edge's outward normal. Both sides
// move (particle out, edge endpoints in) so the contact deforms both
// blobs naturally — no fake squash needed.
function collideBlobs(A, B) {
  const aabbA = blobAABB(A);
  const aabbB = blobAABB(B);
  if (aabbA.maxX < aabbB.minX || aabbA.minX > aabbB.maxX ||
      aabbA.maxY < aabbB.minY || aabbA.minY > aabbB.maxY) return;
  collideParticlesVsPolygon(A.particles, B.particles);
  collideParticlesVsPolygon(B.particles, A.particles);
}

function collideParticlesVsPolygon(particles, poly) {
  const N = poly.length;
  for (let pi = 0; pi < particles.length; pi++) {
    const p = particles[pi];
    if (p.invMass === 0) continue;
    if (!pointInPolygon(p, poly)) continue;

    // Find nearest edge of the enclosing polygon.
    let bestD = Infinity, bestNx = 0, bestNy = 0, bestEdgeI = 0, bestT = 0;
    for (let i = 0; i < N; i++) {
      const a = poly[i], b = poly[(i + 1) % N];
      const ex = b.x - a.x, ey = b.y - a.y;
      const elen2 = ex*ex + ey*ey;
      if (elen2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / elen2));
      const qx = a.x + t * ex, qy = a.y + t * ey;
      const dx = p.x - qx,    dy = p.y - qy;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD) {
        const elen = Math.sqrt(elen2);
        bestD   = d;
        bestNx  = ey / elen;      // outward normal (CW polygon)
        bestNy  = -ex / elen;
        bestEdgeI = i;
        bestT     = t;
      }
    }
    if (bestD === Infinity) continue;

    // Split correction between the intruding particle and the edge's
    // endpoints (barycentric-weighted by t).
    const eA = poly[bestEdgeI];
    const eB = poly[(bestEdgeI + 1) % N];
    const wP  = p.invMass;
    const wEA = eA.invMass * (1 - bestT);
    const wEB = eB.invMass * bestT;
    const wSum = wP + wEA + wEB;
    if (wSum === 0) continue;
    const push = bestD + 0.01;
    const pShare  = push * wP  / wSum;
    const eAShare = push * wEA / wSum;
    const eBShare = push * wEB / wSum;
    p.x  += bestNx * pShare;
    p.y  += bestNy * pShare;
    eA.x -= bestNx * eAShare;
    eA.y -= bestNy * eAShare;
    eB.x -= bestNx * eBShare;
    eB.y -= bestNy * eBShare;

    // Tangential friction — damp the sliding component of velocity.
    const vx = p.x - p.px, vy = p.y - p.py;
    const vn = vx * bestNx + vy * bestNy;
    const tx = vx - vn * bestNx, ty = vy - vn * bestNy;
    p.px = p.x - (tx * BLOB_FRICTION + vn * bestNx);
    p.py = p.y - (ty * BLOB_FRICTION + vn * bestNy);
  }
}

// Crossing-number test — standard ray-cast point-in-polygon.
function pointInPolygon(p, poly) {
  let inside = false;
  const N = poly.length;
  for (let i = 0, j = N - 1; i < N; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// ── Merge detection ───────────────────────────────────────
// Real overlap, not a radius hack: same-tier blobs whose centroids
// are within MERGE_OVERLAP × min(r_a, r_b) are merging. By then the
// blobs are visibly fused.
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
