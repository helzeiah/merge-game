// ═══════════════════════════════════════════════════════════
//  TIERS  — white only tiny bit bigger than yellow,
//           rainbow only a little bigger than white
// ═══════════════════════════════════════════════════════════
const TIERS = [
  { tier:1,  radius:23, color:'#5BB8FF' },
  { tier:2,  radius:29, color:'#5CD65C' },
  { tier:3,  radius:38, color:'#E85DE8' },
  { tier:4,  radius:44, color:'#E85050' },
  { tier:5,  radius:53, color:'#E8913A' },
  { tier:6,  radius:60, color:'#E8D83A' },
  { tier:7,  radius:66, color:'#DDDDDD' },
  { tier:8,  radius:72, color:'RAINBOW' },
  { tier:9,  radius:60, color:'TIEDYE'  },
  { tier:10, radius:70, color:'PLANET'  },
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
const ELEMENTS = ['fire','water','ice','earth','lightning','wind'];
const ELEMENT_CFG = {
  fire:      { fill:['#FF6B00','#FF3300','#FF9500'], aura:'255,80,0'    },
  water:     { fill:['#00AAFF','#0055CC','#66DDFF'], aura:'0,140,255'   },
  ice:       { fill:['#AADDFF','#66BBEE','#DDEEFF'], aura:'150,220,255' },
  earth:     { fill:['#7B3A0D','#4A5E28','#B06830'], aura:'120,70,15'   },
  lightning: { fill:['#FFE040','#FFCC00','#FFF8B0'], aura:'255,230,0'   },
  wind:      { fill:['#B8FFCC','#5EC870','#E8FFE8'], aura:'80,200,100'  },
};
// Weighted drop — lower tiers drop far more often
const DROP_WEIGHTS = [45, 30, 16, 9];

const COOLDOWN   = 180;     // 1.5s at 120Hz tick rate — slower, more deliberate drops


// Cloudflare Worker — session tokens + leaderboard
const WORKER_URL = 'https://merge-game-worker.helzeiah.workers.dev';
