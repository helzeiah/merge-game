// Merge Game — Cloudflare Worker
// Endpoints: GET /session  POST /score  GET /leaderboard

const ALLOWED_ORIGINS = ['https://helzeiah.com', 'https://helzeiah.github.io'];
const MAX_SCORE       = 999999;
const MAX_NAME_LEN    = 20;
const RATE_LIMIT_HR   = 5; // score submissions per IP per hour

const BAD_WORDS = [
  'fuck','fucking','fucker','motherfucker','shit','shitting','bitch','bitches',
  'cunt','dick','cock','pussy','asshole','bastard','whore','slut',
  'nigger','nigga','faggot','fag','retard','twat','wank','wanker',
  'piss','bullshit','dipshit','jackass','dumbass',
];

const LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '6':'g', '7':'t', '@':'a', '$':'s', '!':'i' };

function normalizeName(s) {
  return s.toLowerCase()
    .replace(/[013456@$!]/g, c => LEET[c] || c)
    .replace(/[^a-z]/g, '');
}

function filterName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > MAX_NAME_LEN) return null;
  if (!/^[a-zA-Z0-9_ .'-]+$/.test(name)) return null;
  const norm = normalizeName(name);
  for (const w of BAD_WORDS) {
    if (norm.includes(w)) return null;
  }
  return name;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow  = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ── /session — issue a signed nonce tied to this game session ──

async function handleSession(env, cors) {
  const nonce     = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const sig       = await hmac(`${nonce}:${timestamp}`, env.SECRET);
  await env.KV.put(`nonce:${nonce}`, timestamp, { expirationTtl: 1800 }); // 30 min TTL
  return json({ nonce, sig }, cors);
}

// ── /score — validate session + score, filter name, write leaderboard ──

async function handleScore(req, env, cors) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, cors, 400); }

  const { nonce, sig, score, name } = body || {};
  if (!nonce || !sig || score == null || !name) return json({ error: 'Missing fields.' }, cors, 400);

  // Verify nonce exists (was issued by /session)
  const stored = await env.KV.get(`nonce:${nonce}`);
  if (!stored) return json({ error: 'Session expired. Start a new game to submit.' }, cors, 400);

  // Verify HMAC — ensures the nonce was issued by this worker, not forged
  const expected = await hmac(`${nonce}:${stored}`, env.SECRET);
  if (sig !== expected) return json({ error: 'Invalid session.' }, cors, 400);

  // Consume nonce — one submission per game session
  await env.KV.delete(`nonce:${nonce}`);

  // Rate limit by IP: max RATE_LIMIT_HR submissions per hour
  const ip      = req.headers.get('CF-Connecting-IP') || 'anon';
  const rateVal = parseInt(await env.KV.get(`rate:${ip}`) || '0');
  if (rateVal >= RATE_LIMIT_HR) {
    return json({ error: 'Too many submissions. Try again in an hour.' }, cors, 429);
  }
  await env.KV.put(`rate:${ip}`, (rateVal + 1).toString(), { expirationTtl: 3600 });

  // Validate score range
  const numScore = parseInt(score);
  if (isNaN(numScore) || numScore < 0 || numScore > MAX_SCORE) {
    return json({ error: 'Invalid score.' }, cors, 400);
  }

  // Filter name for profanity and invalid characters
  const cleanName = filterName(name);
  if (!cleanName) {
    return json({ error: 'Name contains inappropriate content or invalid characters.' }, cors, 400);
  }

  // Write to leaderboard — one entry per name, keep personal best only
  const raw   = await env.KV.get('leaderboard');
  const board = dedupeBoard(raw ? JSON.parse(raw) : []);

  const existingIdx = board.findIndex(e => e.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx !== -1) {
    if (numScore <= board[existingIdx].score) {
      // Not a new personal best — return current rank without writing
      board.sort((a, b) => b.score - a.score);
      const currentRank = board.findIndex(e => e.name.toLowerCase() === cleanName.toLowerCase()) + 1;
      return json({ ok: true, rank: currentRank, name: cleanName, personal_best: false }, cors);
    }
    board.splice(existingIdx, 1); // remove old entry before inserting new best
  }

  const entry = { name: cleanName, score: numScore, date: new Date().toISOString().slice(0, 10) };
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 100);
  await env.KV.put('leaderboard', JSON.stringify(top));

  const rank = top.findIndex(e => e.name === cleanName && e.score === numScore) + 1;
  return json({ ok: true, rank, name: cleanName, personal_best: true }, cors);
}

function dedupeBoard(board) {
  const seen = new Map();
  for (const e of board) {
    const key = e.name.toLowerCase();
    if (!seen.has(key) || e.score > seen.get(key).score) seen.set(key, e);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

// ── /leaderboard — return top 15 ──

async function handleLeaderboard(env, cors) {
  const raw   = await env.KV.get('leaderboard');
  const board = raw ? JSON.parse(raw) : [];
  const clean = dedupeBoard(board);
  if (clean.length !== board.length) await env.KV.put('leaderboard', JSON.stringify(clean.slice(0, 100)));
  return json(clean.slice(0, 15), cors);
}

// ── Entry point ──

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const { pathname } = new URL(req.url);
    try {
      if (pathname === '/session'     && req.method === 'GET')  return handleSession(env, cors);
      if (pathname === '/score'       && req.method === 'POST') return handleScore(req, env, cors);
      if (pathname === '/leaderboard' && req.method === 'GET')  return handleLeaderboard(env, cors);
      return new Response('Not found', { status: 404, headers: cors });
    } catch (e) {
      console.error(e);
      return new Response('Internal error', { status: 500, headers: cors });
    }
  },
};
