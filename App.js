// App.js — Ball Merge Game for Expo Snack
// Required extra package: react-native-webview

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const GAME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#000; overflow:hidden; touch-action:none; }
canvas { display:block; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
<script>
// ═══════════════════════════════════════════════════════════
//  TIERS  — white only tiny bit bigger than yellow,
//           rainbow only a little bigger than white
// ═══════════════════════════════════════════════════════════
const TIERS = [
  { tier:1,  radius:22, color:'#5BB8FF' },
  { tier:2,  radius:30, color:'#5CD65C' },
  { tier:3,  radius:38, color:'#E85DE8' },
  { tier:4,  radius:46, color:'#E85050' },
  { tier:5,  radius:52, color:'#E8913A' },
  { tier:6,  radius:58, color:'#E8D83A' },
  { tier:7,  radius:63, color:'#DDDDDD' },
  { tier:8,  radius:69, color:'RAINBOW' },
  { tier:9,  radius:54, color:'TIEDYE'  },
  { tier:10, radius:62, color:'PLANET'  },
];
const TIER_SCORES = [0,2,4,10,20,50,100,200,1000,150,400];
const PLANETS     = ['earth','mars','saturn','neptune','jupiter'];
const EXPRESSIONS = ['happy','sad','mad','surprised','sleepy'];
const PLANET_COLORS = {
  earth:  ['#1a6b3c','#1a4fa0','#8BC4E2','#2a8050'],
  mars:   ['#c1440e','#e27b52','#a33a0e','#d45520'],
  saturn: ['#c9a84c','#e8d28a','#8a6d2f','#d4b84c'],
  neptune:['#1a3a8c','#4a7fd4','#2a5aac','#6090e0'],
  jupiter:['#c9a47e','#e8c49a','#a08060','#d4b490'],
};
// Weighted drop — lower tiers drop far more often
const DROP_WEIGHTS = [42, 30, 18, 10];

// ═══════════════════════════════════════════════════════════
//  CANVAS
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
const W = canvas.width;
const H = canvas.height;

// ═══════════════════════════════════════════════════════════
//  MATTER.JS
// ═══════════════════════════════════════════════════════════
const { Engine, Runner, World, Bodies, Body, Events, Composite } = Matter;
const engine = Engine.create({ gravity:{ x:0, y:1.8 }, enableSleeping:true });
const runner = Runner.create();
Runner.run(runner, engine);
const world  = engine.world;

// ═══════════════════════════════════════════════════════════
//  LAYOUT  — wider container, shorter walls
// ═══════════════════════════════════════════════════════════
const CX        = W / 2;
const wallThick = 24;
const wallAngle = 0.19;
const cW        = Math.min(W * 0.82, 350);
const wallH     = cW * 0.98;
const floorW    = cW * 0.68;
const cBottom   = H * 0.775;
const cTop      = cBottom - wallH;

const wallOffset = Math.sin(wallAngle) * wallH * 0.5;
const lWallX     = CX - floorW*0.5 - wallOffset;
const rWallX     = CX + floorW*0.5 + wallOffset;
const wallCY     = cBottom - wallH*0.5;

const wallOpts = { isStatic:true, restitution:0.2, friction:0.4, frictionStatic:0.5, label:'wall' };
const leftWall  = Bodies.rectangle(lWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle:-wallAngle }));
const rightWall = Bodies.rectangle(rWallX, wallCY, wallThick, wallH, Object.assign({}, wallOpts, { angle: wallAngle }));
const floor     = Bodies.rectangle(CX, cBottom, floorW, wallThick, wallOpts);
World.add(world, [leftWall, rightWall, floor]);

// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════
let balls        = [];
let score        = 0;
let bestScore    = 0;
let gameOver     = false;
let cashedOut    = false;
let nextTier     = randDropTier();
let aimX         = CX;
let dropCooldown = 0;
const COOLDOWN   = 38;      // ~0.63 s — responsive but not instant
let hasTieDye    = false;
let bgDark       = 0;

let lastMergeMs  = 0;
let comboCount   = 0;
let comboTimer   = 0;
let comboLabel   = '';
let comboColor   = '#fff';
let shakeFrames  = 0;
let popups       = [];
let stars        = null;

// Abilities
const AB = {
  swap:       { uses:3, cooldown:0 },
  earthquake: { uses:3, cooldown:0 },
  walls:      { uses:3, cooldown:0 },
};
const AB_BTN = [
  { key:'swap',       x:0,y:0,w:56,h:56 },
  { key:'earthquake', x:0,y:0,w:56,h:56 },
  { key:'walls',      x:0,y:0,w:56,h:56 },
];
let extraWalls       = [];
let wallAbilityOn    = false;
let wallAbilityTimer = 0;

// Flag to block drop when an ability button was just pressed
let abilityJustPressed = false;

