// ═══════════════════════════════════════════════════════════
//  CANVAS  — DPR-scaled for crisp rendering on retina displays
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const dpr    = window.devicePixelRatio || 1;
canvas.width  = Math.round(window.innerWidth  * dpr);
canvas.height = Math.round(window.innerHeight * dpr);
canvas.style.width  = window.innerWidth  + 'px';
canvas.style.height = window.innerHeight + 'px';
ctx.scale(dpr, dpr);
const W = window.innerWidth;
const H = window.innerHeight;

// Safe-area insets — keeps UI clear of notch / Dynamic Island / home indicator
const _saStyle = getComputedStyle(document.documentElement);
const SAT = parseFloat(_saStyle.getPropertyValue('--sat')) || 0;
const SAB = parseFloat(_saStyle.getPropertyValue('--sab')) || 0;
const SAL = parseFloat(_saStyle.getPropertyValue('--sal')) || 0;
const SAR = parseFloat(_saStyle.getPropertyValue('--sar')) || 0;
