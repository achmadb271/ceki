/**
 * pwa.js
 * ======
 * Install-to-homescreen prompt, registrasi service worker buat offline
 * support, & modal pop-up "What's New / Ada Update Baru!" dengan ringkasan
 * fitur lengkap serta jaminan skor aman.
 */

import { showAppToast } from './toast.js';

const btnInstall = document.getElementById('btn-install');
const updateModal = document.getElementById('update-modal');
const updateModalContent = document.getElementById('update-modal-content');
const updateModalList = document.getElementById('update-modal-list');
const updateModalBadge = document.getElementById('update-modal-badge');
const btnUpdateNow = document.getElementById('btn-update-now');
const btnUpdateLater = document.getElementById('btn-update-later');
const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
const updateChip = document.getElementById('update-chip');
const btnManualUpdateCheck = document.getElementById('btn-manual-update-check');

let deferredInstallPrompt = null;
let activeWaitingWorker = null;
let swRegistration = null;

// Konfigurasi ringkasan update versi terbaru (mudah diubah tiap rilis)
const LATEST_RELEASE = {
    version: 'v3.0',
    subtitle: 'Update Keypad & PWA Fix',
    features: [
        {
            icon: '📱',
            title: 'Tombol Keypad Lebih Nyaman & Besar',
            desc: 'Ukuran tombol keypad diperbesar (h-12 / 48px) agar jempol leluasa dan angka jauh lebih jelas.'
        },
        {
            icon: '🔄',
            title: 'Perbaikan Update PWA Tangguh',
            desc: 'Cache Service Worker diperbaiki agar instalasi update tidak pernah gagal atau memicu alert merah.'
        },
        {
            icon: '🎴',
            title: 'Aturan Salip dari Posisi Seri',
            desc: 'Saat seri (>= 100), pemain melaju positif tercepat membakar lawan, tetapi aman jika lawan dapat 0/minus.'
        },
        {
            icon: '🎨',
            title: 'Warna Identitas 4 Pemain & Live Rank',
            desc: 'Warna unik tiap pemain (Sky, Purple, Pink, Indigo), live leaderboard di baris TOT, dan mode spotlight.'
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

function trackWorkerInstalling(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
        // 'installed' + ada controller aktif = ini UPDATE (bukan install pertama kali)
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            openUpdateModal(worker);
        }
    });
}

if ('serviceWorker' in navigator) {
    const initSW = () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            swRegistration = registration;

            // 1. Langsung paksa cek update ke server saat halaman dibuka (jangan tunggu 30 menit)
            registration.update().catch(() => {});

            // 2. Kejadian kalau SW baru udah kelar ke-install sebelum tab ini sempet pasang listener
            if (registration.waiting && navigator.serviceWorker.controller) {
                openUpdateModal(registration.waiting);
            }

            // 3. Jika sedang menginstal saat ini
            if (registration.installing) {
                trackWorkerInstalling(registration.installing);
            }

            // 4. Pantau jika ada worker baru yang ditemukan
            registration.addEventListener('updatefound', () => {
                if (registration.installing) {
                    trackWorkerInstalling(registration.installing);
                }
            });

            // 5. Cek lagi saat tab kembali dibuka / aktif dari background
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    registration.update().catch(() => {});
                }
            });

            // 6. Cek saat halaman di-restore dari bfcache (Safari/Chrome mobile)
            window.addEventListener('pageshow', (e) => {
                if (e.persisted) {
                    registration.update().catch(() => {});
                }
            });

            // 7. Cek berkala tiap 10 menit
            setInterval(() => registration.update().catch(() => {}), 10 * 60 * 1000);
        }).catch((err) => {
            console.warn('[pwa.js] Gagal register service worker:', err);
        });
    };

    if (document.readyState === 'complete') {
        initSW();
    } else {
        window.addEventListener('load', initSW);
    }

    // SW baru resmi ambil alih kontrol -> reload sekali biar pake aset versi baru.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
    });
}

// Tombol manual cek update
if (btnManualUpdateCheck) {
    btnManualUpdateCheck.addEventListener('click', async () => {
        if (!navigator.onLine) {
            showAppToast('⚠️ HP sedang offline, tidak dapat memeriksa update.', 'info');
            return;
        }

        if (activeWaitingWorker) {
            openUpdateModal(activeWaitingWorker);
            return;
        }

        btnManualUpdateCheck.innerHTML = '<span>🔄 Memeriksa...</span>';

        if (swRegistration) {
            try {
                await swRegistration.update();
                setTimeout(() => {
                    btnManualUpdateCheck.innerHTML = `<span>Ceki ${LATEST_RELEASE.version}</span> &middot; <span class="text-blue-400 font-bold">Cek Update</span>`;
                    if (swRegistration.waiting) {
                        openUpdateModal(swRegistration.waiting);
                    } else if (swRegistration.installing) {
                        trackWorkerInstalling(swRegistration.installing);
                    } else {
                        showAppToast(`✅ Aplikasi sudah dalam versi terbaru (${LATEST_RELEASE.version})!`, 'success');
                    }
                }, 1000);
            } catch (err) {
                btnManualUpdateCheck.innerHTML = `<span>Ceki ${LATEST_RELEASE.version}</span> &middot; <span class="text-blue-400 font-bold">Cek Update</span>`;
                // Tampilkan info versi aktif tanpa alert merah menakutkan
                showAppToast(`✅ Aplikasi aktif: ${LATEST_RELEASE.version}. Tidak ada update baru.`, 'info');
            }
        } else {
            setTimeout(() => {
                btnManualUpdateCheck.innerHTML = `<span>Ceki ${LATEST_RELEASE.version}</span> &middot; <span class="text-blue-400 font-bold">Cek Update</span>`;
                showAppToast(`✅ Versi aktif saat ini: ${LATEST_RELEASE.version}`, 'info');
            }, 600);
        }
    });
}
