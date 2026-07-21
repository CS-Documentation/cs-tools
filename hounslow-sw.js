const CACHE_NAME = 'hounslow-shell-v2';
// hounslow-kiosk.html changes frequently during active development — it must
// always be fetched fresh when online (network-first), only falling back to
// cache when genuinely offline. Caching it cache-first (v1's mistake) meant
// every code update silently never reached devices that had already cached it.
const NETWORK_FIRST_FILES = ['hounslow-kiosk.html'];
// Truly static assets: safe to cache-first, they rarely change.
const CACHE_FIRST_FILES = ['hounslow-manifest.json', 'hounslow-icon.svg'];
const SHELL_FILES = [...NETWORK_FIRST_FILES, ...CACHE_FIRST_FILES];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // Firestore/Storage/fonts: straight to network

  if (NETWORK_FIRST_FILES.some(f => url.pathname.endsWith(f))) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (CACHE_FIRST_FILES.some(f => url.pathname.endsWith(f))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
