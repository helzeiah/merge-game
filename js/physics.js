// ═══════════════════════════════════════════════════════════
//  CONTAINER GEOMETRY
//
//  Defines the layout (CX, wall positions, drop zone). Each wall is
//  a line segment with an inward-pointing unit normal — that's all
//  the collision system needs. The drawing code uses the wall's
//  rectangle shape (cx, cy, w, h, angle) for the striped render.
// ═══════════════════════════════════════════════════════════

const CX        = W / 2;
const wallThick = 24;
const wallAngle = 0.15;
const cW        = Math.min(W * 0.86, 360);
const wallH     = cW * 0.68;
const floorW    = cW * 0.72;
const cBottom   = H * 0.80;
const cTop      = cBottom - wallH;
const dropZoneY = cTop - 200;

const wallOffset = Math.sin(wallAngle) * wallH * 0.5;
const lWallX     = CX - floorW * 0.5 - wallOffset;
const rWallX     = CX + floorW * 0.5 + wallOffset;
const wallCY     = cBottom - wallH * 0.5;

// Build the inside-face line segment of a rectangular wall rotated
// around its center. The inside face is at local (+halfW, y) — the
// side of the rectangle facing the container interior.
//
// For the left wall (tilted by -wallAngle), the interior is on the
// local +x side.  For the right wall (tilted +wallAngle), it's -x.
// For the floor, the interior is on -y.
//
// Returns:
//   { x1, y1, x2, y2,  // endpoints of the inside face
//     nx, ny,          // unit inward normal
//     cx, cy, w, h, angle }  // rectangle metadata for drawing
function makeWall(cx, cy, w, h, angle, interiorSide) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  // Local-frame x offset of the inside face: +w/2 (right) or -w/2 (left)
  // depending on which side is interior. In local frame, the face runs
  // from (localX, -h/2) to (localX, +h/2).
  let lx;
  if (interiorSide === 'right')       lx =  w / 2;
  else if (interiorSide === 'left')   lx = -w / 2;
  else if (interiorSide === 'bottom') lx =  h / 2;  // floor: horizontal face
  else                                 lx = -h / 2;

  // Both wall-orientations below: the inside face is a vertical line
  // in local frame (for left/right walls) or horizontal (for the floor).
  // Compute the two endpoints and the normal in world coords.
  let x1, y1, x2, y2, nxLocal, nyLocal;
  if (interiorSide === 'right' || interiorSide === 'left') {
    // Vertical line in local frame at x = lx, from y=-h/2 to y=+h/2.
    x1 = cx + lx * ca - (-h / 2) * sa;
    y1 = cy + lx * sa + (-h / 2) * ca;
    x2 = cx + lx * ca - ( h / 2) * sa;
    y2 = cy + lx * sa + ( h / 2) * ca;
    // Local outward normal points toward interior — +x for right side face, -x for left.
    nxLocal = (interiorSide === 'right') ? 1 : -1;
    nyLocal = 0;
  } else {
    // Horizontal line at y = lx (reusing lx as vertical offset for the floor).
    // Floor: interiorSide 'top' means interior is above (−y local).
    const ly = (interiorSide === 'bottom') ? h / 2 : -h / 2;
    x1 = cx + (-w / 2) * ca - ly * sa;
    y1 = cy + (-w / 2) * sa + ly * ca;
    x2 = cx + ( w / 2) * ca - ly * sa;
    y2 = cy + ( w / 2) * sa + ly * ca;
    nxLocal = 0;
    nyLocal = (interiorSide === 'bottom') ? 1 : -1;
  }
  // Rotate the local normal into world coords.
  const nx = nxLocal * ca - nyLocal * sa;
  const ny = nxLocal * sa + nyLocal * ca;
  return { x1, y1, x2, y2, nx, ny, cx, cy, w, h, angle };
}

// Build the container: left wall, right wall, floor.
// Each wall's "interior" side faces into the playable area.
let walls = [
  makeWall(lWallX, wallCY, wallThick, wallH,    -wallAngle, 'right'),
  makeWall(rWallX, wallCY, wallThick, wallH,     wallAngle, 'left'),
  makeWall(CX,     cBottom, floorW,   wallThick, 0,         'top'),
];

// Extra walls from the WALLS ability — appended at use time, cleared when the ability expires.
let extraWalls = [];
