// Service Worker para cachear tiles de OpenStreetMap
const CACHE_NAME = 'map-tiles-cache-v1';
const TILE_CACHE_LIMIT = 500; // Límite de tiles en caché

self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activado');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Solo cachear tiles de OpenStreetMap
  if (url.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request).then((networkResponse) => {
            // Solo cachear respuestas exitosas
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Si no hay red y no está en caché, retornar tile vacío
            return new Response('', {
              status: 503,
              statusText: 'Sin conexión'
            });
          });
        });
      })
    );
  }
});

// Limpiar caché antigua cuando exceda el límite
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAN_CACHE') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        if (keys.length > TILE_CACHE_LIMIT) {
          const toDelete = keys.slice(0, keys.length - TILE_CACHE_LIMIT);
          toDelete.forEach((key) => cache.delete(key));
        }
      });
    });
  }
});