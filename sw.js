const CACHE_NAME = 'ceki-score-tracker-v6';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './js/store.js',
    './js/scoring.js',
    './js/timer.js',
    './js/undo.js',
    './js/burn-announcer.js',
    './js/toast.js',
    './js/sound.js',
    './js/render.js',
    './js/player-names.js',
    './js/keypad.js',
    './js/share.js',
    './js/win-modal.js',
    './js/history-modal.js',
    './js/pwa.js',
    './js/main.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-180.png',
];

// Install: cache app shell. SENGAJA gak langsung self.skipWaiting() di sini -
// biar SW baru nunggu dulu ("waiting") sampe user klik banner update di pwa.js,
// biar gak reload tiba-tiba pas lagi di tengah masukin skor.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
    );
});

// pwa.js kirim pesan ini pas user klik banner "Ada update baru".
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate: bersihin cache versi lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first untuk app shell, network-first untuk sisanya (misal CDN library)
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((res) => {
                    // simpan salinan ke cache biar makin lengkap offline-nya (khusus same-origin)
                    if (res && res.status === 200 && new URL(req.url).origin === self.location.origin) {
                        const resClone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return res;
                })
                .catch(() => cached);
        })
    );
});
