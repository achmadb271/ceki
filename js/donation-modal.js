/**
 * donation-modal.js
 * =================
 * Modal Donasi & Traktir Kopi Developer via QRIS Statis (0% Fee).
 * Mendukung semua m-Banking (BCA, Mandiri, BRI, BNI, dll) dan e-Wallet (GoPay, OVO, Dana, ShopeePay).
 * Mendukung format gambar QRIS: qris.jpeg, qris.jpg, dan qris.png di folder icons/.
 */

import { showAppToast } from './toast.js';

const QRIS_CANDIDATES = [
    'icons/qris.jpeg',
    'icons/qris.jpg',
    'icons/qris.png',
];

const donateModal = document.getElementById('donate-modal');
const donateModalContent = document.getElementById('donate-modal-content');
const btnOpenDonate = document.getElementById('btn-open-donate');
const btnOpenDonateFooter = document.getElementById('btn-open-donate-footer');
const btnCloseDonate = document.getElementById('btn-close-donate');

const qrisImage = document.getElementById('qris-image');
const qrisPlaceholder = document.getElementById('qris-placeholder');
const btnDownloadQris = document.getElementById('btn-download-qris');

let activeQrisSrc = 'icons/qris.jpeg';

export function openDonateModal() {
    if (!donateModal) return;

    if (qrisImage) {
        let candidateIndex = 0;

        qrisImage.onerror = () => {
            // Jika ekstensi gagal load, coba ekstensi berikutnya (jpeg -> jpg -> png)
            candidateIndex++;
            if (candidateIndex < QRIS_CANDIDATES.length) {
                activeQrisSrc = QRIS_CANDIDATES[candidateIndex];
                qrisImage.src = activeQrisSrc;
            } else {
                qrisImage.classList.add('hidden');
                if (qrisPlaceholder) qrisPlaceholder.classList.remove('hidden');
            }
        };

        qrisImage.onload = () => {
            activeQrisSrc = qrisImage.getAttribute('src') || qrisImage.src;
            qrisImage.classList.remove('hidden');
            if (qrisPlaceholder) qrisPlaceholder.classList.add('hidden');
        };

        // Pastikan src terisi
        if (!qrisImage.getAttribute('src')) {
            qrisImage.src = QRIS_CANDIDATES[0];
        }
    }

    donateModal.classList.remove('hidden');
    void donateModalContent.offsetWidth; // trigger reflow
    donateModal.classList.add('donate-modal-visible');
}

export function closeDonateModal() {
    if (!donateModal) return;
    donateModal.classList.remove('donate-modal-visible');
    setTimeout(() => {
        donateModal.classList.add('hidden');
    }, 200);
}

if (btnOpenDonate) {
    btnOpenDonate.addEventListener('click', openDonateModal);
}
if (btnOpenDonateFooter) {
    btnOpenDonateFooter.addEventListener('click', openDonateModal);
}
if (btnCloseDonate) {
    btnCloseDonate.addEventListener('click', closeDonateModal);
}
if (donateModal) {
    donateModal.addEventListener('click', (e) => {
        if (e.target === donateModal) closeDonateModal();
    });
}

if (btnDownloadQris) {
    btnDownloadQris.addEventListener('click', async () => {
        const targetSrc = activeQrisSrc || (qrisImage ? (qrisImage.getAttribute('src') || qrisImage.src) : 'icons/qris.jpeg');
        try {
            const res = await fetch(targetSrc);
            if (!res.ok) throw new Error('File QRIS belum tersedia');
            const blob = await res.blob();
            const ext = targetSrc.split('.').pop().split('?')[0] || 'jpeg';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qris-donasi-ceki.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showAppToast('📥 Gambar QRIS berhasil diunduh!', 'success');
        } catch (err) {
            showAppToast('⚠️ File QRIS belum ditemukan di folder icons/.', 'info');
        }
    });
}
