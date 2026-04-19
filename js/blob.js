// ═══════════════════════════════════════════════════════════
//  BLOB — a soft-body is N particles on a ring, connected by
//  perimeter springs. Shape-matching (in world.js) is what makes
//  it round at rest; area pressure resists compression.
// ═══════════════════════════════════════════════════════════

const PERIM_N = 14;

function createBlob(x, y, tier) {
  const td = TIERS[tier - 1];
  const r  = td.radius;
  const particles = [];
  for (let i = 0; i < PERIM_N; i++) {
    const a  = (i / PERIM_N) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    particles.push({ x: px, y: py, px, py, fx: 0, fy: 0, angle: a, invMass: 1 });
  }
  // Adjacent-perimeter springs only — shape-matching handles everything else.
  const springs = [];
  const edgeRest = 2 * r * Math.sin(Math.PI / PERIM_N);
  for (let i = 0; i < PERIM_N; i++) {
    springs.push({ i, j: (i + 1) % PERIM_N, rest: edgeRest });
  }
  return { particles, springs, r, targetArea: Math.PI * r * r };
}

function blobCentroid(b) {
  let cx = 0, cy = 0;
  const ps = b.particles, N = ps.length;
  for (let i = 0; i < N; i++) { cx += ps[i].x; cy += ps[i].y; }
  return { x: cx / N, y: cy / N };
}

function blobArea(b) {
  const ps = b.particles, N = ps.length;
  let a = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    a += ps[i].x * ps[j].y - ps[j].x * ps[i].y;
  }
  return Math.abs(a) * 0.5;
}

function blobAABB(b) {
  const ps = b.particles;
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
    if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
  }
  return { mnx, mxx, mny, mxy };
}

function blobVelocity(b) {
  const ps = b.particles, N = ps.length;
  let vx = 0, vy = 0;
  for (let i = 0; i < N; i++) { vx += ps[i].x - ps[i].px; vy += ps[i].y - ps[i].py; }
  return { x: vx / N, y: vy / N };
}

function setBlobVelocity(b, vx, vy) {
  for (let i = 0; i < b.particles.length; i++) {
    const p = b.particles[i];
    p.px = p.x - vx; p.py = p.y - vy;
  }
}