// Quake: multi-pulse state
let quakeActive = false;
let quakeTimer  = 0;      // total frames remaining
let quakePulse  = 0;      // frames until next pulse

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function randDropTier() {
  const total = DROP_WEIGHTS.reduce(function(a,b){ return a+b; }, 0);
  let r = Math.random() * total;
  for (let i=0; i<DROP_WEIGHTS.length; i++) {
    r -= DROP_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}
function randInt(lo, hi) { return lo + Math.floor(Math.random()*(hi-lo)); }
function lerp(a, b, t)   { return a + (b-a)*t; }

function lighten(hex, amt) {
  if (hex==='RAINBOW'||hex==='TIEDYE'||hex==='PLANET') return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n>>16)&0xff)+amt);
  const g = Math.min(255, ((n>>8) &0xff)+amt);
  const b = Math.min(255, ((n)    &0xff)+amt);
  return '#' + [r,g,b].map(function(v){ return v.toString(16).padStart(2,'0'); }).join('');
}

function getBall(body) {
  for (let i=0; i<balls.length; i++) { if (balls[i].body===body) return balls[i]; }
  return null;
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

// ── Contact-normal deformed blob ──────────────────────────────
// contacts: [{cx,cy,amt}]  cx/cy = unit vector TOWARD the contact surface
// Each contact pushes the ball surface INWARD at the contact angle,
// and compensates with a slight outward bulge perpendicular to it.
// squishX/squishY = impact squish applied as ellipse pre-scale.
// 32-sample polygon — smooth enough, < 0.5 ms per ball at 60 fps.
function deformedBlobPath(r, contacts, sqX, sqY, wobble) {
  const N = 32;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a    = (i / N) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);

    // Axis-aligned collision squish encoded directly into the radius
    // (avoids an extra ctx.scale that would distort contact normals)
    let rx = cosA * sqX;
    let ry = sinA * sqY;
    let rad = Math.sqrt(rx*rx + ry*ry) * r;
    // unit direction in the squished frame
    const ux = rx / (rad/r);
    const uy = ry / (rad/r);

    // Contact deformations
    for (let j = 0; j < contacts.length; j++) {
      const c   = contacts[j];
      const dot = ux*c.cx + uy*c.cy;   // 1 = facing contact, -1 = facing away
      if (dot > 0) {
        rad -= Math.pow(dot, 2.8) * c.amt;                    // flatten toward contact
      }
      // Volume compensation: bulge perpendicular to contact
      rad += (1 - dot*dot) * c.amt * 0.32;
    }

    // Organic rolling wobble
    rad += Math.sin(a * 2 + (wobble||0) * 12) * (wobble||0);
    rad  = Math.max(r * 0.60, rad);

    ctx.lineTo(cosA * rad, sinA * rad);
  }
  ctx.closePath();
}

// Legacy wrapper (used for preview balls that have no contacts)
function blobPath(r, sqX, sqY, wobble) {
  deformedBlobPath(r, [], sqX, sqY, wobble);
}

// ═══════════════════════════════════════════════════════════
//  CREATE BALL
// ═══════════════════════════════════════════════════════════
function createBall(x, y, tier, vy) {
  vy = vy || 0;
  const td   = TIERS[tier-1];
  const r    = td.radius;
  const body = Bodies.circle(x, y, r, {
    restitution:0.28, friction:0.55, frictionAir:0.007,
    frictionStatic:0.4, density:0.002, slop:0.06,
    sleepThreshold:60, label:'ball_' + tier
  });
  Body.setVelocity(body, { x:0, y:vy });
  World.add(world, body);

  const ball = {
    body, tier, r,
    color: td.color,
    merging:   false,
    squishX:   1.0,  squishY:   1.0,
    velStretch:1.0,  velCompress:1.0,
    velAngle:  0,
    wobble:    0,
    contacts:  [],   // updated each frame from neighbour/floor proximity
    popScale:  0.1,
    spawning:  true,
    spawnTick: 0,
    expression: tier===9 ? EXPRESSIONS[randInt(0,EXPRESSIONS.length)] : (tier===10?'stoic':null),
    planet:     tier===10 ? PLANETS[randInt(0,PLANETS.length)] : null,
    tieDye:     tier===9  ? [
      'hsl(' + randInt(0,360) + ',90%,55%)',
      'hsl(' + randInt(0,360) + ',90%,55%)',
      'hsl(' + randInt(0,360) + ',90%,55%)'
    ] : null,
  };
  balls.push(ball);
  if (tier===9 && !hasTieDye) hasTieDye = true;
  return ball;
}

// ═══════════════════════════════════════════════════════════
//  MERGE
// ═══════════════════════════════════════════════════════════
function triggerMerge(a, b) {
  a.merging = true; b.merging = true;
  const mx  = (a.body.position.x + b.body.position.x) * 0.5;
  const my  = (a.body.position.y + b.body.position.y) * 0.5;
  const avx = (a.body.velocity.x + b.body.velocity.x) * 0.5;
  const nt  = Math.min(a.tier + 1, 10);
  const now = Date.now();
  const base= TIER_SCORES[nt];
  let mult  = 1.0;
  if (now - lastMergeMs < 1500) {
    comboCount++;
    if (comboCount===2){ mult=1.2;  comboLabel='Combo!';   comboColor='#FFE84A'; }
    if (comboCount>=3) { mult=1.44; comboLabel='INSANE!!'; comboColor='#4AFFFF'; shakeFrames=22; }
  } else {
    comboCount=1; comboLabel='';
  }
  lastMergeMs = now;
  comboTimer  = 90;
  const earned = Math.round(base * mult);
  score += earned;
  if (score > bestScore) bestScore = score;
  popups.push({ x:mx, y:my-20, text:'+'+earned, life:1.0, color:comboCount>1?'#FFE84A':'#fff', combo:comboCount>1 });

  setTimeout(function() {
    balls = balls.filter(function(bb){ return bb!==a && bb!==b; });
    try { World.remove(world, a.body); } catch(_){}
    try { World.remove(world, b.body); } catch(_){}
    if (nt > 10) return;
    const nb = createBall(mx, my, nt, -4);
    Body.setVelocity(nb.body, { x:avx, y:-4 });
  }, 80);
}

