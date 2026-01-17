// Service Worker for Kitui Housing Dashboard PWA
const CACHE_NAME = 'kitui-housing-v1';
const urlsToCache = [
    '/',
    '/static/css/style.css',
    '/static/favicon/favicon.ico',
    '/static/favicon/android-chrome-192x192.png',
    '/static/favicon/android-chrome-512x512.png',
    '/static/favicon/apple-touch-icon.png',
    '/static/favicon/favicon-32x32.png',
    '/static/favicon/favicon-16x16.png',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://code.jquery.com/jquery-3.6.0.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed', error);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API requests and external resources that shouldn't be cached
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/signup')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request)
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // If fetch fails and we have a cached version, return it
                        return caches.match(event.request);
                    });
            })
    );
});

// Background sync for offline functionality (optional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Perform background sync tasks here
            console.log('Service Worker: Background sync')
        );
    }
});

// Push notifications (optional, for future use)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/static/favicon/android-chrome-192x192.png',
        badge: '/static/favicon/favicon-32x32.png',
        vibrate: [200, 100, 200],
        tag: 'kitui-housing-notification'
    };

    event.waitUntil(
        self.registration.showNotification('Kitui Housing Dashboard', options)
    );
});
