const CACHE = 'punto-ya-cr-v7-41';

const CORE = [
  './',
  './index.html',
  './panel.html',
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
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE).catch(() => null)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && (response.ok || response.type === 'opaque')) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : undefined) || Response.error();
  }
}

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

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isSupabaseSdk = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js');
  if (isSupabaseSdk) return event.respondWith(cacheFirst(request));
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request, './index.html'));
  event.respondWith(cacheFirst(request));
});
