/**
 * pwa.js
 * ======
 * Install-to-homescreen prompt, registrasi service worker untuk offline
 * support, dan modal update versi terbaru.
 */

import { showAppToast } from './toast.js';
import { escapeHtml } from './utils.js';

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
const appVersionLabel = document.getElementById('app-version-label');

let deferredInstallPrompt = null;
let activeWaitingWorker = null;
let swRegistration = null;

const LATEST_RELEASE = {
    version: 'v4.2',
    subtitle: 'Logo & Ikon Aplikasi Baru',
    features: [
        {
            title: 'Logo Baru Ceki 1000 (Kartu + Api Kebakar)',
            desc: 'Ikon homescreen, favicon, dan logo top bar diperbarui dengan desain vector modern yang tajam di semua layar.',
        },
        {
            title: 'Total Skor Tetap Terlihat Saat Input',
            desc: 'Baris TOT menempel tepat di atas keypad lengkap dengan progress bar menuju 1000.',
        },
        {
            title: 'Timer Live & Dukungan Keyboard Fisik',
            desc: 'Timer menyala hijau saat match berlangsung, dan input skor di laptop mendukung angka, Enter, serta panah kiri/kanan.',
        },
    ],
};

const btnMenuToggleEl = document.getElementById('btn-menu-toggle');
function setMenuBadge(on) {
    if (btnMenuToggleEl) btnMenuToggleEl.classList.toggle('has-badge', !!on);
}

if (appVersionLabel) {
    appVersionLabel.textContent = `Ceki ${LATEST_RELEASE.version}`;
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstall) btnInstall.classList.remove('hidden');
    setMenuBadge(true);
});

if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        btnInstall.classList.add('hidden');
        setMenuBadge(false);
    });
}

window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.classList.add('hidden');
    setMenuBadge(false);
});

function renderChangelog(release = LATEST_RELEASE) {
    const data = release && release.version ? release : LATEST_RELEASE;
    if (updateModalBadge) {
        updateModalBadge.textContent = `${data.version} · ${data.subtitle || ''}`;
    }
    if (updateModalList) {
        const features = Array.isArray(data.features) ? data.features : [];
        updateModalList.innerHTML = features.map(f => `
            <div class="changelog-item">
                <span class="changelog-dot" aria-hidden="true"></span>
                <div>
                    <div style="font-size:12px;font-weight:700;color:var(--text-primary);">${escapeHtml(f.title)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(f.desc)}</div>
                </div>
            </div>
        `).join('');
    }
}

async function fetchLatestReleaseInfo() {
    try {
        const res = await fetch(`./release.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && typeof data.version === 'string' && Array.isArray(data.features)) {
            return data;
        }
    } catch (err) {
        // Offline / fallback ke LATEST_RELEASE lokal
    }
    return null;
}

async function openUpdateModal(waitingWorker) {
    if (waitingWorker) activeWaitingWorker = waitingWorker;
    if (updateChip) updateChip.classList.add('hidden');

    // Ambil metadata versi TERBARU dari server (bukan versi lama yang sedang jalan di tab ini)
    const remoteRelease = await fetchLatestReleaseInfo();
    renderChangelog(remoteRelease || LATEST_RELEASE);

    updateModal.classList.remove('hidden');
    void updateModalContent.offsetWidth;
    updateModal.classList.add('is-visible');
}

function closeUpdateModal(showChip = true) {
    updateModal.classList.remove('is-visible');
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
        btnUpdateNow.textContent = 'Memperbarui...';
        activeWaitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
}

if (btnUpdateLater) btnUpdateLater.addEventListener('click', () => closeUpdateModal(true));
if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', () => closeUpdateModal(true));
if (updateModal) {
    updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal) closeUpdateModal(true);
    });
}
if (updateChip) {
    updateChip.addEventListener('click', () => openUpdateModal(activeWaitingWorker));
}

function trackWorkerInstalling(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            openUpdateModal(worker);
        }
    });
}

if ('serviceWorker' in navigator) {
    const initSW = () => {
        navigator.serviceWorker.register('sw.js', { scope: './' }).then((registration) => {
            swRegistration = registration;
            registration.update().catch(() => {});

            if (registration.waiting && navigator.serviceWorker.controller) {
                openUpdateModal(registration.waiting);
            }
            if (registration.installing) {
                trackWorkerInstalling(registration.installing);
            }

            registration.addEventListener('updatefound', () => {
                if (registration.installing) {
                    trackWorkerInstalling(registration.installing);
                }
            });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    registration.update().catch(() => {});
                }
            });

            window.addEventListener('pageshow', (e) => {
                if (e.persisted) {
                    registration.update().catch(() => {});
                }
            });

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

    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
    });
}

if (btnManualUpdateCheck) {
    btnManualUpdateCheck.addEventListener('click', async () => {
        if (!navigator.onLine) {
            showAppToast('HP sedang offline, tidak dapat memeriksa update.', 'info');
            return;
        }

        if (activeWaitingWorker) {
            openUpdateModal(activeWaitingWorker);
            return;
        }

        btnManualUpdateCheck.textContent = 'Memeriksa...';

        if (swRegistration) {
            try {
                await swRegistration.update();
                setTimeout(() => {
                    btnManualUpdateCheck.textContent = 'Cek Update';
                    if (swRegistration.waiting) {
                        openUpdateModal(swRegistration.waiting);
                    } else if (swRegistration.installing) {
                        trackWorkerInstalling(swRegistration.installing);
                    } else {
                        showAppToast(`Aplikasi sudah versi terbaru (${LATEST_RELEASE.version}).`, 'success');
                    }
                }, 800);
            } catch (err) {
                btnManualUpdateCheck.textContent = 'Cek Update';
                showAppToast(`Versi aktif: ${LATEST_RELEASE.version}. Tidak ada update baru.`, 'info');
            }
        } else {
            setTimeout(() => {
                btnManualUpdateCheck.textContent = 'Cek Update';
                showAppToast(`Versi aktif saat ini: ${LATEST_RELEASE.version}`, 'info');
            }, 500);
        }
    });
}
