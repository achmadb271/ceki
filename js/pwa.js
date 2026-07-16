/**
 * pwa.js
 * ======
 * Install-to-homescreen prompt, registrasi service worker buat offline
 * support, & notifikasi "ada versi baru" (biar orang yang tab-nya udah lama
 * kebuka / gak pernah hapus cache gak nyangkut di versi lama terus-terusan).
 */

const btnInstall = document.getElementById('btn-install');
const updateBanner = document.getElementById('update-banner');
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnInstall.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
    btnInstall.classList.add('hidden');
});

function showUpdateBanner(waitingWorker) {
    updateBanner.classList.remove('hidden');
    updateBanner.classList.add('update-banner-visible');
    updateBanner.onclick = () => {
        updateBanner.textContent = '🔄 Nge-update...';
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    };
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            // Kejadian kalau SW baru udah kelar ke-install sebelum tab ini sempet
            // pasang listener-nya (misal tab lama di-resume dari background).
            if (registration.waiting && navigator.serviceWorker.controller) {
                showUpdateBanner(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    // 'installed' + ada controller aktif = ini UPDATE (bukan install pertama kali)
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner(newWorker);
                    }
                });
            });

            // Match Ceki bisa berjam-jam gak di-reload - cek berkala ke server
            // siapa tau ada versi baru ke-deploy pas lagi asik main.
            setInterval(() => registration.update(), 30 * 60 * 1000);
        }).catch(() => {
            // gapapa kalau gagal register, app tetap jalan normal (cuma gak offline-ready)
        });
    });

    // SW baru resmi ambil alih kontrol -> reload sekali biar pake aset versi baru.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
    });
}
