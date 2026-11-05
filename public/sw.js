/* Minimal service worker (replaces vite-plugin-pwa/workbox).
   No build-time precache manifest: hashed asset URLs are discovered at
   runtime and cached on first fetch. PHI is never cached (NetworkOnly). */
const CACHE = 'sm-runtime-v1';
const FONT_CACHE = 'sm-fonts-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // PHI policy: patient data is never cached.
  if (/\/api\/patients/i.test(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Fonts: cache-first.
  if (/fonts\.(googleapis|gstatic)\.com/i.test(url.host)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res && res.status === 200) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((res) => {
              if (res && res.status === 200) cache.put(event.request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Default: network.
  event.respondWith(fetch(event.request));
});