// ═══════════════════════════════════════════════════════════
//  COLLISION
// ═══════════════════════════════════════════════════════════
Events.on(engine, 'collisionStart', function(ev) {
  ev.pairs.forEach(function(pair) {
    const { bodyA, bodyB, collision } = pair;
    const ba = getBall(bodyA);
    const bb = getBall(bodyB);
    const depth = (collision && collision.depth) ? collision.depth : 1;
    // Impact squish — stronger for faster collisions
    const impulse = Math.min(depth * 0.8, 0.28);
    if (ba && depth>0.3){
      const mf = Math.min(Math.sqrt(ba.body.mass)*0.14, 1.0);
      ba.squishX=Math.min(ba.squishX, 1.0+impulse*(1+mf));
      ba.squishY=Math.max(ba.squishY, 1.0-impulse*(1+mf)*0.65);
    }
    if (bb && depth>0.3){
      const mf = Math.min(Math.sqrt(bb.body.mass)*0.14, 1.0);
      bb.squishX=Math.min(bb.squishX, 1.0+impulse*(1+mf));
      bb.squishY=Math.max(bb.squishY, 1.0-impulse*(1+mf)*0.65);
    }
    if (!ba||!bb) return;
    if (ba.tier===bb.tier && !ba.merging && !bb.merging) triggerMerge(ba, bb);
  });
});

// ═══════════════════════════════════════════════════════════
//  DROP
// ═══════════════════════════════════════════════════════════
function dropBall() {
  if (gameOver||cashedOut||dropCooldown>0) return;
  const r  = TIERS[nextTier-1].radius;
  const cx = Math.max(lWallX+r+2, Math.min(rWallX-r-2, aimX));
  const nb = createBall(cx, cTop - r - 4, nextTier);
  nb.popScale=0.1; nb.spawning=true; nb.spawnTick=0;
  dropCooldown = COOLDOWN;
  nextTier     = randDropTier();
}

// ═══════════════════════════════════════════════════════════
//  ABILITIES
// ═══════════════════════════════════════════════════════════
function useAbility(key) {
  const ab = AB[key];
  // Block if no uses, active cooldown, or walls already on
  if (ab.uses<=0) return;
  if (ab.cooldown>0) return;
  if (key==='walls' && wallAbilityOn) return;
  if (gameOver||cashedOut) return;

  ab.uses--;

  if (key==='swap') {
    nextTier = randDropTier();
    ab.cooldown = 20; // short lock so double-tap doesn't consume 2

  } else if (key==='earthquake') {
    ab.cooldown  = 600;
    quakeActive  = true;
    quakeTimer   = 600; // 10 seconds
    quakePulse   = 0;   // fire immediately

  } else if (key==='walls') {
    wallAbilityOn    = true;
    wallAbilityTimer = 720;  // 12 seconds
    ab.cooldown      = 720;
    const extH = wallH * 0.44;
    const eLX  = lWallX - Math.sin(wallAngle)*(wallH*0.5+extH*0.5);
    const eLY  = wallCY  - Math.cos(wallAngle)*(wallH*0.5+extH*0.5);
    const eRX  = rWallX + Math.sin(wallAngle)*(wallH*0.5+extH*0.5);
    const eRY  = wallCY  - Math.cos(wallAngle)*(wallH*0.5+extH*0.5);
    extraWalls = [
      Bodies.rectangle(eLX, eLY, wallThick, extH, Object.assign({},wallOpts,{angle:-wallAngle})),
      Bodies.rectangle(eRX, eRY, wallThick, extH, Object.assign({},wallOpts,{angle: wallAngle})),
    ];
    World.add(world, extraWalls);
  }
}

