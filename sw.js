const CACHE_NAME = 'ceki-score-tracker-v35';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
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
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-180.png',
    './icons/qris.jpeg',
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

// Fetch: offline fallback tangguh untuk navigasi app shell, cache-first untuk aset statis
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // Untuk range request (streaming audio browser), bypass langsung ke network
    if (req.headers.has('range')) {
        event.respondWith(fetch(req));
        return;
    }

    // Khusus permintaan navigasi halaman (buka PWA dari homescreen / reload tab):
    // Prioritaskan network jika online agar selalu dapat versi terbaru,
    // tapi jika offline / 404 / gagal, WAJIB fallback ke cached app shell (index.html)!
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                        return networkRes;
                    }
                    // Jika server membalas non-200 (misal 404 path redirect), fallback ke app shell
                    return caches.match(req).then((cached) => {
                        return cached || caches.match('./') || caches.match('./index.html') || networkRes;
                    });
                })
                .catch(() => {
                    // Offline / jaringan terputus -> ambil index.html dari cache
                    return caches.match(req).then((cached) => {
                        return cached || caches.match('./') || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // Aset statis (JS, CSS, Icon, Audio, dan CDN scripts)
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((res) => {
                    // Simpan salinan ke cache jika same-origin atau CDN terpercaya
                    if (res && res.status === 200) {
                        const origin = new URL(req.url).origin;
                        if (origin === self.location.origin || origin.includes('cdnjs.cloudflare.com') || origin.includes('cdn.tailwindcss.com')) {
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
