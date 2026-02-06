const CACHE_NAME = 'qr-studio-3.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './qr.css',
  './qr.js',
  './manifest.json'
];

// External resources to cache (will handle CORS)
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing QR Studio Pro service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app assets');
        // Cache local assets first
        return cache.addAll(ASSETS_TO_CACHE)
          .then(() => {
            // Then try to cache external resources (don't fail if these fail)
            return Promise.allSettled(
              EXTERNAL_RESOURCES.map(url => 
                fetch(url, { mode: 'cors' })
                  .then(response => cache.put(url, response))
                  .catch(err => console.log('[SW] Failed to cache:', url, err))
              )
            );
          });
      })
      .then(() => {
        console.log('[SW] All assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating QR Studio Pro service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200) {
            return response;
          }

          // Cache both basic and cors responses
          if (response.type === 'basic' || response.type === 'cors') {
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('[SW] Cached new resource:', event.request.url);
              })
              .catch(err => console.log('[SW] Cache put failed:', err));
          }

          return response;
        }).catch((error) => {
          console.error('[SW] Fetch failed:', error);
          // Return cached offline page if you have one, or just fail gracefully
          return caches.match('./index.html');
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received skip waiting message');
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-qr-history') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncQRHistory());
  }
});

async function syncQRHistory() {
  console.log('[SW] Syncing QR history...');
  // Add your sync logic here
  return Promise.resolve();
}