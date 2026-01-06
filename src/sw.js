const CACHE_NAME = 'map-tiles-cache-v1';
const TILE_CACHE_NAME = 'map-tiles-cache';

// Instalar service worker
self.addEventListener('install', (event) => {
  console.log(' Service Worker instalado');
  self.skipWaiting();
});

// Activar service worker
self.addEventListener('activate', (event) => {
  console.log(' Service Worker activado');
  event.waitUntil(clients.claim());
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo cachear tiles de OpenStreetMap
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          // Si está en caché, devolverlo
          if (response) {
            return response;
          }

          // Si no, intentar descargarlo
          return fetch(event.request)
            .then((networkResponse) => {
              // Guardar en caché para futuro uso
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Si no hay red y no está en caché, devolver tile placeholder
              return new Response(null, { status: 404 });
            });
        });
      })
    );
  }
});