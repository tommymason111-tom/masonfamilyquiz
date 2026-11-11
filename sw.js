// Network-first service worker: always ask the server for the latest files (so phones never get stuck on an old
// version of the game), and fall back to the cache only when offline.
const CACHE = 'mason-quiz';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; })
    .catch(() => caches.match(req).then(r => r || Response.error())));
});