// ═══════════════════════════════════════════════════════════
//  LOSE CHECK
// ═══════════════════════════════════════════════════════════
function checkLose() {
  for (let i=0; i<balls.length; i++) {
    const b = balls[i];
    if (b.merging||b.spawning) continue;
    if (b.body.position.y > H + 80) { gameOver=true; return; }
    if (b.body.position.y < cTop - b.r*2.5 && b.body.speed < 0.8) { gameOver=true; return; }
  }
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════
function restart() {
  balls.forEach(function(b){ try{World.remove(world,b.body);}catch(_){} });
  balls=[];
  extraWalls.forEach(function(w){ try{World.remove(world,w);}catch(_){} });
  extraWalls=[];
  wallAbilityOn=false; wallAbilityTimer=0;
  score=0; gameOver=false; cashedOut=false;
  dropCooldown=0; nextTier=randDropTier(); aimX=CX;
  comboCount=0; comboTimer=0; comboLabel=''; shakeFrames=0;
  popups=[];
  AB.swap.uses=3;       AB.swap.cooldown=0;
  AB.earthquake.uses=3; AB.earthquake.cooldown=0;
  AB.walls.uses=3;      AB.walls.cooldown=0;
  quakeActive=false; quakeTimer=0; quakePulse=0;
  hasTieDye=false; bgDark=0;
}

// ═══════════════════════════════════════════════════════════
//  INPUT  — ability flag prevents accidental drop
// ═══════════════════════════════════════════════════════════
function evX(e){ return (e.touches&&e.touches[0]?e.touches[0]:(e.changedTouches&&e.changedTouches[0]?e.changedTouches[0]:e)).clientX; }
function evY(e){ return (e.touches&&e.touches[0]?e.touches[0]:(e.changedTouches&&e.changedTouches[0]?e.changedTouches[0]:e)).clientY; }
function hitBtn(x,y,bx,by,bw,bh){ return x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh; }

canvas.addEventListener('touchstart', function(e){ e.preventDefault(); onDown(evX(e),evY(e)); },{passive:false});
canvas.addEventListener('mousedown',  function(e){ onDown(e.clientX,e.clientY); });
canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); aimX=Math.max(0,Math.min(W,evX(e))); },{passive:false});
canvas.addEventListener('mousemove',  function(e){ aimX=Math.max(0,Math.min(W,e.clientX)); });
canvas.addEventListener('touchend',   function(e){ e.preventDefault(); onUp(evX(e),evY(e)); },{passive:false});
canvas.addEventListener('mouseup',    function(e){ onUp(e.clientX,e.clientY); });

function onDown(x,y) {
  aimX=x;
  abilityJustPressed=false;
  if (gameOver||cashedOut) {
    if (hitBtn(x,y,W/2-70,H*0.62,140,50)) restart();
    return;
  }
  for (let i=0;i<AB_BTN.length;i++) {
    const btn=AB_BTN[i];
    if (hitBtn(x,y,btn.x,btn.y,btn.w,btn.h)) {
      useAbility(btn.key);
      abilityJustPressed=true;
      return;
    }
  }
  if (hitBtn(x,y,W-84,62,74,40)) { cashedOut=true; return; }
}

