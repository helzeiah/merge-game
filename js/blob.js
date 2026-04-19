// ═══════════════════════════════════════════════════════════
//  BLOB — a soft-body is N particles around a perimeter, connected
//         by springs. Its visual IS its physical shape: when the
//         perimeter deforms, collision and rendering both see it.
// ═══════════════════════════════════════════════════════════

const BLOB_N = 12;   // perimeter particle count — higher = smoother + more collision cost

// Build the particle ring + springs for a new blob centered at (x, y).
// Each particle: { x, y, px, py, fx, fy, invMass }
//   (px, py) = previous position — Verlet integrates from (x - px, y - py).
//   invMass = 0 means pinned (e.g., balls stuck in extra walls).
function createBlob(x, y, tier) {
  const td = TIERS[tier - 1];
  const r  = td.radius;

  // Ring of particles — start at top (-π/2), go clockwise in screen space (y-down).
  const particles = [];
  for (let i = 0; i < BLOB_N; i++) {
    const a  = (i / BLOB_N) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    particles.push({ x: px, y: py, px, py, fx: 0, fy: 0, invMass: 1 });
  }

  // Springs: a dense cross-mesh (every particle to every other within N/2)
  // so the only low-energy shape is a regular 12-gon. Without this the
  // perimeter-only graph has many equal-perimeter degenerate shapes
  // (triangles, peanuts, bananas) that balls collapse into under pressure.
  //
  // Stiffness decreases with "skip distance" so close springs dominate
  // shape, farther springs resist overall deformation.
  const springs = [];
  const stiffness = [0, 1.00, 0.75, 0.60, 0.50, 0.45, 0.40]; // index = skip
  const maxSkip = Math.floor(BLOB_N / 2);
  for (let skip = 1; skip <= maxSkip; skip++) {
    // At skip = N/2 each pair appears once; at smaller skips, once per particle.
    const limit = (skip === maxSkip) ? BLOB_N / 2 : BLOB_N;
    for (let i = 0; i < limit; i++) {
      const j  = (i + skip) % BLOB_N;
      const dx = particles[j].x - particles[i].x;
      const dy = particles[j].y - particles[i].y;
      springs.push({ i, j, rest: Math.sqrt(dx*dx + dy*dy), k: stiffness[skip] });
    }
  }

  return {
    particles, springs,
    tier, r,
    color: td.color,
    mass: Math.PI * r * r,           // 2D "mass" = area — used for merge weighting
    targetArea: Math.PI * r * r,     // pressure pushes area back toward this

    // Game state (preserved from original ball struct)
    merging:    false,
    mergePair:  null,
    spawning:   true,
    spawnTick:  0,
    popScale:   0.1,
    wobble:     0,
    seed:       Math.random() * 6.28,
    faceDelay:  40,
    eyeX: 0.15, eyeY: 0, eyeTargetX: 0.15, eyeTargetY: 0,
    hueOffset:  0,
    expression: tier === 9  ? EXPRESSIONS[randInt(0, EXPRESSIONS.length)] : (tier === 10 ? 'stoic' : null),
    planet:     tier === 10 ? PLANETS[randInt(0, PLANETS.length)] : null,
    element:    tier === 9  ? ELEMENTS[randInt(0, ELEMENTS.length)] : null,
    tieDye:     null,
    isWallStuck: false,

    // Merge animation bookkeeping (set when merging starts)
    mergeFromX: 0, mergeFromY: 0, mergeToX: 0, mergeToY: 0,
    mergeStartMs: 0, mergeColor: null,
  };
}

// Geometric arithmetic — centroid, signed area, AABB, averaged velocity.
// Area uses the shoelace formula (absolute — sign depends on winding).
function blobCentroid(blob) {
  let cx = 0, cy = 0;
  const pts = blob.particles, N = pts.length;
  for (let i = 0; i < N; i++) { cx += pts[i].x; cy += pts[i].y; }
  return { x: cx / N, y: cy / N };
}

function blobArea(blob) {
  const pts = blob.particles, N = pts.length;
  let a = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) * 0.5;
}

function blobAABB(blob) {
  const pts = blob.particles;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function blobVelocity(blob) {
  const pts = blob.particles, N = pts.length;
  let vx = 0, vy = 0;
  for (let i = 0; i < N; i++) {
    vx += pts[i].x - pts[i].px;
    vy += pts[i].y - pts[i].py;
  }
  return { x: vx / N, y: vy / N };
}

// Set the averaged velocity of the blob — offsets each particle's prev
// position so Verlet infers the new velocity. Used for initial drop,
// merge spawn upward impulse, quake ability.
function setBlobVelocity(blob, vx, vy) {
  const pts = blob.particles;
  for (let i = 0; i < pts.length; i++) {
    pts[i].px = pts[i].x - vx;
    pts[i].py = pts[i].y - vy;
  }
}
