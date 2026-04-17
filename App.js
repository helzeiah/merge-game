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
//  CONSTANTS & TIERS
// ═══════════════════════════════════════════════════════════
const TIERS = [
  { tier:1,  radius:15, color:'#5BB8FF' },
  { tier:2,  radius:22, color:'#5CD65C' },
  { tier:3,  radius:30, color:'#E85DE8' },
  { tier:4,  radius:38, color:'#E85050' },
  { tier:5,  radius:47, color:'#E8913A' },
  { tier:6,  radius:57, color:'#E8D83A' },
  { tier:7,  radius:68, color:'#DDDDDD' },
  { tier:8,  radius:80, color:'RAINBOW' },
  { tier:9,  radius:57, color:'TIEDYE'  },
  { tier:10, radius:68, color:'PLANET'  },
];
const TIER_SCORES  = [0,2,4,10,20,50,100,200,1000,150,400];
const PLANETS      = ['earth','mars','saturn','neptune','jupiter'];
const EXPRESSIONS  = ['happy','sad','mad','surprised','sleepy'];
const PLANET_COLORS = {
  earth:  ['#1a6b3c','#1a4fa0','#8BC4E2','#2a8050'],
  mars:   ['#c1440e','#e27b52','#a33a0e','#d45520'],
  saturn: ['#c9a84c','#e8d28a','#8a6d2f','#d4b84c'],
  neptune:['#1a3a8c','#4a7fd4','#2a5aac','#6090e0'],
  jupiter:['#c9a47e','#e8c49a','#a08060','#d4b490'],
};

// ═══════════════════════════════════════════════════════════
//  CANVAS SETUP
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
const world = engine.world;

// ═══════════════════════════════════════════════════════════
//  LAYOUT
// ═══════════════════════════════════════════════════════════
const CX         = W / 2;
const wallThick  = 22;
const wallAngle  = 0.21;

// Container sizing — fits nicely on phone
const cW         = Math.min(W * 0.70, 300);   // total opening width at bottom
const wallH      = cW * 1.35;                  // height of each side wall
const floorW     = cW * 0.60;                  // floor width (narrower than walls apart)
const cBottom    = H * 0.745;                  // y of floor centre
const cTop       = cBottom - wallH;            // approximate top of container

// Side-wall centre positions: place them so bottom edges meet the floor corners
// sin(wallAngle) * wallH/2 = horizontal offset from bottom to centre
const wallOffset = Math.sin(wallAngle) * wallH * 0.5;
const lWallX     = CX - floorW * 0.5 - wallOffset;
const rWallX     = CX + floorW * 0.5 + wallOffset;
const wallCY     = cBottom - wallH * 0.5;      // vertical centre of wall bodies

const wallOptions = {
  isStatic:true, restitution:0.2,
  friction:0.4, frictionStatic:0.5, label:'wall'
};
const leftWall  = Bodies.rectangle(lWallX, wallCY, wallThick, wallH, { ...wallOptions, angle:-wallAngle });
const rightWall = Bodies.rectangle(rWallX, wallCY, wallThick, wallH, { ...wallOptions, angle: wallAngle });
const floor     = Bodies.rectangle(CX, cBottom, floorW, wallThick, wallOptions);
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
const COOLDOWN_FRAMES = 54;
let hasTieDye    = false;
let bgDark       = 0;           // 0=cream, 1=dark (transitions smoothly)

// Combo
let lastMergeMs  = 0;
let comboCount   = 0;
let comboTimer   = 0;
let comboLabel   = '';
let comboColor   = '#fff';
let shakeFrames  = 0;

// Popups & banners
let popups  = [];
let banners = [];
let nextBannerIn = randInt(180, 480);

// Abilities
const AB = {
  swap:       { uses:3 },
  earthquake: { uses:3 },
  walls:      { uses:3 },
};
const AB_BTN = [
  { key:'swap',       x:0,y:0,w:54,h:54 },
  { key:'earthquake', x:0,y:0,w:54,h:54 },
  { key:'walls',      x:0,y:0,w:54,h:54 },
];
let extraWalls       = [];
let wallAbilityOn    = false;
let wallAbilityTimer = 0;

// Stars cache
let stars = null;

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function randDropTier()    { return Math.ceil(Math.random() * 4); }
function randInt(lo, hi)   { return lo + Math.floor(Math.random() * (hi - lo)); }
function lerp(a, b, t)     { return a + (b - a) * t; }

