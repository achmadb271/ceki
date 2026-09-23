/**
 * pwa.js
 * ======
 * Install-to-homescreen prompt, registrasi service worker buat offline
 * support, & modal pop-up "What's New / Ada Update Baru!" dengan ringkasan
 * fitur lengkap serta jaminan skor aman.
 */

const btnInstall = document.getElementById('btn-install');
const updateModal = document.getElementById('update-modal');
const updateModalContent = document.getElementById('update-modal-content');
const updateModalList = document.getElementById('update-modal-list');
const updateModalBadge = document.getElementById('update-modal-badge');
const btnUpdateNow = document.getElementById('btn-update-now');
const btnUpdateLater = document.getElementById('btn-update-later');
const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
const updateChip = document.getElementById('update-chip');

let deferredInstallPrompt = null;
let activeWaitingWorker = null;

// Konfigurasi ringkasan update versi terbaru (mudah diubah tiap rilis)
const LATEST_RELEASE = {
    version: 'v2.6',
    subtitle: 'UI/UX Pro & Arcade Edition',
    features: [
        {
            icon: '🎨',
            title: 'Warna Identitas 4 Pemain',
            desc: 'Warna personal tiap pemain (Sky, Purple, Pink, Indigo) tanpa bentrok dengan indikator merah/kuning/hijau.'
        },
        {
            icon: '👑',
            title: 'Live Leaderboard di Baris TOT',
            desc: 'Badge mahkota 👑, perak 🥈, perunggu 🥉, juru kunci 💀, dan live gap selisih poin dari sang leader.'
        },
        {
            icon: '🔦',
            title: 'Mode Spotlight Ronde',
            desc: 'Baris ronde yang sedang diisi menyala jelas, sementara baris lain redup fokus tanpa salah baris.'
        },
        {
            icon: '⚙️',
            title: 'Manajemen Baris Ronde',
            desc: 'Tap nomor ronde di kolom R untuk opsi cepat: kosongkan nilai ronde atau hapus baris tertentu.'
        }
    ]
};

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

function renderChangelog() {
    if (updateModalBadge) {
        updateModalBadge.textContent = `${LATEST_RELEASE.version} · ${LATEST_RELEASE.subtitle}`;
    }
    if (updateModalList) {
        updateModalList.innerHTML = LATEST_RELEASE.features.map(f => `
            <div class="flex items-start gap-2.5">
                <span class="text-base shrink-0 mt-0.5">${f.icon}</span>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-slate-100">${f.title}</div>
                    <div class="text-[11px] text-slate-400 leading-snug">${f.desc}</div>
                </div>
            </div>
        `).join('');
    }
}

function openUpdateModal(waitingWorker) {
    if (waitingWorker) activeWaitingWorker = waitingWorker;
    if (updateChip) updateChip.classList.add('hidden');
    renderChangelog();
    updateModal.classList.remove('hidden');
    void updateModalContent.offsetWidth; // trigger reflow biar animasi masuk jalan
    updateModal.classList.add('update-modal-visible');
}

function closeUpdateModal(showChip = true) {
    updateModal.classList.remove('update-modal-visible');
    setTimeout(() => {
        updateModal.classList.add('hidden');
        if (showChip && activeWaitingWorker && updateChip) {
            updateChip.classList.remove('hidden');
        }
    }, 200);
}

if (btnUpdateNow) {
    btnUpdateNow.addEventListener('click', () => {
        if (!activeWaitingWorker) {
            window.location.reload();
            return;
        }
        btnUpdateNow.disabled = true;
        btnUpdateNow.innerHTML = '<span>🔄 Memperbarui...</span>';
        activeWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
}

if (btnUpdateLater) {
    btnUpdateLater.addEventListener('click', () => closeUpdateModal(true));
}

if (btnCloseUpdateModal) {
    btnCloseUpdateModal.addEventListener('click', () => closeUpdateModal(true));
}

if (updateModal) {
    updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal) closeUpdateModal(true);
    });
}

if (updateChip) {
    updateChip.addEventListener('click', () => {
        openUpdateModal(activeWaitingWorker);
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            // Kejadian kalau SW baru udah kelar ke-install sebelum tab ini sempet
            // pasang listener-nya (misal tab lama di-resume dari background).
            if (registration.waiting && navigator.serviceWorker.controller) {
                openUpdateModal(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    // 'installed' + ada controller aktif = ini UPDATE (bukan install pertama kali)
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        openUpdateModal(newWorker);
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
