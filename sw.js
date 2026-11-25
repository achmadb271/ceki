const CACHE_NAME = 'ceki-score-tracker-v421';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './release.json',
    './js/utils.js',
    './js/theme.js',
    './js/store.js',
    './js/scoring.js',
    './js/chart.js',
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
    './js/donation-modal.js',
    './js/feedback-modal.js',
    './js/pwa.js',
    './js/main.js',
    './audio/burn.mp3',
    './audio/warn.mp3',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-180.png',
    './icons/qris.jpeg',
];

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

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    if (req.headers.has('range')) {
        event.respondWith(fetch(req));
        return;
    }

    // release.json selalu network-first agar popup update menampilkan changelog versi BARU, bukan versi lama dari cache
    const reqUrl = new URL(req.url);
    if (reqUrl.pathname.endsWith('/release.json')) {
        event.respondWith(
            fetch(req, { cache: 'no-store' })
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put('./release.json', resClone));
                    }
                    return networkRes;
                })
                .catch(() => caches.match('./release.json'))
        );
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                        return networkRes;
                    }
                    return caches.match(req).then((cached) => {
                        return cached || caches.match('./') || caches.match('./index.html') || networkRes;
                    });
                })
                .catch(() => {
                    return caches.match(req).then((cached) => {
                        return cached || caches.match('./') || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const origin = new URL(req.url).origin;
                        if (origin === self.location.origin || origin.includes('cdnjs.cloudflare.com')) {
                            const resClone = res.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                        }
                    }
                    return res;
                })
                .catch(() => cached);
        })
    );
});
