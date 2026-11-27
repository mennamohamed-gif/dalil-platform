/* Service worker: keeps a cached holding page so a sleeping instance never shows a 503 */
const CACHE = 'dalil-shell-v2';
const HOLDING = '/offline.html';
const NETWORK_TIMEOUT_MS = 6000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([HOLDING]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]);
    if (res && res.ok) return res;
    // A 503 (instance waking) or a timeout: show the holding page instead.
    if (res && res.status === 503) {
      const holding = await cache.match(HOLDING);
      if (holding) return holding;
      return res;
    }
    if (res) return res;
  } catch (e) {}
  const holding = await cache.match(HOLDING);
  if (holding) return holding;
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation && url.pathname !== HOLDING) {
    event.respondWith(networkFirst(req));
  }
});
