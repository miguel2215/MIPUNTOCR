const CACHE = 'punto-ya-cr-v7-60-offline-first-v3';

const CORE = [
  './',
  './index.html',
  './panel.html',
  './consulta-comprobante.html',
  './manifest.webmanifest',
  './logo-horizontal.png',
  './logo-vertical.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE).catch(error => {
      console.warn('Precarga parcial del shell offline:', error);
      return Promise.all(CORE.map(url => cache.add(url).catch(() => null)));
    }))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
  }
  return response;
}

function refreshInBackground(request) {
  return fetch(request, { cache: 'no-store' })
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        return caches.open(CACHE).then(async cache => {
          await cache.put(request, copy.clone()).catch(() => null);
          // La ruta raíz y /index.html comparten el mismo shell de App/POS.
          if (new URL(request.url).origin === self.location.origin) {
            const path = new URL(request.url).pathname;
            if (path === '/' || path.endsWith('/index.html')) {
              await cache.put('./index.html', copy).catch(() => null);
            }
          }
          return response;
        });
      }
      return response;
    })
    .catch(() => null);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // SDKs externos: cuando ya fueron usados online, quedan disponibles desde caché.
  const isSupabaseSdk = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js');
  const isQrCodeSdk = url.hostname === 'cdnjs.cloudflare.com' && url.pathname.includes('/qrcodejs/');
  if (isSupabaseSdk || isQrCodeSdk) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // OFFLINE-FIRST para navegación: mostrar el shell cacheado inmediatamente y
  // actualizarlo en segundo plano cuando haya red. Evita la pantalla blanca
  // causada por esperar a que falle una petición de red.
  if (request.mode === 'navigate') {
    const refresh = refreshInBackground(request);
    event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
    event.respondWith((async () => {
      const exact = await caches.match(request);
      if (exact) return exact;
      const shell = await caches.match('./index.html');
      if (shell) return shell;
      const network = await refresh;
      return network || Response.error();
    })());
    return;
  }

  event.respondWith(cacheFirst(request));
});
