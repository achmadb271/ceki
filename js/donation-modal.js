/**
 * donation-modal.js
 * =================
 * Modal Donasi & Traktir Kopi Developer via QRIS Statis (0% Fee).
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
const btnCloseDonate = document.getElementById('btn-close-donate');
const btnDismissDonate = document.getElementById('btn-dismiss-donate');

const qrisImage = document.getElementById('qris-image');
const qrisPlaceholder = document.getElementById('qris-placeholder');
const btnDownloadQris = document.getElementById('btn-download-qris');

let activeQrisSrc = 'icons/qris.jpeg';

export function openDonateModal() {
    if (!donateModal) return;

    if (qrisImage) {
        let candidateIndex = 0;

        qrisImage.onerror = () => {
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

        if (!qrisImage.getAttribute('src')) {
            qrisImage.src = QRIS_CANDIDATES[0];
        }
    }

    donateModal.classList.remove('hidden');
    void donateModalContent.offsetWidth;
    donateModal.classList.add('is-visible');
}

export function closeDonateModal() {
    if (!donateModal) return;
    donateModal.classList.remove('is-visible');
    setTimeout(() => donateModal.classList.add('hidden'), 200);
}

if (btnOpenDonate) btnOpenDonate.addEventListener('click', openDonateModal);
if (btnCloseDonate) btnCloseDonate.addEventListener('click', closeDonateModal);
if (btnDismissDonate) btnDismissDonate.addEventListener('click', closeDonateModal);
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
            showAppToast('Gambar QRIS berhasil diunduh.', 'success');
        } catch (err) {
            showAppToast('File QRIS belum ditemukan di folder icons/.', 'info');
        }
    });
}
