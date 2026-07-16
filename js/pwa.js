/**
 * pwa.js
 * ======
 * Install-to-homescreen prompt & registrasi service worker buat offline support.
 */

const btnInstall = document.getElementById('btn-install');
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // gapapa kalau gagal register, app tetap jalan normal (cuma gak offline-ready)
        });
    });
}
