const CACHE_NAME = 'hounslow-shell-v1';
const SHELL_FILES = [
  'hounslow-kiosk.html',
  'hounslow-manifest.json',
  'hounslow-icon.svg'
];

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

// Cache-first for the app shell; everything else (Firestore, Storage, fonts)
// goes straight to the network so data and PDFs are never stale.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShellFile = url.origin === self.location.origin &&
    SHELL_FILES.some(f => url.pathname.endsWith(f));

  if (!isShellFile) return; // let the browser handle it normally (network)

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
