const CACHE_NAME = 'happy-history-v2';
const ASSETS_TO_CACHE = [
  '/happy-history/',
  '/happy-history/index.html',
  '/happy-history/css/main.css',
  '/happy-history/js/app.js',
  '/happy-history/js/quizEngine.js',
  '/happy-history/js/adaptiveSystem.js',
  '/happy-history/js/stateManager.js',
  '/happy-history/js/voiceEngine.js',
  '/happy-history/js/scoringSystem.js',
  '/happy-history/js/components/QuizCard.js',
  '/happy-history/js/components/RankReveal.js',
  '/happy-history/js/components/StreakCounter.js',
  '/happy-history/data/k12-history-quiz-v3.json'
];

// Install: pre-cache all resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (event) => {
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
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/happy-history/index.html');
        }
      });
    })
  );
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
