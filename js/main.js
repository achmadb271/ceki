/**
 * main.js
 * =======
 * Entry point & orkestrasi modul.
 */

import './theme.js';

import { getRounds, addRound, resetMatchOnly } from './store.js';
import { renderTable, renderFooter, resetGameOverDismissed } from './render.js';
import { pushUndo, popUndo, resetUndoStack } from './undo.js';
import { resetBurnAnnouncer, syncAnnouncersToRounds } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { startNewMatchTimer, clearMatchTimer, initTimerFromSavedState } from './timer.js';
import { showAppToast, showConfirmModal } from './toast.js';

import './player-names.js';
import './win-modal.js';
import './progress-modal.js';
import './sync-code.js';
import './history-modal.js';
import './donation-modal.js';
import './feedback-modal.js';
import './pwa.js';

const btnAdd = document.getElementById('btn-add');
const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');

btnAdd.addEventListener('click', () => {
    pushUndo();
    const isFirstRound = getRounds().length === 0;
    addRound({ p1: '', p2: '', p3: '', p4: '' });
    if (isFirstRound) {
        startNewMatchTimer();
    }
    renderTable();
    renderFooter();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

btnUndo.addEventListener('click', () => {
    if (!popUndo()) return;
    syncAnnouncersToRounds(getRounds().length);
    resetGameOverDismissed();
    clearActiveInput();
    if (getRounds().length === 0) {
        clearMatchTimer();
    }
    renderTable();
    renderFooter();
});

btnReset.addEventListener('click', () => {
    showConfirmModal('Yakin mau reset skor? Data yang belum disimpan ke Riwayat akan hilang.', () => {
        resetMatchOnly();
        resetUndoStack();
        resetBurnAnnouncer();
        resetGameOverDismissed();
        clearMatchTimer();
        clearActiveInput();
        renderTable();
        renderFooter();
        showAppToast('Skor berhasil di-reset.', 'success');
    });
});

// Topbar Popover Menu
const btnMenuToggle = document.getElementById('btn-menu-toggle');
const quickMenuItems = document.getElementById('quick-menu-items');

if (btnMenuToggle && quickMenuItems) {
    let isMenuOpen = false;

    function openMenu() {
        isMenuOpen = true;
        quickMenuItems.classList.remove('hidden');
        btnMenuToggle.classList.add('is-active');
        btnMenuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
        isMenuOpen = false;
        quickMenuItems.classList.add('hidden');
        btnMenuToggle.classList.remove('is-active');
        btnMenuToggle.setAttribute('aria-expanded', 'false');
    }

    btnMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isMenuOpen) closeMenu();
        else openMenu();
    });

    // Tutup popover saat salah satu item diklik
    quickMenuItems.addEventListener('click', () => {
        if (isMenuOpen) closeMenu();
    });

    document.addEventListener('click', (e) => {
        const container = document.getElementById('quick-menu-container');
        if (container && !container.contains(e.target) && isMenuOpen) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMenuOpen) closeMenu();
    });
}

// Inisialisasi
renderTable();
renderFooter();
initTimerFromSavedState();
