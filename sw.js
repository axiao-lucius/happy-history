const CACHE_NAME = 'happy-history-v3';
const ASSETS_TO_CACHE = [
  '/happy-history/',
  '/happy-history/index.html',
  '/happy-history/css/main.css'
];

// Install: pre-cache only static assets (not JS/data)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Fetch: network-first for JS and data files, cache-first for others
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isJSOrData = url.endsWith('.js') || url.endsWith('.json');

  if (isJSOrData) {
    // Network-first: always try fresh copy for code and data
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback from cache
        return caches.match(event.request);
      })
    );
  } else {
    // Cache-first for HTML/CSS/images
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/happy-history/index.html');
          }
        });
      })
    );
  }
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
