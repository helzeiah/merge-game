const CACHE = 'merge-v11';

// Only pre-cache the CDN asset — index.html is fetched fresh every time.
const STATIC = [
  'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(STATIC); })
  );
  self.skipWaiting();
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  // Never cache API calls — session nonces are single-use and must never be served stale
  if (e.request.url.includes('workers.dev')) return;

  const path = new URL(e.request.url).pathname;

  // Network-first for own HTML/CSS/JS: always load the latest version on reload.
  // Falls back to cache only when offline. Pushing code updates takes effect
  // next reload without bumping CACHE every time.
  const isOwnJs  = path.endsWith('.js')  && !e.request.url.includes('cdnjs.cloudflare.com');
  const isOwnCss = path.endsWith('.css');
  if (path.endsWith('.html') || path.endsWith('.json') || isOwnCss || isOwnJs ||
      path.endsWith('/merge-game') || path.endsWith('/merge-game/') || path === '/') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        const copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Cache-first for everything else (CDN scripts, icons — content-addressed / never change)
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).then(function(res) {
        const copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        return res;
      });
    })
  );
});