function onUp(x,y) {
  if (abilityJustPressed) { abilityJustPressed=false; return; }
  if (gameOver||cashedOut) return;
  dropBall();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — BACKGROUND
// ═══════════════════════════════════════════════════════════
function drawBackground() {
  const light = 1 - bgDark;
  if (light > 0.01) {
    ctx.fillStyle='rgba(240,236,224,'+light+')';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(200,192,168,'+(light*0.72)+')';
    ctx.lineWidth=1;
    for (let x=0;x<W;x+=18){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=18){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  }
  if (bgDark > 0.01) {
    ctx.fillStyle='rgba(10,10,20,'+bgDark+')';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(35,35,65,'+(bgDark*0.5)+')';
    ctx.lineWidth=1;
    for (let x=0;x<W;x+=20){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=20){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
    if (!stars) {
      stars=[];
      for (let i=0;i<32;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+0.4,t:Math.random()*6.28});
    }
    stars.forEach(function(s){
      s.t+=0.018;
      ctx.fillStyle='rgba(255,255,255,'+((Math.sin(s.t)+1)*0.5*bgDark)+')';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.283);ctx.fill();
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — STRIPED WALLS
// ═══════════════════════════════════════════════════════════
function drawWallBody(body, w, h, glow) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  if (glow){ ctx.shadowColor='#00ffff'; ctx.shadowBlur=18; }
  ctx.beginPath(); ctx.rect(-w/2,-h/2,w,h); ctx.clip();
  // White base
  ctx.fillStyle='#fff'; ctx.fillRect(-w/2,-h/2,w,h);
  // Black diagonal stripes
  ctx.fillStyle='#111';
  const s=10;
  for (let d=-h*2; d<w+h*2; d+=s*2) {
    ctx.beginPath();
    ctx.moveTo(-w/2+d,       -h/2);
    ctx.lineTo(-w/2+d+h,      h/2);
    ctx.lineTo(-w/2+d+h+s,    h/2);
    ctx.lineTo(-w/2+d+s,     -h/2);
    ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur=0;
  ctx.strokeStyle='#111'; ctx.lineWidth=5;
  ctx.strokeRect(-w/2,-h/2,w,h);
  ctx.restore();
}

function drawContainer() {
  drawWallBody(leftWall,  wallThick, wallH,    wallAbilityOn);
  drawWallBody(rightWall, wallThick, wallH,    wallAbilityOn);
  drawWallBody(floor,     floorW,   wallThick, false);
  if (wallAbilityOn) extraWalls.forEach(function(w){ drawWallBody(w,wallThick,wallH*0.44,true); });
}

// ═══════════════════════════════════════════════════════════
//  DRAW — BALL FILL
// ═══════════════════════════════════════════════════════════
function applyFill(ball, r) {
  const c = ball.color;
  if (c==='RAINBOW') {
    const g=ctx.createLinearGradient(-r,0,r,0);
    [0,40,80,140,200,270,320].forEach(function(h,i,a){
      g.addColorStop(i/(a.length-1),'hsl('+h+',100%,55%)');
    });
    ctx.fillStyle=g;
  } else if (c==='TIEDYE') {
    const cols=ball.tieDye||['#f0f','#0ff','#ff0'];
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.05,0,0,r);
    g.addColorStop(0,cols[0]); g.addColorStop(0.5,cols[1]); g.addColorStop(1,cols[2]);
    ctx.fillStyle=g;
  } else if (c==='PLANET') {
    const pc=PLANET_COLORS[ball.planet]||PLANET_COLORS.earth;
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.07,0,0,r);
    g.addColorStop(0,pc[2]); g.addColorStop(0.45,pc[0]); g.addColorStop(1,pc[1]);
    ctx.fillStyle=g;
  } else {
    const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.07,0,0,r);
    g.addColorStop(0,lighten(c,44)); g.addColorStop(1,c);
    ctx.fillStyle=g;
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — FACE
// ═══════════════════════════════════════════════════════════
function drawFace(ball, r) {
  const tier=ball.tier;
  const expr=ball.expression||tier;
  ctx.save();
  // blob is world-aligned, no body-angle to undo — face is naturally upright

  const es  = r*0.21;
  const esp = r*0.30;
  const eyY = -r*0.08;
  const moY = r*0.34;

  function drawEye(ex, ey, type) {
    if (type==='dot') {
      ctx.fillStyle='#fff';  ctx.beginPath();ctx.arc(ex,ey,es*0.85,0,6.283);ctx.fill();
      ctx.fillStyle='#111';  ctx.beginPath();ctx.arc(ex+es*0.2,ey,es*0.5,0,6.283);ctx.fill();
    } else if (type==='half') {
      ctx.save();
      ctx.beginPath();ctx.arc(ex,ey,es*1.35,0,6.283);ctx.clip();
      ctx.fillStyle='#fff';ctx.fillRect(ex-es*2,ey-es*2,es*4,es*2+1);
      ctx.restore();
      ctx.strokeStyle='#111';ctx.lineWidth=r*0.04;
      ctx.beginPath();ctx.arc(ex,ey,es*1.35,Math.PI,0);ctx.stroke();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+es*0.2,ey+es*0.2,es*0.65,0,6.283);ctx.fill();
    } else if (type==='furrow') {
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,es*1.25,0,6.283);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex,ey+es*0.1,es*0.72,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-es*0.1,ey-es*0.1,es*0.26,0,6.283);ctx.fill();
      ctx.strokeStyle='#111';ctx.lineWidth=r*0.055;ctx.lineCap='round';
      ctx.beginPath();
      if(ex<0){ctx.moveTo(ex-es*1.3,ey-es*1.6);ctx.lineTo(ex+es*0.8,ey-es*1.1);}
      else    {ctx.moveTo(ex-es*0.8,ey-es*1.1);ctx.lineTo(ex+es*1.3,ey-es*1.6);}
      ctx.stroke();
    } else {
      const big=(type==='wide'||type==='star')?1.5:1.28;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,es*big,0,6.283);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+es*0.22,ey+es*0.1,es*big*0.58,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+es*0.04,ey-es*0.2,es*0.3,0,6.283);ctx.fill();
    }
    if (type==='star') {
      ctx.fillStyle='#FFD700';
      for(let k=0;k<4;k++){
        const a=(k/4)*6.283;
        ctx.beginPath();ctx.arc(ex+Math.cos(a)*es*1.15,ey+Math.sin(a)*es*1.15,es*0.2,0,6.283);ctx.fill();
      }
    }
  }

  let eyeT='round';
  if(tier===1) eyeT='dot';
  else if(tier===4) eyeT='furrow';
  else if(tier===5||tier===7||tier===8) eyeT='wide';
  else if(tier===8) eyeT='star';
  else if(tier===6||expr==='sleepy') eyeT='half';
  else if(expr==='surprised') eyeT='wide';
  if(tier===8) eyeT='star';

  drawEye(-esp,eyY,eyeT);
  drawEye( esp,eyY,eyeT);

  ctx.strokeStyle='#111';ctx.lineWidth=r*0.066;ctx.lineCap='round';
  const mT=(tier===1||tier===4||expr==='mad')?'flat':
            (tier===7||expr==='sad')?'frown':
            (tier===3||tier===8)?'grin':
            (tier===5)?'smirk':
            (tier===2||tier===6||expr==='sleepy')?'gentle':'smile';
  ctx.beginPath();
  if(mT==='flat')  { ctx.moveTo(-r*0.22,moY);ctx.lineTo(r*0.22,moY); }
  else if(mT==='frown') { ctx.arc(0,moY+r*0.28,r*0.24,Math.PI+0.25,-0.25); }
  else if(mT==='grin')  { ctx.arc(0,moY-r*0.08,r*0.34,0.1,Math.PI-0.1); }
  else if(mT==='smirk') { ctx.moveTo(-r*0.15,moY+r*0.05);ctx.quadraticCurveTo(r*0.05,moY-r*0.12,r*0.26,moY-r*0.04); }
  else if(mT==='gentle'){ ctx.arc(0,moY-r*0.08,r*0.2,0.25,Math.PI-0.25); }
  else                   { ctx.arc(0,moY-r*0.08,r*0.27,0.2,Math.PI-0.2); }
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — SINGLE BALL (blob + directional squish)
// ═══════════════════════════════════════════════════════════
function drawBall(ball) {
  if (ball.merging) return;
  const r  = ball.r;
  const sc = ball.spawning ? ball.popScale : 1.0;

  ctx.save();
  ctx.translate(ball.body.position.x, ball.body.position.y);

  // Velocity directional stretch in world space
  const va = ball.velAngle;
  ctx.rotate(va);
  ctx.scale(ball.velStretch * sc, ball.velCompress * sc);
  ctx.rotate(-va);

  // Blob shape uses contact deformation + collision squish encoded in path
  const wobble = Math.min(ball.wobble, r*0.09);
  const contacts = ball.contacts;

  applyFill(ball, r);
  deformedBlobPath(r, contacts, ball.squishX, ball.squishY, wobble);
  ctx.fill();

  // Saturn ring
  if (ball.planet==='saturn') {
    ctx.strokeStyle='rgba(210,180,100,0.8)';
    ctx.lineWidth=r*0.13;
    ctx.beginPath();ctx.ellipse(0,r*0.07,r*1.55,r*0.32,0,0,6.283);ctx.stroke();
  }

  // Stroke — thickness scales with radius
  ctx.strokeStyle='#111';
  ctx.lineWidth=Math.max(3, r*0.115);
  deformedBlobPath(r, contacts, ball.squishX, ball.squishY, wobble);
  ctx.stroke();

  // Face when slow/sleeping — always upright (no body-angle needed since blob is world-aligned)
  if (ball.body.speed < 1.6 || ball.body.isSleeping) drawFace(ball, r);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — AIM LINE
// ═══════════════════════════════════════════════════════════
function drawAimLine() {
  if (gameOver||cashedOut) return;
  const ready=dropCooldown<=0;
  const td=TIERS[nextTier-1];
  const r=td.radius;
  const cx=Math.max(lWallX+r+2,Math.min(rWallX-r-2,aimX));

  ctx.strokeStyle=ready?'rgba(255,255,255,0.82)':'rgba(136,136,136,0.42)';
  ctx.setLineDash([7,7]); ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,115);ctx.lineTo(cx,cTop-r-6);ctx.stroke();
  ctx.setLineDash([]);

  // Preview ball above aim line
  ctx.save();
  ctx.globalAlpha=ready?1.0:0.45;
  ctx.translate(cx, 115-r-4);
  const fb={ body:{position:{x:cx,y:0},angle:0,speed:0,isSleeping:true},
             tier:nextTier,r,color:td.color,squishX:1,squishY:1,
             velStretch:1,velCompress:1,velAngle:0,wobble:0,
             spawning:false,popScale:1,expression:null,planet:null,tieDye:null,merging:false };
  applyFill(fb, r);
  blobPath(r,1,1,0);ctx.fill();
  ctx.strokeStyle='#111';ctx.lineWidth=Math.max(3,r*0.115);
  blobPath(r,1,1,0);ctx.stroke();
  ctx.restore();ctx.globalAlpha=1;
}

