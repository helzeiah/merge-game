// ═══════════════════════════════════════════════════════════
//  BALL — top-level lifecycle (create, merge, spawn new on merge).
//
//  "Ball" in this file = a blob. The name is kept for continuity
//  with the rest of the game's API (balls[] list, createBall, etc.).
// ═══════════════════════════════════════════════════════════

function createBall(x, y, tier, vy) {
  vy = vy || 0;
  const blob = createBlob(x, y, tier);
  if (vy !== 0) setBlobVelocity(blob, 0, vy);
  balls.push(blob);
  seenTiers.add(tier);
  if (tier === 9  && !hasTieDye) hasTieDye = true;
  if (tier === 10 && !hasPlanet) hasPlanet = true;
  return blob;
}

// ═══════════════════════════════════════════════════════════
//  MERGE — visual animation + spawn new blob after 150ms
// ═══════════════════════════════════════════════════════════
function emitMergeSparks(mx, my, color) {
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

  // Centroids at merge start — physics stops from here; render animates.
  const ca = blobCentroid(a), cb = blobCentroid(b);
  const va = blobVelocity(a),  vb = blobVelocity(b);

  // Bias merge midpoint 60% toward the faster-falling blob (the dropper).
  const aFalling = va.y >= vb.y;
  const mx = aFalling ? ca.x * 0.60 + cb.x * 0.40 : cb.x * 0.60 + ca.x * 0.40;
  const my = aFalling ? ca.y * 0.60 + cb.y * 0.40 : cb.y * 0.60 + ca.y * 0.40;
  const avx = (va.x + vb.x) * 0.5;
  const nt  = Math.min(a.tier + 1, 10);
  seenTiers.add(nt);

  const now  = Date.now();
  const base = TIER_SCORES[nt];
  let mult   = 1.0;
  if (now - lastMergeMs < 1500) {
    comboCount++;
    if (comboCount === 2) { mult = 1.2;  comboLabel = 'Combo!';   comboColor = '#FFE84A'; }
    if (comboCount >= 3)  { mult = 1.44; comboLabel = 'INSANE!!'; comboColor = '#4AFFFF'; }
  } else {
    comboCount = 1; comboLabel = '';
  }
  lastMergeMs = now;
  comboTimer  = 90;
  playSlosh(nt);
  playChime(nt, comboCount);
  const earned = Math.round(base * mult);
  score += earned;
  if (score > bestScore) bestScore = score;
  popups.push({ x: mx, y: my - 20, text: '+' + earned, life: 1.0,
                color: comboCount > 1 ? '#FFE84A' : '#fff', combo: comboCount > 1 });

  // Animation state — render uses these to animate the shrinking,
  // flying merge circles from their current centroids toward midpoint.
  const mergeColor = TIERS[nt - 1] ? TIERS[nt - 1].color : a.color;
  a.mergeFromX = ca.x; a.mergeFromY = ca.y;
  b.mergeFromX = cb.x; b.mergeFromY = cb.y;
  a.mergeToX = mx; a.mergeToY = my;
  b.mergeToX = mx; b.mergeToY = my;
  a.mergeStartMs = now; b.mergeStartMs = now;
  a.mergeColor   = mergeColor;
  b.mergeColor   = mergeColor;

  setTimeout(function() {
    balls = balls.filter(function(bb) { return bb !== a && bb !== b; });
    if (nt >= 5) emitMergeSparks(mx, my, mergeColor);
    if (nt > 10) return;
    const nb = createBall(mx, my, nt, -2);
    setBlobVelocity(nb, avx * 0.5, -2);
  }, 150);
}
