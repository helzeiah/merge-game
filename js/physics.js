// ═══════════════════════════════════════════════════════════
//  MATTER.JS
// ═══════════════════════════════════════════════════════════
const { Engine, World, Bodies, Body, Events, Composite } = Matter;
const engine = Engine.create({ gravity:{ x:0, y:0.65 }, enableSleeping:false });
let physicsEnabled = false;
const world  = engine.world;

// ═══════════════════════════════════════════════════════════
//  LAYOUT  — wider container, shorter walls
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
const lWallX     = CX - floorW*0.5 - wallOffset;
const rWallX     = CX + floorW*0.5 + wallOffset;
const wallCY     = cBottom - wallH*0.5;

const wallOpts = { isStatic:true, restitution:0.2, friction:0.4, frictionStatic:0.5, label:'wall' };
const leftWall  = Bodies.rectangle(lWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle:-wallAngle }));
const rightWall = Bodies.rectangle(rWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle: wallAngle }));
const floor     = Bodies.rectangle(CX, cBottom, floorW, wallThick, wallOpts);
World.add(world, [leftWall, rightWall, floor]);

// ── Per-body contact map: bodyId → {otherId → {nx,ny,depth,om}} ──
// Maintained via collision events; no sleeping = contacts never stale.
const bodyContacts = {};