// ═══════════════════════════════════════════════════════════
//  DRAW — HUD
// ═══════════════════════════════════════════════════════════
function drawUI() {
  ctx.fillStyle='#fff'; ctx.font='bold 23px Arial';
  ctx.textAlign='left';
  ctx.fillText('Score: '+score,12,32);
  ctx.font='17px Arial';
  ctx.fillText('Best: '+bestScore,12,55);

  ctx.textAlign='right';
  ctx.font='bold 16px Arial'; ctx.fillStyle='#fff';
  ctx.fillText('Global #1 - 66540',W-12,26);
  ctx.textAlign='left';

  // Ability buttons
  const abDefs=[
    {key:'swap',       icon:'↺', sub:'SWAP'  },
    {key:'earthquake', icon:'≋', sub:'QUAKE' },
    {key:'walls',      icon:'↑', sub:'WALLS' },
  ];
  const abX=12, abY0=74, gap=64;
  ctx.font='bold 11px Arial'; ctx.fillStyle='#ccc';
  ctx.fillText('Abilities:',abX,abY0-10);

  abDefs.forEach(function(def,i) {
    const bx=abX, by=abY0+i*gap;
    AB_BTN[i].x=bx; AB_BTN[i].y=by;
    const ab=AB[def.key];
    const active=ab.uses>0&&ab.cooldown<=0&&!(def.key==='walls'&&wallAbilityOn);

    const g=ctx.createLinearGradient(bx,by,bx,by+56);
    g.addColorStop(0,active?'#30C9BB':'#444');
    g.addColorStop(1,active?'#1A9088':'#2a2a2a');
    ctx.fillStyle=g;
    roundRect(bx,by,56,56,12);ctx.fill();
    ctx.strokeStyle=active?'rgba(255,255,255,0.55)':'#555';
    ctx.lineWidth=2; roundRect(bx,by,56,56,12);ctx.stroke();

    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.font='bold 20px Arial'; ctx.fillText(def.icon,bx+28,by+30);
    ctx.font='bold 9px Arial';  ctx.fillText(def.sub,bx+28,by+44);
    ctx.textAlign='left';

    if (ab.uses>0) {
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.beginPath();ctx.arc(bx+48,by+9,10,0,6.283);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';
      ctx.fillText(ab.uses,bx+48,by+13);ctx.textAlign='left';
    }
  });

  // Check Out button
  ctx.fillStyle='#222'; roundRect(W-84,62,74,40,19);ctx.fill();
  ctx.strokeStyle='#0dd';ctx.lineWidth=2;roundRect(W-84,62,74,40,19);ctx.stroke();
  ctx.fillStyle='#0dd';ctx.font='bold 11px Arial';ctx.textAlign='center';
  ctx.fillText('Check Out!',W-47,87);ctx.textAlign='left';

  // Next Ball preview
  ctx.fillStyle='#ddd';ctx.font='bold 12px Arial';ctx.textAlign='right';
  ctx.fillText('Next Ball',W-12,116);ctx.textAlign='left';
  const ntd=TIERS[nextTier-1], nr=ntd.radius*0.74;
  ctx.save();ctx.translate(W-44,140);
  const fb2={ body:{position:{x:W-44,y:140},angle:0,speed:0,isSleeping:true},
              tier:nextTier,r:nr,color:ntd.color,squishX:1,squishY:1,
              velStretch:1,velCompress:1,velAngle:0,wobble:0,
              spawning:false,popScale:1,expression:null,planet:null,tieDye:null,merging:false };
  applyFill(fb2,nr);blobPath(nr,1,1,0);ctx.fill();
  ctx.strokeStyle='#111';ctx.lineWidth=Math.max(2,nr*0.115);
  blobPath(nr,1,1,0);ctx.stroke();
  ctx.restore();

  drawTierBar();

  // Combo label
  if (comboTimer>0 && comboLabel) {
    ctx.globalAlpha=Math.min(1,comboTimer/30);
    ctx.fillStyle=comboColor; ctx.font='bold 30px Arial'; ctx.textAlign='center';
    ctx.shadowColor=comboColor;ctx.shadowBlur=14;
    ctx.fillText(comboLabel,W/2,H*0.42);
    ctx.shadowBlur=0;ctx.textAlign='left';ctx.globalAlpha=1;
  }

  // Score popups
  popups=popups.filter(function(p){return p.life>0;});
  popups.forEach(function(p){
    p.life-=0.018; p.y-=1.1;
    ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.color; ctx.font='bold '+(p.combo?24:18)+'px Arial';
    ctx.textAlign='center'; ctx.fillText(p.text,p.x,p.y);
    ctx.textAlign='left';ctx.globalAlpha=1;
  });
}

