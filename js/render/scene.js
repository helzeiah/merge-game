// ═══════════════════════════════════════════════════════════
//  DRAW — BACKGROUND
// ═══════════════════════════════════════════════════════════
function drawBackground() {
  // Layer 1: light cream grid (fades as red sands rises)
  const light = 1 - bgSands;
  if (light > 0.01) {
    ctx.fillStyle='rgba(240,236,224,'+light+')';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(200,192,168,'+(light*0.72)+')';
    ctx.lineWidth=1;
    for (let x=0;x<W;x+=18){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=18){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
  }
  // Layer 2: red sands (tier 9 — fades as galaxy rises)
  const sandsAlpha = bgSands * (1 - bgDark);
  if (sandsAlpha > 0.01) {
    ctx.fillStyle='rgba(62,14,8,'+sandsAlpha+')';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(140,44,18,'+(sandsAlpha*0.45)+')';
    ctx.lineWidth=1;
    for (let x=0;x<W;x+=20){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=20){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
    if (!sandDust) {
      sandDust=[];
      for (let i=0;i<28;i++) sandDust.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3+0.3,t:Math.random()*6.28,vx:(Math.random()-0.5)*0.5});
    }
    sandDust.forEach(function(s){
      s.t+=0.009; s.x+=s.vx; if(s.x<0)s.x+=W; if(s.x>W)s.x-=W;
      ctx.fillStyle='rgba(220,100,30,'+((Math.sin(s.t)+1)*0.5*sandsAlpha)+')';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.283);ctx.fill();
    });
  }
  // Layer 3: galaxy/dark (tier 10)
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
  ctx.beginPath(); ctx.rect(-w/2,-h/2,w,h); ctx.clip();
  ctx.fillStyle = glow ? '#e0ffff' : '#fff'; ctx.fillRect(-w/2,-h/2,w,h);
  ctx.fillStyle = glow ? '#009999' : '#111';
  const s = 10;
  for (let d = -h*2; d < w+h*2; d += s*2) {
    ctx.beginPath();
    ctx.moveTo(-w/2+d,      -h/2);
    ctx.lineTo(-w/2+d+h,     h/2);
    ctx.lineTo(-w/2+d+h+s,   h/2);
    ctx.lineTo(-w/2+d+s,    -h/2);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = glow ? '#00ffff' : '#111';
  ctx.lineWidth = glow ? 7 : 5;
  ctx.strokeRect(-w/2, -h/2, w, h);
  ctx.restore();
}

function drawContainer() {
  drawWallBody(leftWall,  wallThick, wallH,    false);
  drawWallBody(rightWall, wallThick, wallH,    false);
  drawWallBody(floor,     floorW,   wallThick, false);
  if (wallAbilityOn) extraWalls.forEach(function(w){ drawWallBody(w, wallThick, wallH*0.44, true); });
}

// ═══════════════════════════════════════════════════════════
//  DRAW — AIM LINE
// ═══════════════════════════════════════════════════════════
function drawAimLine() {
  if (gameOver||cashedOut) return;
  const ready=dropCooldown<=0;
  const td=TIERS[nextTier-1];
  const r=td.radius;
  const cx=Math.max(CX - cW*0.50 + r, Math.min(CX + cW*0.50 - r, aimX));

  ctx.strokeStyle=ready?'rgba(255,255,255,0.82)':'rgba(136,136,136,0.42)';
  ctx.setLineDash([7,7]); ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,dropZoneY);ctx.lineTo(cx,cTop-r-6);ctx.stroke();
  ctx.setLineDash([]);

  // Preview ball above aim line
  ctx.save();
  ctx.globalAlpha = ready ? 1.0 : 0.45;
  ctx.translate(cx, dropZoneY - r - 4);
  const fb = { tier: nextTier, r, color: td.color, hueOffset: 0,
               planet: null, element: null, tieDye: null };
  applyFill(fb, r);
  circleBlobPath(r, 0); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(3, r * 0.115);
  circleBlobPath(r, 0); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