function lighten(hex, amt) {
  if (['RAINBOW','TIEDYE','PLANET'].includes(hex)) return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >>  8) & 0xff) + amt);
  const b = Math.min(255, ((n      ) & 0xff) + amt);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function getBall(body) { return balls.find(b => b.body === body); }

function randName() {
  const a = ['Player','Guy','Ball','Merge','Drop'];
  const b = ['1134SY','2245AB','9876XZ','4521MK','7733OP','3310ZZ'];
  return a[randInt(0,a.length)] + b[randInt(0,b.length)];
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x+r, y);
  cx.lineTo(x+w-r, y);
  cx.quadraticCurveTo(x+w, y,   x+w, y+r);
  cx.lineTo(x+w, y+h-r);
  cx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  cx.lineTo(x+r, y+h);
  cx.quadraticCurveTo(x, y+h,   x, y+h-r);
  cx.lineTo(x, y+r);
  cx.quadraticCurveTo(x, y,     x+r, y);
  cx.closePath();
}

// ═══════════════════════════════════════════════════════════
//  CREATE BALL
// ═══════════════════════════════════════════════════════════
function createBall(x, y, tier, vy = 0) {
  const td   = TIERS[tier - 1];
  const r    = td.radius;
  const body = Bodies.circle(x, y, r, {
    restitution:0.25, friction:0.6, frictionAir:0.008,
    frictionStatic:0.5, density:0.002, slop:0.05,
    sleepThreshold:60, label:`ball_${tier}`
  });
  Body.setVelocity(body, { x:0, y:vy });
  World.add(world, body);

  const ball = {
    body, tier, r,
    color: td.color,
    merging:    false,
    squishX:    1.0,
    squishY:    1.0,
    popScale:   0.1,
    spawning:   true,
    spawnTick:  0,
    expression: tier === 9 ? EXPRESSIONS[randInt(0, EXPRESSIONS.length)] : (tier === 10 ? 'stoic' : null),
    planet:     tier === 10 ? PLANETS[randInt(0, PLANETS.length)] : null,
    tieDye:     tier === 9  ? [
      `hsl(${randInt(0,360)},90%,55%)`,
      `hsl(${randInt(0,360)},90%,55%)`,
      `hsl(${randInt(0,360)},90%,55%)`
    ] : null,
  };
  balls.push(ball);
  if (tier === 9 && !hasTieDye) hasTieDye = true;
  return ball;
}

// ═══════════════════════════════════════════════════════════
//  MERGE
// ═══════════════════════════════════════════════════════════
function triggerMerge(a, b) {
  a.merging = true;
  b.merging = true;
  const mx  = (a.body.position.x + b.body.position.x) / 2;
  const my  = (a.body.position.y + b.body.position.y) / 2;
  const avx = (a.body.velocity.x + b.body.velocity.x) / 2;
  const newTier = Math.min(a.tier + 1, 10);

  // Score + combo
  const now  = Date.now();
  const base = TIER_SCORES[newTier];
  let mult   = 1.0;
  if (now - lastMergeMs < 1500) {
    comboCount++;
    if (comboCount === 2) { mult = 1.2;  comboLabel = 'Combo!';   comboColor = '#FFE84A'; }
    if (comboCount >= 3)  { mult = 1.44; comboLabel = 'INSANE!!'; comboColor = '#4AFFFF'; shakeFrames = 22; }
  } else {
    comboCount = 1;
    comboLabel = '';
  }
  lastMergeMs = now;
  comboTimer  = 90;

  const earned = Math.round(base * mult);
  score += earned;
  if (score > bestScore) bestScore = score;

  popups.push({
    x: mx, y: my - 20, text: `+${earned}`,
    life: 1.0, color: comboCount > 1 ? '#FFE84A' : '#fff',
    combo: comboCount > 1,
  });

  setTimeout(() => {
    balls = balls.filter(bb => bb !== a && bb !== b);
    try { World.remove(world, a.body); } catch(_) {}
    try { World.remove(world, b.body); } catch(_) {}
    if (newTier > 10) return;
    const nb = createBall(mx, my, newTier, -4);
    Body.setVelocity(nb.body, { x: avx, y: -4 });
  }, 80);
}

