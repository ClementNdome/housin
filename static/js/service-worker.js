// Service Worker for Kitui Housing Dashboard PWA
const CACHE_NAME = 'kitui-housing-v1';
const DYNAMIC_CACHE_NAME = 'kitui-housing-dynamic-v1';
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

// Install event - cache core resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching core files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Cache failed', error);
            })
    );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all clients immediately
            self.clients.claim()
        ]).then(() => {
            console.log('Service Worker: Activated and controlling clients');
            
            // Notify all clients that a new version is available
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        version: CACHE_NAME
                    });
                });
            });
        })
    );
});

// Network-first strategy for HTML pages (always get latest)
// Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API requests, admin routes, and auth routes
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/signup') ||
        url.pathname.startsWith('/logout') ||
        url.pathname.startsWith('/change-password')) {
        return;
    }

    // For HTML pages - Network First (always get latest)
    if (event.request.mode === 'navigate' || 
        (event.request.headers.get('accept') && 
         event.request.headers.get('accept').includes('text/html'))) {
        
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the latest version
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                        .then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => {
                    // If offline, serve from cache
                    return caches.match(event.request).then(cached => {
                        if (cached) {
                            return cached;
                        }
                        // If no cache, return offline page
                        return caches.match('/');
                    });
                })
        );
        return;
    }

    // For CSS/JS/Images - Stale-While-Revalidate (fast, updates in background)
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$/) ||
        url.pathname.startsWith('/static/')) {
        
        event.respondWith(
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cached => {
                    const networkFetch = fetch(event.request)
                        .then(networkResponse => {
                            // Update cache with new version
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        })
                        .catch(() => {
                            console.log('Network failed, serving cached:', url.pathname);
                        });

                    // Return cached version immediately, update in background
                    if (cached) {
                        // Trigger network update in background
                        networkFetch.catch(() => {});
                        return cached;
                    }
                    
                    // If not in cache, wait for network
                    return networkFetch;
                });
            })
        );
        return;
    }

    // For everything else - Cache then Network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE_NAME)
                                .then(cache => cache.put(event.request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // If fetch fails and we have a cached version, return it
                        return caches.match(event.request);
                    });
            })
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('Service Worker: Skip waiting and activate new version');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_UPDATES') {
        console.log('Service Worker: Checking for updates...');
        // Force update check
        self.registration.update();
    }
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-projects') {
        event.waitUntil(
            // Perform background sync tasks here
            console.log('Service Worker: Syncing projects in background')
        );
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/static/favicon/android-chrome-192x192.png',
        badge: '/static/favicon/favicon-32x32.png',
        vibrate: [200, 100, 200],
        tag: 'kitui-housing-notification',
        data: {
            url: '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification('Kitui Housing Dashboard', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(clientList => {
            // If a window client is already open, focus it
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});