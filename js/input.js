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
  initSfx(); resumeSfx();
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
  if (hitBtn(x,y,W-84-SAR,62+SAT,74,40)) { cashedOut=true; physicsEnabled=false; gameActive=false; openSubmit(); return; }
}

function onUp(x,y) {
  if (abilityJustPressed) { abilityJustPressed=false; return; }
  if (gameOver||cashedOut) return;
  dropBall();
}