function drawTierBar() {
  const by=H*0.805;
  // Tiers 1-4 are always visible (they're in the drop pool)
  const seen=new Set(balls.map(function(b){return b.tier;}));
  const known=new Set([1,2,3,4]);
  seen.forEach(function(t){known.add(t);});
  const sx=W/2-(TIERS.length*24)/2;
  TIERS.forEach(function(td,i){
    const cx=sx+i*24, r=10;
    if (known.has(td.tier)) {
      if(td.color==='RAINBOW'){
        const g=ctx.createLinearGradient(cx-r,by,cx+r,by);
        ['#f00','#f80','#ff0','#0f0','#08f','#80f'].forEach(function(c,j,a){g.addColorStop(j/(a.length-1),c);});
        ctx.fillStyle=g;
      } else if(td.color==='TIEDYE') ctx.fillStyle='#e040fb';
      else if(td.color==='PLANET')   ctx.fillStyle='#2244cc';
      else ctx.fillStyle=td.color;
    } else { ctx.fillStyle='#1c1c1c'; }
    ctx.beginPath();ctx.arc(cx,by,r,0,6.283);ctx.fill();
    ctx.strokeStyle='#555';ctx.lineWidth=1.5;ctx.stroke();
    if (!known.has(td.tier)){
      ctx.fillStyle='#999';ctx.font='bold 9px Arial';ctx.textAlign='center';
      ctx.fillText('?',cx,by+3.5);ctx.textAlign='left';
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  DRAW — OVERLAYS
// ═══════════════════════════════════════════════════════════
function drawOverlay() {
  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  if (cashedOut) {
    ctx.fillStyle='#fff';ctx.font='bold 38px Arial';
    ctx.fillText('CASHED OUT!',W/2,H*0.27);
  } else {
    ctx.fillStyle='#fff';ctx.font='bold 46px Arial';
    ctx.shadowColor='#fff';ctx.shadowBlur=12;
    ctx.fillText('GAME OVER',W/2,H*0.26);ctx.shadowBlur=0;
  }
  ctx.fillStyle='#E8913A';ctx.font='bold 40px Arial';ctx.fillText(score,W/2,H*0.40);
  ctx.fillStyle='#aaa';ctx.font='19px Arial';ctx.fillText('Best: '+bestScore,W/2,H*0.50);
  const msg=score>6000?'LEGENDARY!':score>3000?'Outstanding!':score>1500?'Amazing!':score>700?'Nice work!':'Keep going!';
  ctx.fillStyle='#fff';ctx.font='bold 24px Arial';ctx.fillText(msg,W/2,H*0.57);
  const g=ctx.createLinearGradient(W/2-70,H*0.62,W/2+70,H*0.62+50);
  g.addColorStop(0,'#2EE0D0');g.addColorStop(1,'#18A090');
  ctx.fillStyle=g;roundRect(W/2-70,H*0.62,140,50,26);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 21px Arial';ctx.fillText('PLAY AGAIN',W/2,H*0.62+33);
  ctx.textAlign='left';
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
function loop() {
  requestAnimationFrame(loop);

  if (hasTieDye&&bgDark<1) bgDark=Math.min(1,bgDark+0.004);
  if (dropCooldown>0) dropCooldown--;

  // Ability cooldowns
  ['swap','earthquake','walls'].forEach(function(k){ if(AB[k].cooldown>0) AB[k].cooldown--; });

  // Walls timer
  if (wallAbilityOn){ wallAbilityTimer--; if(wallAbilityTimer<=0){
    wallAbilityOn=false;
    extraWalls.forEach(function(w){ try{World.remove(world,w);}catch(_){} });
    extraWalls=[];
  }}

  // Quake multi-pulse: small hop every 22 frames for ~4 seconds
  if (quakeActive) {
    quakeTimer--;
    quakePulse--;
    if (quakePulse <= 0) {
      quakePulse = 45; // one pulse every ~0.75 s
      Composite.allBodies(world).forEach(function(b) {
        if (b.isStatic) return;
        // Only jump balls that are resting on something (floor or another ball)
        // — skip balls already airborne (speed > 3 and moving upward)
        const airborne = b.speed > 3 && b.velocity.y < -1;
        if (airborne) return;
        b.isSleeping   = false;
        b.sleepCounter = 0;
        Body.setVelocity(b, {
          x: b.velocity.x + (Math.random()-0.5)*6,
          y: -(5 + Math.random()*5)
        });
      });
    }
    if (quakeTimer <= 0) quakeActive = false;
  }

  // ── Contact deformation: computed fresh each frame ─────────
  // O(n²) distance check — fine for ≤30 balls
  balls.forEach(function(ball) {
    if (ball.merging) { ball.contacts=[]; return; }
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const r  = ball.r;
    const contacts = [];

    // Ball-vs-ball
    for (let i=0; i<balls.length; i++) {
      const o = balls[i];
      if (o===ball || o.merging) continue;
      const dx   = bx - o.body.position.x;
      const dy   = by - o.body.position.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
      const gap  = r + o.r - dist;
      if (gap > -2) {  // within 2px of touching
        const amt = Math.min(Math.max(gap, 0) * 0.5, r*0.20);
        contacts.push({ cx:-dx/dist, cy:-dy/dist, amt });
      }
    }

    // Ball-vs-floor
    const floorGap = cBottom - by - r;
    if (floorGap < 3) {
      const amt = Math.min(Math.max(-floorGap+3, 0)*0.55, r*0.22);
      contacts.push({ cx:0, cy:1, amt });
    }

    ball.contacts = contacts;
  });

  // ── Per-ball animation updates ──────────────────────────────
  balls.forEach(function(ball) {
    // Weight-proportional squish spring: heavier balls spring back slower
    const springRate = 0.20 / Math.sqrt(ball.r / 22);
    ball.squishX=lerp(ball.squishX,1,springRate);
    ball.squishY=lerp(ball.squishY,1,springRate);

    // Spawn pop
    if (ball.spawning) {
      ball.spawnTick++;
      ball.popScale=Math.min(1.0, ball.spawnTick/8);
      if (ball.popScale>=1.0) ball.spawning=false;
    }

    // Velocity stretch
    const speed=ball.body.speed;
    if (speed>0.6) {
      const vx=ball.body.velocity.x, vy=ball.body.velocity.y;
      ball.velAngle=Math.atan2(vy,vx);
      const amt=Math.min(speed*0.006,0.17);
      ball.velStretch  =lerp(ball.velStretch,  1+amt, 0.20);
      ball.velCompress =lerp(ball.velCompress, 1/(1+amt), 0.20);
    } else {
      ball.velStretch  =lerp(ball.velStretch,  1, 0.12);
      ball.velCompress =lerp(ball.velCompress, 1, 0.12);
    }

    // Rolling wobble
    const wobbleTarget=Math.abs(Math.sin(ball.body.angle*3)) * Math.min(speed,6)/6 * ball.r*0.065;
    ball.wobble=lerp(ball.wobble,wobbleTarget,0.15);
  });

  if (comboTimer>0) comboTimer--;

  // Screen shake
  const sx2=shakeFrames>0?(Math.random()-0.5)*7:0;
  const sy2=shakeFrames>0?(Math.random()-0.5)*7:0;
  if (shakeFrames>0) shakeFrames--;

  if (!gameOver&&!cashedOut&&balls.length>0) checkLose();

  ctx.save();
  if (shakeFrames>0) ctx.translate(sx2,sy2);
  drawBackground();
  drawContainer();
  balls.forEach(drawBall);
  drawAimLine();
  ctx.restore();
  drawUI();
  if (gameOver||cashedOut) drawOverlay();
}

requestAnimationFrame(loop);
</script>
</body>
</html>`;

export default function App() {
  const { width, height } = Dimensions.get('window');
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: GAME_HTML }}
        style={{ width, height }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#000' },
});
