// Web-only service worker: keeps outfit icons and the app's own static files cached.
const ICONS = 'pt-icons-v1';
const SHELL = 'pt-shell-v1';
const MAX_ICONS = 160;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![ICONS, SHELL].includes(k)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ICONS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Outfit icons: cache-first (they never change for a given cosmetic ID).
  if (url.hostname === 'fortnite-api.com' && url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.open(ICONS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') {
          cache.put(request, res.clone()).then(() => trim(cache));
        }
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages: network-first so updates show up immediately; cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Hashed build assets & brand images: cache-first.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