//  DRAW — HUD
// ═══════════════════════════════════════════════════════════
function drawUI() {
  ctx.fillStyle='#fff'; ctx.font='bold 23px Arial';
  ctx.textAlign='left';
  ctx.fillText('Score: '+score, 12+SAL, 32+SAT);
  ctx.font='17px Arial';
  ctx.fillText('Best: '+bestScore, 12+SAL, 55+SAT);

  ctx.textAlign='right';
  ctx.font='bold 16px Arial'; ctx.fillStyle='#fff';
  if (playerName && myBest !== null) {
    ctx.fillText(playerName, W-12-SAR, 26+SAT);
    ctx.font='14px Arial'; ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.fillText('Best: '+myBest.toLocaleString()+(myRank ? '  #'+myRank : ''), W-12-SAR, 46+SAT);
  }
  ctx.textAlign='left';

  // Ability buttons
  const abDefs=[
    {key:'swap',       icon:'↺', sub:'SWAP'  },
    {key:'earthquake', icon:'≋', sub:'QUAKE' },
    {key:'walls',      icon:'↑', sub:'WALLS' },
  ];
  const abX=12+SAL, abY0=74+SAT, gap=64;
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
  ctx.fillStyle='#222'; roundRect(W-84-SAR,62+SAT,74,40,19);ctx.fill();
  ctx.strokeStyle='#0dd';ctx.lineWidth=2;roundRect(W-84-SAR,62+SAT,74,40,19);ctx.stroke();
  ctx.fillStyle='#0dd';ctx.font='bold 11px Arial';ctx.textAlign='center';
  ctx.fillText('Check Out!',W-47-SAR,87+SAT);ctx.textAlign='left';

  // Next Ball preview (shows nextNextTier — the ball after the one on the aim line)
  ctx.fillStyle='#ddd';ctx.font='bold 12px Arial';ctx.textAlign='right';
  ctx.fillText('Next',W-12-SAR,116+SAT);ctx.textAlign='left';
  const ntd = TIERS[nextNextTier - 1], nr = ntd.radius * 0.74;
  ctx.save(); ctx.translate(W - 44 - SAR, 140 + SAT);
  const fb2 = { tier: nextNextTier, r: nr, color: ntd.color, hueOffset: 0,
                planet: null, element: null, tieDye: null };
  applyFill(fb2, nr); circleBlobPath(nr, 0); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, nr * 0.115);
  circleBlobPath(nr, 0); ctx.stroke();
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
  const spacing=30, dotR=12;
  const totalW=(TIERS.length-1)*spacing;
  const sx=W/2-totalW/2;
  const by=H-38-SAB;
  // Background panel
  const padX=18, padY=10;
  const px=sx-dotR-padX, py=by-dotR-padY, pw=totalW+dotR*2+padX*2, ph=dotR*2+padY*2, pr=10;
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(px+pr,py); ctx.lineTo(px+pw-pr,py); ctx.quadraticCurveTo(px+pw,py,px+pw,py+pr);
  ctx.lineTo(px+pw,py+ph-pr); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-pr,py+ph);
  ctx.lineTo(px+pr,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-pr);
  ctx.lineTo(px,py+pr); ctx.quadraticCurveTo(px,py,px+pr,py); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;ctx.stroke();
  const known = seenTiers;
  TIERS.forEach(function(td,i){
    const cx=sx+i*spacing;
    if (known.has(td.tier)) {
      if(td.color==='RAINBOW'){
        const g=ctx.createLinearGradient(cx-dotR,by,cx+dotR,by);
        ['#f00','#f80','#ff0','#0f0','#08f','#80f'].forEach(function(c,j,a){g.addColorStop(j/(a.length-1),c);});
        ctx.fillStyle=g;
      } else if(td.color==='TIEDYE') ctx.fillStyle='#e040fb';
      else if(td.color==='PLANET')   ctx.fillStyle='#2244cc';
      else ctx.fillStyle=td.color;
    } else { ctx.fillStyle='#1c1c1c'; }
    ctx.beginPath();ctx.arc(cx,by,dotR,0,6.283);ctx.fill();
    ctx.strokeStyle=known.has(td.tier)?'#ccc':'#444';
    ctx.lineWidth=2.5;ctx.stroke();
    if (!known.has(td.tier)){
      ctx.fillStyle='#888';ctx.font='bold 10px Arial';ctx.textAlign='center';
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
