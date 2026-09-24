const CACHE = 'punto-ya-cr-v7-60-offline-first-v4';

const CORE = [
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

function shellForPath(pathname = '/') {
  const p = String(pathname || '/').toLowerCase();
  if (/(^|\/)panel(?:\.html)?\/?$/.test(p)) return './panel.html';
  if (/(^|\/)consulta-comprobante(?:\.html)?\/?$/.test(p)) return './consulta-comprobante.html';
  return './index.html';
}

async function cleanNavigationResponse(response) {
  if (!response) return null;
  if (!response.redirected) return response;

  // Safari no acepta una Response con historial de redirección devuelta por
  // un Service Worker para una navegación. Reconstruimos la respuesta final
  // (mismo contenido/status/headers) para eliminar ese historial.
  try {
    const body = await response.clone().blob();
    const headers = new Headers(response.headers);
    headers.delete('location');
    headers.delete('content-length');
    return new Response(body, {
      status: response.ok ? response.status : 200,
      statusText: response.ok ? response.statusText : 'OK',
      headers
    });
  } catch (_) {
    return response;
  }
}

async function fetchClean(request) {
  const response = await fetch(request, { cache: 'no-store' });
  return cleanNavigationResponse(response);
}

async function cacheShell(key, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE);
  await cache.put(key, response.clone()).catch(() => null);
}

async function precacheOne(url) {
  try {
    const response = await fetchClean(new Request(url, { cache: 'reload' }));
    if (response && response.ok) await cacheShell(url, response);
  } catch (_) {
    // La instalación no debe fallar si un recurso opcional no está disponible.
  }
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(Promise.all(CORE.map(precacheOne)));
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
  if (response && (response.ok || response.type === 'opaque') && !response.redirected) {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => null);
  }
  return response;
}

async function refreshNavigation(request, shellKey) {
  try {
    const response = await fetchClean(request);
    if (response && response.ok) await cacheShell(shellKey, response);
    return response;
  } catch (_) {
    return null;
  }
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

  if (request.mode === 'navigate') {
    const shellKey = shellForPath(url.pathname);

    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      let cached = await cache.match(shellKey);

      // Si existe shell local, úsalo inmediatamente y actualiza en segundo plano.
      if (cached) {
        const refresh = refreshNavigation(request, shellKey);
        event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
        return cleanNavigationResponse(cached);
      }

      // Primera visita online: sigue la navegación, elimina el historial de
      // redirección para Safari y guarda el resultado bajo el shell correcto.
      const network = await refreshNavigation(request, shellKey);
      if (network) return network;

      // Último fallback offline por tipo de pantalla. Nunca devolver index.html
      // para panel.html, porque eso mezcla App/POS con Panel del Emprendedor.
      cached = await caches.match(shellKey);
      return cached ? cleanNavigationResponse(cached) : Response.error();
    })());
    return;
  }

  event.respondWith(cacheFirst(request));
});
