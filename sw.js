const CACHE_NAME = 'dako-map-v30';
const TILE_CACHE = 'dako-tiles-v1';

// Dateien, die für die Grundfunktion notwendig sind
const STATIC_ASSETS = [
    './',
    './maps.htm',
    './manifest.json',
    './css/style.css',
    './js/map.js',
    './js/pwa.js',
    './js/ui.js',
    './js/contact.js',
    './js/icons.js',
    './img/icon-192.png',
    './img/icon-512.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
];

// Installation: Statische Dateien cachen
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Aktivierung: Alte Caches aufräumen (falls Version geändert wird)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== TILE_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Anfragen abfangen
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Strategie für Karten-Tiles: Cache First, dann Network (und cachen)
    if (url.hostname.includes('tiles.stadiamaps.com') || url.hostname.includes('thunderforest.com') || url.hostname.includes('openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return fetch(event.request).then((networkResponse) => {
                        // Nur cachen, wenn die Antwort gültig ist (Status 200)
                        // und vom Typ 'cors' (da Stadia ein externer Server ist) oder 'basic'
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                            return networkResponse;
                        }
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 2. Strategie für alles andere: Network First, Fallback auf Cache (für Offline-Modus)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});