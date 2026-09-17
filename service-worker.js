const CACHE = 'mipuntocr-v7-restaurante-mesas-cierre';
const CORE = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE).catch(() => null))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isCoreCode = url.origin === self.location.origin && (
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  );

  if (isCoreCode) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});
