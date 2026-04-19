// ═══════════════════════════════════════════════════════════
//  CONTAINER GEOMETRY — each wall is a finite line segment with
//  an inward-pointing unit normal. That's all collision needs.
//  Drawing uses (cx, cy, w, h, angle) for the striped rectangle.
// ═══════════════════════════════════════════════════════════

const CX        = W / 2;
const wallThick = 24;
const wallAngle = 0.15;
const cW        = Math.min(W * 0.72, 300);
const wallH     = cW * 0.78;
const floorW    = cW * 0.72;
const cBottom   = H * 0.80;
const cTop      = cBottom - wallH;
const dropZoneY = cTop - 200;

const wallOffset = Math.sin(wallAngle) * wallH * 0.5;
const lWallX     = CX - floorW * 0.5 - wallOffset;
const rWallX     = CX + floorW * 0.5 + wallOffset;
const wallCY     = cBottom - wallH * 0.5;

function makeWall(cx, cy, w, h, angle, interior) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  let x1, y1, x2, y2, nxL, nyL;
  if (interior === 'right' || interior === 'left') {
    const lx = interior === 'right' ? w / 2 : -w / 2;
    x1 = cx + lx * ca - (-h / 2) * sa;
    y1 = cy + lx * sa + (-h / 2) * ca;
    x2 = cx + lx * ca - ( h / 2) * sa;
    y2 = cy + lx * sa + ( h / 2) * ca;
    nxL = interior === 'right' ? 1 : -1; nyL = 0;
  } else {
    const ly = interior === 'bottom' ? h / 2 : -h / 2;
    x1 = cx + (-w / 2) * ca - ly * sa;
    y1 = cy + (-w / 2) * sa + ly * ca;
    x2 = cx + ( w / 2) * ca - ly * sa;
    y2 = cy + ( w / 2) * sa + ly * ca;
    nxL = 0; nyL = interior === 'bottom' ? 1 : -1;
  }
  return {
    x1, y1, x2, y2,
    nx: nxL * ca - nyL * sa,
    ny: nxL * sa + nyL * ca,
    cx, cy, w, h, angle,
  };
}

let walls = [
  makeWall(lWallX, wallCY, wallThick, wallH,    -wallAngle, 'right'),
  makeWall(rWallX, wallCY, wallThick, wallH,     wallAngle, 'left'),
  makeWall(CX,     cBottom, floorW,   wallThick, 0,         'top'),
];

let extraWalls = [];
