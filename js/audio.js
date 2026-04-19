// ═══════════════════════════════════════════════════════════
//  AUDIO  (Web Audio API — fully synthesised, no files needed)
// ═══════════════════════════════════════════════════════════
let sfx = null;   // AudioContext — created on first user gesture (iOS policy)

function initSfx() {
  if (sfx) return;
  try { sfx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  if (!sfx) return;
  // iOS 17+: shift audio session to 'playback' category so it ignores the ringer switch
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
  // Older iOS: play a silent one-frame buffer to unlock media category
  try {
    const buf = sfx.createBuffer(1, 1, 22050);
    const src = sfx.createBufferSource();
    src.buffer = buf; src.connect(sfx.destination); src.start(0);
  } catch(e){}
}
function resumeSfx() { if (sfx && sfx.state === 'suspended') sfx.resume(); }

// White-noise buffer source of (dur) seconds
function mkNoise(dur) {
  const n   = Math.ceil(sfx.sampleRate * dur);
  const buf = sfx.createBuffer(1, n, sfx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = Math.random()*2-1;
  const src = sfx.createBufferSource();
  src.buffer = buf;
  return src;
}

// Single sine note helper
function mkNote(freq, startT, dur, vol, type) {
  const o = sfx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, startT);
  const g = sfx.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, startT + dur);
  o.connect(g); g.connect(sfx.destination);
  o.start(startT); o.stop(startT + dur + 0.04);
}

// ── Merge: soft wet blob collision — like two water balloons touching ──
function playSlosh(tier) {
  if (!sfx) return;
  resumeSfx();
  const t   = sfx.currentTime + 0.01;
  const vol = 0.18 + Math.min(tier, 8) * 0.015;

  // Layer 1: low-passed noise burst — the "splat" body
  const ns1 = mkNoise(0.28);
  const lp1 = sfx.createBiquadFilter();
  lp1.type  = 'lowpass';
  lp1.frequency.setValueAtTime(600, t);
  lp1.frequency.exponentialRampToValueAtTime(80, t + 0.22);
  lp1.Q.value = 2.0;
  const g1  = sfx.createGain();
  g1.gain.setValueAtTime(vol * 0.9, t + 0.003);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  ns1.connect(lp1); lp1.connect(g1); g1.connect(sfx.destination);
  ns1.start(t); ns1.stop(t + 0.28);

  // Layer 2: pitched "blip" sine — the pitch-bend of the blob
  const freq = Math.max(80, 220 - tier * 12);
  const o   = sfx.createOscillator();
  o.type    = 'sine';
  o.frequency.setValueAtTime(freq * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
  const og  = sfx.createGain();
  og.gain.setValueAtTime(vol * 0.55, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(og); og.connect(sfx.destination);
  o.start(t); o.stop(t + 0.20);
}

// ── Drop: very subtle soft "plop" — barely audible release ──
function playSwoosh() {
  if (!sfx) return;
  resumeSfx();
  const t  = sfx.currentTime + 0.01;
  // A gentle low sine "thud" like releasing a ball
  const o  = sfx.createOscillator();
  o.type   = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
  const g  = sfx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  o.connect(g); g.connect(sfx.destination);
  o.start(t); o.stop(t + 0.11);
}

// ── Combo / achievement chime — tier 5+ merges ──
// Frequencies roughly: C5, Eb5, G5, C6, D5, F#5
const CHIME_HZ = [0,0,0,0,0, 523, 622, 784, 1047, 587, 740];
function playChime(tier, combo) {
  if (!sfx || tier < 5) return;
  resumeSfx();
  const base = CHIME_HZ[Math.min(tier, 10)];
  const t    = sfx.currentTime + 0.01;

  if (combo >= 3) {
    // Insane: rapid ascending arpeggio with shimmer
    mkNote(base,       t,        0.42, 0.32);
    mkNote(base*1.25,  t+0.09,   0.38, 0.28);
    mkNote(base*1.5,   t+0.18,   0.50, 0.33);
    mkNote(base*2,     t+0.27,   0.65, 0.38);
    // Shimmer noise burst
    const sh  = mkNoise(0.25);
    const shf = sfx.createBiquadFilter();
    shf.type  = 'highpass'; shf.frequency.value = 5000;
    const shg = sfx.createGain();
    shg.gain.setValueAtTime(0.06, t+0.20);
    shg.gain.exponentialRampToValueAtTime(0.001, t+0.45);
    sh.connect(shf); shf.connect(shg); shg.connect(sfx.destination);
    sh.start(t+0.20); sh.stop(t+0.45);
  } else if (combo === 2) {
    // Double: warm two-note chime
    mkNote(base,      t,       0.32, 0.27);
    mkNote(base*1.5,  t+0.11,  0.42, 0.29);
  } else {
    // Single high-tier merge: soft warm ding
    mkNote(base,       t,       0.40, 0.25);
    if (tier >= 7) mkNote(base*1.26, t+0.05, 0.34, 0.16); // harmony
    if (tier >= 8) mkNote(base*1.5,  t+0.10, 0.38, 0.13); // third note for rainbow
  }
}

// ── Swap: quick "whoosh" pitch sweep ──
function playSwapSound() {
  if (!sfx) return;
  resumeSfx();
  const t = sfx.currentTime + 0.01;
  const ns = mkNoise(0.20);
  const bf = sfx.createBiquadFilter();
  bf.type = 'bandpass';
  bf.frequency.setValueAtTime(380, t);
  bf.frequency.exponentialRampToValueAtTime(3400, t + 0.14);
  bf.Q.value = 1.8;
  const g = sfx.createGain();
  g.gain.setValueAtTime(0.20, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
  ns.connect(bf); bf.connect(g); g.connect(sfx.destination);
  ns.start(t); ns.stop(t + 0.22);
  mkNote(900,  t + 0.05, 0.16, 0.12);
  mkNote(1340, t + 0.11, 0.13, 0.09);
}

// ── Quake: sub-bass thud + low rumble ──
function playQuakeSound() {
  if (!sfx) return;
  resumeSfx();
  const t = sfx.currentTime + 0.01;
  const o = sfx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(85, t);
  o.frequency.exponentialRampToValueAtTime(24, t + 0.38);
  const g = sfx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.60, t + 0.016);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
  o.connect(g); g.connect(sfx.destination);
  o.start(t); o.stop(t + 0.42);
  const ns = mkNoise(0.42);
  const lp = sfx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 3;
  const ng = sfx.createGain();
  ng.gain.setValueAtTime(0.26, t + 0.02);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  ns.connect(lp); lp.connect(ng); ng.connect(sfx.destination);
  ns.start(t); ns.stop(t + 0.44);
}

// ── Walls: solid clunk + resonant ring ──
function playWallsSound() {
  if (!sfx) return;
  resumeSfx();
  const t = sfx.currentTime + 0.01;
  const o = sfx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(100, t + 0.09);
  const g = sfx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.30, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  o.connect(g); g.connect(sfx.destination);
  o.start(t); o.stop(t + 0.13);
  mkNote(440, t + 0.04, 0.36, 0.15);
  mkNote(660, t + 0.10, 0.30, 0.11);
}
