/**
 * toast.js
 * ========
 * Toast notifikasi custom (gantiin window.alert) + modal konfirmasi custom
 * (gantiin window.confirm, yang sering diblokir di iframe preview).
 */

import { getPlayerNames } from './store.js';

const confirmModal = document.getElementById('confirm-modal');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');
const confirmModalOk = document.getElementById('confirm-modal-ok');

let confirmModalCallback = null;

export function showConfirmModal(message, onConfirm) {
    confirmModalMessage.textContent = message;
    confirmModalCallback = onConfirm;
    confirmModal.classList.remove('hidden');
}

export function hideConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmModalCallback = null;
}

confirmModalCancel.addEventListener('click', hideConfirmModal);
confirmModalOk.addEventListener('click', () => {
    const cb = confirmModalCallback;
    hideConfirmModal();
    if (cb) cb();
});
// Klik di area gelap luar kotak dialog = batal
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) hideConfirmModal();
});

function stackedTop(selector) {
    const existingCount = document.querySelectorAll(selector).length;
    return (16 + existingCount * 58) + 'px';
}

export function showAppToast(message, type = 'info', duration = 2600) {
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    toast.style.top = stackedTop('.app-toast:not(.hide), .burn-toast:not(.hide)');
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

export function showBurnToast(playerKeys) {
    const playerNames = getPlayerNames();
    const names = playerKeys.map(p => playerNames[p]).join(' & ');
    const toast = document.createElement('div');
    toast.className = 'burn-toast';
    toast.textContent = `🔥 ${names} KEBAKAR!`;
    toast.style.top = stackedTop('.burn-toast:not(.hide), .app-toast:not(.hide)');
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, 2200);
}
