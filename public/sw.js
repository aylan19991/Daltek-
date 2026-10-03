// DALTEK Core Suite - Service Worker (PWA / WebAPK)
const CACHE_NAME = 'daltek-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-android-192.png',
  '/icon-android-512.png',
  '/icon-maskable-512.png',
  '/daltek-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[Service Worker] Non-fatal precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API calls, realtime SSE streams, and downloads to always use live server authoritative state
  if (url.pathname.startsWith('/api/') || event.request.headers.get('accept')?.includes('text/event-stream')) {
    return;
  }

  // Network first with cache fallback for static app assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification listener for ticket calls
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || "DALTEK - C'est votre tour !";
      const options = {
        body: data.body || "Votre numéro est actuellement appelé au guichet.",
        icon: '/icon-android-192.png',
        badge: '/favicon-32x32.png',
        vibrate: [200, 100, 200, 100, 400],
        data: {
          url: data.url || '/'
        }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('[SW Push Error]:', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});
