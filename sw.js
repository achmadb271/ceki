const CACHE_NAME = 'ceki-score-tracker-v32';
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
    './js/haptics.js',
    './js/wakelock.js',
    './js/render.js',
    './js/player-names.js',
    './js/keypad.js',
    './js/share.js',
    './js/win-modal.js',
    './js/progress-modal.js',
    './js/sync-code.js',
    './js/history-modal.js',
    './js/pwa.js',
    './js/main.js',
    './audio/burn.mp3',
    './audio/burn2.mp3',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-180.png',
];

// Install: cache app shell secara tangguh (tidak gagal jika salah satu audio tidak ada)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                APP_SHELL.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[sw.js] Gagal cache resource:', url, err.message);
                    })
                )
            );
        })
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

    // Untuk range request (streaming audio browser), bypass langsung ke network
    if (req.headers.has('range')) {
        event.respondWith(fetch(req));
        return;
    }

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
