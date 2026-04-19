// ═══════════════════════════════════════════════════════════
//  HELPERS — small math + color + DOM utilities
// ═══════════════════════════════════════════════════════════
function randDropTier() {
  const total = DROP_WEIGHTS.reduce(function(a,b){ return a+b; }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    r -= DROP_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}
function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo)); }
function lerp(a, b, t)   { return a + (b - a) * t; }

function lighten(hex, amt) {
  if (hex === 'RAINBOW' || hex === 'TIEDYE' || hex === 'PLANET') return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8)  & 0xff) + amt);
  const b = Math.min(255, ((n)       & 0xff) + amt);
  return '#' + [r, g, b].map(function(v){ return v.toString(16).padStart(2, '0'); }).join('');
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 0xff) + ',' + ((n >> 8) & 0xff) + ',' + (n & 0xff) + ',' + a + ')';
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
