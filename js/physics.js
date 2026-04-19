// ═══════════════════════════════════════════════════════════
//  MATTER.JS  — rigid-circle physics engine
//
//  Balls are perfect circles. They stack, collide, roll, and bounce
//  according to Matter.js's industry-standard rigid-body solver.
//  The soft-body rewrite produced visually-broken results (triangular
//  shapes, blobs sinking into each other); rigid circles render and
//  pack cleanly like classic Suika.
// ═══════════════════════════════════════════════════════════

const { Engine, World, Bodies, Body, Events, Composite } = Matter;
const engine = Engine.create({ gravity:{ x:0, y:0.55 }, enableSleeping:false });
const world  = engine.world;

// ═══════════════════════════════════════════════════════════
//  LAYOUT  — wider container, shorter walls
// ═══════════════════════════════════════════════════════════
const CX        = W / 2;
const wallThick = 24;
const wallAngle = 0.15;
const cW        = Math.min(W * 0.72, 300);   // narrower = harder, matches reference image
const wallH     = cW * 0.78;                  // a touch taller so the container still feels deep
const floorW    = cW * 0.72;
const cBottom   = H * 0.80;
const cTop      = cBottom - wallH;
const dropZoneY = cTop - 200;

const wallOffset = Math.sin(wallAngle) * wallH * 0.5;
const lWallX     = CX - floorW * 0.5 - wallOffset;
const rWallX     = CX + floorW * 0.5 + wallOffset;
const wallCY     = cBottom - wallH * 0.5;

const wallOpts = { isStatic:true, restitution:0.2, friction:0.4, frictionStatic:0.5, label:'wall' };
const leftWall  = Bodies.rectangle(lWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle:-wallAngle }));
const rightWall = Bodies.rectangle(rWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle: wallAngle }));
const floor     = Bodies.rectangle(CX, cBottom, floorW, wallThick, wallOpts);
World.add(world, [leftWall, rightWall, floor]);

// Extra walls added by the WALLS ability — vertical extensions above
// the angled walls that trap balls in place.
let extraWalls = [];

// Per-pair contact tracking — populated by collision events, used by
// the quake ability to skip blobs that aren't resting on anything.
const bodyContacts = {};
