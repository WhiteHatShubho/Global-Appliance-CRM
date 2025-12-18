const CACHE_NAME = 'technician-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        console.log('⚠️ Some assets could not be cached');
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Firebase requests - let them go through network
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('firebaseio')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        console.log('📦 Serving from cache:', event.request.url);
        return response;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Cache successful responses
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Return offline page or cached version
        console.log('❌ Network failed, using cache for:', event.request.url);
        return caches.match(event.request);
      });
    })
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-jobs') {
    event.waitUntil(
      fetch('/api/jobs').then(() => {
        console.log('✅ Jobs synced');
      }).catch(() => {
        console.log('⚠️ Job sync failed');
      })
    );
  }
});

console.log('🚀 Service Worker loaded');