// ═══════════════════════════════════════════════════════════
//  COLLISION EVENTS
// ═══════════════════════════════════════════════════════════
Events.on(engine, 'collisionStart', ev => {
  ev.pairs.forEach(pair => {
    const { bodyA, bodyB, collision } = pair;
    const ba = getBall(bodyA);
    const bb = getBall(bodyB);
    const depth = (collision && collision.depth) ? collision.depth : 1;

    if (ba && depth > 0.4) { ba.squishX = 1.15; ba.squishY = 0.85; }
    if (bb && depth > 0.4) { bb.squishX = 1.15; bb.squishY = 0.85; }

    if (!ba || !bb) return;
    if (ba.tier === bb.tier && !ba.merging && !bb.merging) {
      triggerMerge(ba, bb);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  DROP BALL
// ═══════════════════════════════════════════════════════════
function dropBall() {
  if (gameOver || cashedOut || dropCooldown > 0) return;
  const r   = TIERS[nextTier - 1].radius;
  const spY = cTop - r - 5;
  const clampedX = Math.max(lWallX + r, Math.min(rWallX - r, aimX));
  const nb = createBall(clampedX, spY, nextTier);
  nb.popScale  = 0.1;
  nb.spawning  = true;
  nb.spawnTick = 0;
  dropCooldown = COOLDOWN_FRAMES;
  nextTier     = randDropTier();
}

// ═══════════════════════════════════════════════════════════
//  ABILITIES
// ═══════════════════════════════════════════════════════════
function useAbility(key) {
  if (AB[key].uses <= 0 || gameOver || cashedOut) return;
  AB[key].uses--;
  if (key === 'swap') {
    nextTier = randDropTier();
  } else if (key === 'earthquake') {
    balls.forEach(b => {
      if (!b.merging) {
        Body.setVelocity(b.body, {
          x: b.body.velocity.x + (Math.random() - 0.5) * 10,
          y: b.body.velocity.y - Math.random() * 8
        });
        Body.setAwake(b.body, true);
      }
    });
  } else if (key === 'walls' && !wallAbilityOn) {
    wallAbilityOn    = true;
    wallAbilityTimer = 300;
    const extH = wallH * 0.45;
    const extLX = lWallX - Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const extLY = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const extRX = rWallX + Math.sin(wallAngle) * (wallH * 0.5 + extH * 0.5);
    const extRY = wallCY  - Math.cos(wallAngle) * (wallH * 0.5 + extH * 0.5);
    extraWalls = [
      Bodies.rectangle(extLX, extLY, wallThick, extH, { ...wallOptions, angle:-wallAngle }),
      Bodies.rectangle(extRX, extRY, wallThick, extH, { ...wallOptions, angle: wallAngle }),
    ];
    World.add(world, extraWalls);
  }
}

// ═══════════════════════════════════════════════════════════
//  GAME OVER CHECK
// ═══════════════════════════════════════════════════════════
function checkLose() {
  for (const b of balls) {
    if (b.merging || b.spawning) continue;
    if (b.body.position.y > H + 60) { gameOver = true; return; }
    if (b.body.position.y < cTop - b.r * 3 && b.body.speed < 1.0) {
      gameOver = true; return;
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════
function restart() {
  balls.forEach(b => { try { World.remove(world, b.body); } catch(_) {} });
  balls = [];
  extraWalls.forEach(w => { try { World.remove(world, w); } catch(_) {} });
  extraWalls = [];
  wallAbilityOn    = false;
  wallAbilityTimer = 0;
  score     = 0;
  gameOver  = false;
  cashedOut = false;
  dropCooldown  = 0;
  nextTier  = randDropTier();
  aimX      = CX;
  comboCount = 0; comboTimer = 0; comboLabel = ''; shakeFrames = 0;
  popups = []; banners = [];
  nextBannerIn    = randInt(180, 480);
  hasTieDye = false;
  bgDark    = 0;
  AB.swap.uses = AB.earthquake.uses = AB.walls.uses = 3;
}

// ═══════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════
function evX(e) { return (e.touches?.[0] ?? e.changedTouches?.[0] ?? e).clientX; }
function evY(e) { return (e.touches?.[0] ?? e.changedTouches?.[0] ?? e).clientY; }

canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(evX(e), evY(e)); }, { passive:false });
canvas.addEventListener('mousedown',  e => onDown(e.clientX, e.clientY));
canvas.addEventListener('touchmove',  e => { e.preventDefault(); aimX = Math.max(0, Math.min(W, evX(e))); }, { passive:false });
canvas.addEventListener('mousemove',  e => { aimX = Math.max(0, Math.min(W, e.clientX)); });
canvas.addEventListener('touchend',   e => { e.preventDefault(); onUp(evX(e), evY(e)); }, { passive:false });
canvas.addEventListener('mouseup',    e => onUp(e.clientX, e.clientY));

function hitBtn(x, y, bx, by, bw, bh) {
  return x >= bx && x <= bx+bw && y >= by && y <= by+bh;
}

function onDown(x, y) {
  aimX = x;
  if (gameOver || cashedOut) {
    if (hitBtn(x, y, W/2-70, H*0.62, 140, 50)) restart();
    return;
  }
  for (const btn of AB_BTN) {
    if (hitBtn(x, y, btn.x, btn.y, btn.w, btn.h)) { useAbility(btn.key); return; }
  }
  if (hitBtn(x, y, W-82, 62, 72, 40)) { cashedOut = true; return; }
}

function onUp(x, y) {
  if (gameOver || cashedOut) return;
  for (const btn of AB_BTN) {
    if (hitBtn(x, y, btn.x, btn.y, btn.w, btn.h)) return;
  }
  dropBall();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — BACKGROUND
// ═══════════════════════════════════════════════════════════
function drawBackground() {
  const light = 1 - bgDark;

  if (light > 0.01) {
    ctx.fillStyle = `rgba(240,236,224,${light})`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(200,192,168,${light * 0.75})`;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 18) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  }

  if (bgDark > 0.01) {
    ctx.fillStyle = `rgba(10,10,20,${bgDark})`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(35,35,65,${bgDark * 0.55})`;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    if (!stars) {
      stars = Array.from({ length:32 }, () => ({
        x: Math.random()*W, y: Math.random()*H,
        r: Math.random()*1.5+0.4, t: Math.random()*Math.PI*2
      }));
    }
    stars.forEach(s => {
      s.t += 0.018;
      const a = ((Math.sin(s.t)+1)*0.5) * bgDark;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — STRIPED WALL
// ═══════════════════════════════════════════════════════════
function drawWallBody(body, w, h, glow) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  if (glow) {
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 18;
  }

  ctx.beginPath();
  ctx.rect(-w/2, -h/2, w, h);
  ctx.clip();

  const s = 10;
  for (let i = -h*2; i < w + h*2; i += s*2) {
    ctx.fillStyle = '#111';
    ctx.fillRect(i, -h, s, h*2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(i+s, -h, s, h*2);
  }
  // Rotate stripes 45°
  ctx.resetTransform && ctx.restore() && ctx.save();

  ctx.restore();
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  if (glow) { ctx.shadowColor='#00ffff'; ctx.shadowBlur=18; }

  // Re-draw with proper 45° stripes
  ctx.beginPath();
  ctx.rect(-w/2, -h/2, w, h);
  ctx.clip();

  ctx.fillStyle = '#fff';
  ctx.fillRect(-w/2, -h/2, w, h);

  ctx.fillStyle = '#111';
  for (let d = -h*2; d < w + h*2; d += s*2) {
    ctx.beginPath();
    ctx.moveTo(-w/2 + d, -h/2);
    ctx.lineTo(-w/2 + d + h, h/2);
    ctx.lineTo(-w/2 + d + h + s, h/2);
    ctx.lineTo(-w/2 + d + s, -h/2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = '#111';
  ctx.lineWidth   = 4;
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.strokeRect(-w/2, -h/2, w, h);

  ctx.restore();
}

function drawContainer() {
  drawWallBody(leftWall,  wallThick, wallH,     wallAbilityOn);
  drawWallBody(rightWall, wallThick, wallH,     wallAbilityOn);
  drawWallBody(floor,     floorW,   wallThick,  false);
  if (wallAbilityOn) {
    extraWalls.forEach(w => drawWallBody(w, wallThick, wallH * 0.45, true));
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — FACE
// ═══════════════════════════════════════════════════════════
function drawFace(ball) {
  const r   = ball.r;
  const tier = ball.tier;
  const expr = ball.expression || tier;

  ctx.save();
  ctx.rotate(-ball.body.angle);

  const es  = r * 0.20;
  const esp = r * 0.31;
  const eyY = -r * 0.09;
  const moY = r  * 0.35;

  function eye(ex, ey, type) {
    const white = () => { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,es,0,Math.PI*2); ctx.fill(); };
    const pupil = (ox=0.2,oy=0.1,f=0.6) => {
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+es*ox, ey+es*oy, es*f, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex+es*(ox-0.2), ey+es*(oy-0.3), es*0.25, 0, Math.PI*2); ctx.fill();
    };
    if (type==='dot') {
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,es*0.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+es*0.2,ey,es*0.5,0,Math.PI*2); ctx.fill();
    } else if (type==='half') {
      ctx.save();
      ctx.beginPath(); ctx.arc(ex,ey,es*1.3,0,Math.PI*2); ctx.clip();
      ctx.fillStyle='#fff'; ctx.fillRect(ex-es*1.5,ey-es*1.5,es*3,es*1.5+2); ctx.restore();
      ctx.strokeStyle='#111'; ctx.lineWidth=r*0.04; ctx.beginPath(); ctx.arc(ex,ey,es*1.3,Math.PI,0); ctx.stroke();
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+es*0.2,ey+es*0.2,es*0.65,0,Math.PI*2); ctx.fill();
    } else if (type==='furrow') {
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,es*1.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex,ey+es*0.1,es*0.7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex-es*0.1,ey-es*0.1,es*0.25,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#111'; ctx.lineWidth=r*0.055; ctx.lineCap='round';
      ctx.beginPath();
      if (ex<0){ ctx.moveTo(ex-es*1.3,ey-es*1.6); ctx.lineTo(ex+es*0.8,ey-es*1.1); }
      else     { ctx.moveTo(ex-es*0.8,ey-es*1.1); ctx.lineTo(ex+es*1.3,ey-es*1.6); }
      ctx.stroke();
    } else {
      const bigR = (type==='wide'||type==='star') ? 1.5 : (type==='round'?1.3:1.1);
      white();
      if (bigR!==0.8) { ctx.beginPath(); ctx.arc(ex,ey,es*bigR,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); }
      pupil();
    }
  }

  let eyeT = 'round';
  if (tier===1) eyeT='dot';
  else if (tier===4) eyeT='furrow';
  else if (tier===5||tier===7||tier===8) eyeT='wide';
  else if (tier===6||(expr==='sleepy')) eyeT='half';
  else if (expr==='surprised') eyeT='wide';
  else eyeT='round';
  if (tier===8) eyeT='star';

  eye(-esp, eyY, eyeT);
  eye( esp, eyY, eyeT);

  // Star eye sparkle for tier 8
  if (tier===8) {
    [[- esp,eyY],[esp,eyY]].forEach(([ex,ey])=>{
      ctx.fillStyle='#FFD700';
      for (let k=0; k<4; k++) {
        const a = (k/4)*Math.PI*2;
        const px=ex+Math.cos(a)*es*1.1, py=ey+Math.sin(a)*es*1.1;
        ctx.beginPath(); ctx.arc(px,py,es*0.22,0,Math.PI*2); ctx.fill();
      }
    });
  }

  // Mouth
  ctx.strokeStyle='#111'; ctx.lineWidth=r*0.065; ctx.lineCap='round';
  ctx.beginPath();
  const mT =
    (tier===1||tier===4||(expr==='mad'))  ? 'flat'   :
    (tier===7||(expr==='sad'))             ? 'frown'  :
    (tier===3||tier===8)                   ? 'grin'   :
    (tier===5)                             ? 'smirk'  :
    (tier===2||tier===6||(expr==='sleepy'))? 'gentle' : 'smile';

  if (mT==='flat') {
    ctx.moveTo(-r*0.22, moY); ctx.lineTo(r*0.22, moY);
  } else if (mT==='frown') {
    ctx.arc(0, moY+r*0.28, r*0.24, Math.PI+0.25, -0.25);
  } else if (mT==='grin') {
    ctx.arc(0, moY-r*0.08, r*0.33, 0.1, Math.PI-0.1);
  } else if (mT==='smirk') {
    ctx.moveTo(-r*0.15, moY+r*0.05);
    ctx.quadraticCurveTo(r*0.05, moY-r*0.12, r*0.26, moY-r*0.04);
  } else if (mT==='gentle') {
    ctx.arc(0, moY-r*0.08, r*0.20, 0.25, Math.PI-0.25);
  } else {
    ctx.arc(0, moY-r*0.08, r*0.26, 0.2, Math.PI-0.2);
  }
  ctx.stroke();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — BALL FILL
// ═══════════════════════════════════════════════════════════
function applyFill(ball) {
  const r = ball.r;
  const c = ball.color;
  if (c==='RAINBOW') {
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    [0,40,80,140,200,270,320].forEach((h,i,a)=>g.addColorStop(i/(a.length-1),`hsl(${h},100%,55%)`));
    ctx.fillStyle = g;
  } else if (c==='TIEDYE') {
    const cols = ball.tieDye || ['#f0f','#0ff','#ff0'];
    const g = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.05,0,0,r);
    g.addColorStop(0,cols[0]); g.addColorStop(0.5,cols[1]); g.addColorStop(1,cols[2]);
    ctx.fillStyle = g;
  } else if (c==='PLANET') {
    const pc = PLANET_COLORS[ball.planet] || PLANET_COLORS.earth;
    const g  = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.08,0,0,r);
    g.addColorStop(0,pc[2]); g.addColorStop(0.45,pc[0]); g.addColorStop(1,pc[1]);
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.08,0,0,r);
    g.addColorStop(0, lighten(c, 42));
    g.addColorStop(1, c);
    ctx.fillStyle = g;
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAW — SINGLE BALL
// ═══════════════════════════════════════════════════════════
function drawBall(ball) {
  if (ball.merging) return;
  const r = ball.r;
  const sx = ball.spawning ? ball.popScale : 1.0;

  ctx.save();
  ctx.translate(ball.body.position.x, ball.body.position.y);
  ctx.scale(ball.squishX * sx, ball.squishY * sx);
  ctx.rotate(ball.body.angle);

  applyFill(ball);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();

  // Planet ring for Saturn
  if (ball.planet==='saturn') {
    ctx.strokeStyle='rgba(210,180,100,0.75)';
    ctx.lineWidth = r*0.12;
    ctx.beginPath(); ctx.ellipse(0, r*0.08, r*1.5, r*0.32, 0, 0, Math.PI*2); ctx.stroke();
  }

  ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(2, r*0.065); ctx.stroke();

  const showFace = ball.body.speed < 1.5 || ball.body.isSleeping;
  if (showFace) drawFace(ball);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  DRAW — AIM LINE + DROP PREVIEW
// ═══════════════════════════════════════════════════════════
function drawAimLine() {
  if (gameOver || cashedOut) return;
  const ready = dropCooldown <= 0;
  const td    = TIERS[nextTier - 1];
  const r     = td.radius;
  const clampX = Math.max(lWallX + r, Math.min(rWallX - r, aimX));
  const lineTop = 115;

  ctx.strokeStyle = ready ? 'rgba(255,255,255,0.80)' : 'rgba(136,136,136,0.45)';
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(clampX, lineTop);
  ctx.lineTo(clampX, cTop - r - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // Preview ball
  ctx.save();
  ctx.globalAlpha = ready ? 1.0 : 0.48;
  ctx.translate(clampX, lineTop - r - 4);
  ctx.rotate(0);
  const fakeBall = {
    body:{ position:{x:clampX,y:0}, angle:0, speed:0, isSleeping:true },
    tier: nextTier, r, color: td.color,
    squishX:1, squishY:1, spawning:false, popScale:1,
    expression:null, planet:null, tieDye:null,
    merging:false
  };
  applyFill(fakeBall);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(2,r*0.065); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
//  DRAW — HUD / UI
// ═══════════════════════════════════════════════════════════
function drawUI() {
  // Score & best
  ctx.fillStyle='#fff';
  ctx.font='bold 23px Arial';
  ctx.fillText('Score: '+score, 12, 32);
  ctx.font='17px Arial';
  ctx.fillText('Best: '+bestScore, 12, 55);

  // Global rank (decorative)
  ctx.textAlign='right';
  ctx.font='bold 16px Arial';
  ctx.fillStyle='#fff';
  ctx.fillText('Global #1 - 66540', W-12, 26);
  ctx.textAlign='left';

  // Ability buttons
  const abDefs = [
    { key:'swap',       label:'↺',  sub:'SWAP'  },
    { key:'earthquake', label:'≋',  sub:'QUAKE' },
    { key:'walls',      label:'↑',  sub:'WALLS' },
  ];
  const abX = 12, abStartY = 74, gap = 62;
  ctx.font='bold 11px Arial'; ctx.fillStyle='#ddd';
  ctx.fillText('Abilities:', abX, abStartY - 9);

  abDefs.forEach((def, i) => {
    const bx = abX, by = abStartY + i * gap;
    AB_BTN[i].x = bx; AB_BTN[i].y = by;
    const uses = AB[def.key].uses;

    const g = ctx.createLinearGradient(bx, by, bx, by+54);
    g.addColorStop(0, uses>0 ? '#30C9BB' : '#444');
    g.addColorStop(1, uses>0 ? '#1A907F' : '#2a2a2a');
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, 54, 54, 11); ctx.fill();
    ctx.strokeStyle = uses>0?'rgba(255,255,255,0.6)':'#555';
    ctx.lineWidth=2;
    roundRect(ctx, bx, by, 54, 54, 11); ctx.stroke();

    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.font='bold 20px Arial';
    ctx.fillText(def.label, bx+27, by+28);
    ctx.font='bold 9px Arial';
    ctx.fillText(def.sub, bx+27, by+43);
    ctx.textAlign='left';

    // Badge
    if (uses>0) {
      ctx.fillStyle='rgba(0,0,0,0.7)';
      ctx.beginPath(); ctx.arc(bx+46, by+8, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 11px Arial'; ctx.textAlign='center';
      ctx.fillText(uses, bx+46, by+12); ctx.textAlign='left';
    }
  });

  // Check Out button
  ctx.fillStyle='#222';
  roundRect(ctx, W-82, 62, 72, 40, 18); ctx.fill();
  ctx.strokeStyle='#0dd'; ctx.lineWidth=2;
  roundRect(ctx, W-82, 62, 72, 40, 18); ctx.stroke();
  ctx.fillStyle='#0dd'; ctx.font='bold 11px Arial'; ctx.textAlign='center';
  ctx.fillText('Check Out!', W-46, 87); ctx.textAlign='left';

  // Next Ball preview
  ctx.fillStyle='#ddd'; ctx.font='bold 12px Arial'; ctx.textAlign='right';
  ctx.fillText('Next Ball', W-12, 115);
  ctx.textAlign='left';
  {
    const ntd = TIERS[nextTier-1];
    const nr  = ntd.radius * 0.72;
    const nx  = W-42, ny=138;
    ctx.save();
    ctx.translate(nx, ny);
    const fb = {
      body:{position:{x:nx,y:ny},angle:0,speed:0,isSleeping:true},
      tier:nextTier, r:nr, color:ntd.color,
      squishX:1,squishY:1,spawning:false,popScale:1,
      expression:null,planet:null,tieDye:null,merging:false
    };
    applyFill(fb);
    ctx.beginPath(); ctx.arc(0,0,nr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  }

  // Tier bar
  drawTierBar();

  // Banners
  banners = banners.filter(b => b.life>0);
  banners.forEach(b => {
    b.life--;
    ctx.globalAlpha = Math.min(1, b.life/25);
    ctx.fillStyle='#3080FF';
    roundRect(ctx, 12, 57, 210, 28, 14); ctx.fill();
    ctx.fillStyle='#FFE550'; ctx.font='bold 13px Arial';
    ctx.fillText(b.text, 22, 76);
    ctx.globalAlpha=1;
  });

  // Combo label
  if (comboTimer>0 && comboLabel) {
    ctx.globalAlpha = Math.min(1, comboTimer/30);
    ctx.fillStyle   = comboColor;
    ctx.font        = 'bold 30px Arial';
    ctx.textAlign   = 'center';
    ctx.shadowColor = comboColor; ctx.shadowBlur=12;
    ctx.fillText(comboLabel, W/2, H*0.42);
    ctx.shadowBlur=0; ctx.textAlign='left'; ctx.globalAlpha=1;
  }

  // Score popups
  popups = popups.filter(p=>p.life>0);
  popups.forEach(p => {
    p.life -= 0.018; p.y -= 1.1;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle   = p.color;
    ctx.font        = `bold ${p.combo?24:18}px Arial`;
    ctx.textAlign   = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.textAlign='left'; ctx.globalAlpha=1;
  });
}

function drawTierBar() {
  const by     = H*0.79 + 4;
  const known  = new Set(balls.map(b=>b.tier));
  const startX = W/2 - (TIERS.length*24)/2;

  TIERS.forEach((td, i) => {
    const cx = startX + i*24;
    const r  = 10;
    const isKnown = known.has(td.tier);

    if (isKnown) {
      if (td.color==='RAINBOW') {
        const g=ctx.createLinearGradient(cx-r,by,cx+r,by);
        ['#f00','#f80','#ff0','#0f0','#08f','#80f'].forEach((c,j,a)=>g.addColorStop(j/(a.length-1),c));
        ctx.fillStyle=g;
      } else if (td.color==='TIEDYE') {
        ctx.fillStyle='#e040fb';
      } else if (td.color==='PLANET') {
        ctx.fillStyle='#2244cc';
      } else {
        ctx.fillStyle=td.color;
      }
    } else {
      ctx.fillStyle='#1c1c1c';
    }
    ctx.beginPath(); ctx.arc(cx,by,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#555'; ctx.lineWidth=1.5; ctx.stroke();
    if (!isKnown) {
      ctx.fillStyle='#999'; ctx.font='bold 9px Arial'; ctx.textAlign='center';
      ctx.fillText('?',cx,by+3.5); ctx.textAlign='left';
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  DRAW — OVERLAYS
// ═══════════════════════════════════════════════════════════
function drawOverlay() {
  ctx.fillStyle='rgba(0,0,0,0.72)';
  ctx.fillRect(0,0,W,H);

  ctx.textAlign='center';
  if (cashedOut) {
    ctx.fillStyle='#fff'; ctx.font='bold 38px Arial';
    ctx.fillText('CASHED OUT! 💰', W/2, H*0.28);
  } else {
    ctx.fillStyle='#fff'; ctx.font='bold 46px Arial';
    ctx.shadowColor='#fff'; ctx.shadowBlur=12;
    ctx.fillText('GAME OVER', W/2, H*0.27);
    ctx.shadowBlur=0;
  }

  ctx.fillStyle='#E8913A'; ctx.font='bold 40px Arial';
  ctx.fillText(score, W/2, H*0.41);

  ctx.fillStyle='#aaa'; ctx.font='19px Arial';
  ctx.fillText('Best: '+bestScore, W/2, H*0.51);

  const msg = score>6000?'LEGENDARY!':score>3000?'Outstanding!':score>1500?'Amazing!':score>700?'Nice work!':'Keep going!';
  ctx.fillStyle='#fff'; ctx.font='bold 24px Arial';
  ctx.fillText(msg, W/2, H*0.57);

  // Play Again
  const g = ctx.createLinearGradient(W/2-70,H*0.62,W/2+70,H*0.62+50);
  g.addColorStop(0,'#2EE0D0'); g.addColorStop(1,'#18A090');
  ctx.fillStyle=g;
  roundRect(ctx, W/2-70, H*0.62, 140, 50, 26); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 21px Arial';
  ctx.fillText('PLAY AGAIN', W/2, H*0.62+33);

  ctx.textAlign='left';
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
function loop() {
  requestAnimationFrame(loop);

  // Smoothly transition background
  if (hasTieDye && bgDark < 1) bgDark = Math.min(1, bgDark + 0.004);

  // Cooldown
  if (dropCooldown > 0) dropCooldown--;

  // Squish spring & spawn pop
  balls.forEach(b => {
    b.squishX = lerp(b.squishX, 1, 0.14);
    b.squishY = lerp(b.squishY, 1, 0.14);
    if (b.spawning) {
      b.spawnTick++;
      b.popScale = Math.min(1.0, b.spawnTick / 10);
      if (b.popScale >= 1.0) b.spawning = false;
    }
  });

  // Combo timer
  if (comboTimer > 0) comboTimer--;

  // Screen shake
  const sx = shakeFrames > 0 ? (Math.random()-0.5)*7 : 0;
  const sy = shakeFrames > 0 ? (Math.random()-0.5)*7 : 0;
  if (shakeFrames > 0) shakeFrames--;

  // Walls ability timer
  if (wallAbilityOn) {
    wallAbilityTimer--;
    if (wallAbilityTimer <= 0) {
      wallAbilityOn = false;
      extraWalls.forEach(w=>{ try{ World.remove(world,w); }catch(_){} });
      extraWalls=[];
    }
  }

  // Random banners
  if (!gameOver && !cashedOut) {
    nextBannerIn--;
    if (nextBannerIn<=0) {
      banners.push({ text:randName()+' lost at '+randInt(400,5000), life:180 });
      nextBannerIn = randInt(200,500);
    }
  }

  // Lose check
  if (!gameOver && !cashedOut && balls.length>0) checkLose();

  // Render
  ctx.save();
  if (shakeFrames>0) ctx.translate(sx, sy);

  drawBackground();
  drawContainer();
  balls.forEach(drawBall);
  drawAimLine();

  ctx.restore();
  drawUI();
  if (gameOver || cashedOut) drawOverlay();
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
  container: { flex: 1, backgroundColor: '#000' },
});
