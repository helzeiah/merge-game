// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════
let balls        = [];
let gameActive   = false;
let gameSession  = null; // {nonce, sig} from worker — used to validate score submission
let score        = 0;
let bestScore    = 0;

let playerName   = localStorage.getItem('playerName') || null;
// Dead-ball graveyard — persists across games and page loads
let deadBalls = [];
try { const _db = localStorage.getItem('deadBalls'); if (_db) deadBalls = JSON.parse(_db); } catch(e){}

let myRank       = null;
let myBest       = null;
let gameOver     = false;
let cashedOut    = false;
let nextTier     = randDropTier();
let nextNextTier = randDropTier();
let aimX         = CX;
let dropCooldown = 0;
let seenTiers    = new Set([1,2,3,4]);
let hasTieDye    = false;
let hasPlanet    = false;
let bgSands      = 0;
let bgDark       = 0;
let sandDust     = null;
let loseBean     = null;

let lastMergeMs  = 0;
let comboCount   = 0;
let comboTimer   = 0;
let comboLabel   = '';
let comboColor   = '#fff';
let shakeFrames  = 0;
let popups       = [];
let sparks       = [];
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
let wallStuckBalls   = [];

// Flag to block drop when an ability button was just pressed
let abilityJustPressed = false;

// Quake: multi-pulse state
let quakeActive = false;
let quakeTimer  = 0;      // total frames remaining
let quakePulse  = 0;      // frames until next pulse

// Updated once per frame — avoids Date.now() per-ball
let _frameSec = 0;
