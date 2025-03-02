 // Service Worker实现
const CACHE_NAME = `app-cache-${CONFIG.CACHE_VERSION}`;
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/themes.css',
    '/js/main.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});