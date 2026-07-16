/**
 * main.js
 * =======
 * Entry point. Import semua modul (ngejalanin efek samping wiring event
 * listener masing-masing), lalu urus "+ Ronde Baru" & Reset (dua aksi yang
 * motong lintas beberapa modul sekaligus), dan jalanin render pertama kali.
 *
 * Urutan file (lihat juga README di root project buat peta keseluruhan):
 *   1.  store.js             - localStorage state
 *   2.  scoring.js            - kalkulasi murni (totals, burn, tension)
 *   3.  timer.js               - timer durasi match
 *   4.  undo.js                - undo stack
 *   5.  burn-announcer.js      - notif kebakar (anti dobel)
 *   6.  toast.js                - toast & confirm modal custom
 *   7.  sound.js                - efek suara (Web Audio API) & toggle mute
 *   8.  render.js               - render tabel/footer + deteksi game over
 *   9.  player-names.js         - input nama header
 *   10. keypad.js               - numpad custom
 *   11. share.js                - share hasil ke gambar PNG
 *   12. win-modal.js            - popup menang
 *   13. history-modal.js        - modal riwayat + hapus riwayat
 *   14. pwa.js                  - install prompt & service worker
 *   15. main.js (file ini)      - orkestrasi + init
 */

import { getRounds, addRound, resetMatchOnly } from './store.js';
import { renderTable, renderFooter } from './render.js';
import { pushUndo, popUndo, resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { startNewMatchTimer, clearMatchTimer, initTimerFromSavedState } from './timer.js';
import { showAppToast, showConfirmModal } from './toast.js';

import './player-names.js';
import './win-modal.js';
import './history-modal.js';
import './pwa.js';

const btnAdd = document.getElementById('btn-add');
const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');

btnAdd.addEventListener('click', () => {
    pushUndo();
    const isFirstRound = getRounds().length === 0;
    addRound({ p1: '', p2: '', p3: '', p4: '' });
    if (isFirstRound) {
        startNewMatchTimer(); // ronde pertama beneran mulai di sini -> timer jalan dari sini
    }
    renderTable();
    renderFooter();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

btnUndo.addEventListener('click', () => {
    if (!popUndo()) return;
    if (getRounds().length === 0) {
        clearMatchTimer(); // undo balik ke kondisi bener-bener kosong -> timer dianggap belum mulai
    }
    renderTable();
    renderFooter();
});

btnReset.addEventListener('click', () => {
    showConfirmModal('Yakin mau reset skor? (Data yang belum di-save ke Riwayat akan hilang)', () => {
        resetMatchOnly();
        resetUndoStack();
        resetBurnAnnouncer();
        clearMatchTimer();
        clearActiveInput();
        renderTable();
        renderFooter();
        showAppToast('🔄 Skor berhasil di-reset.', 'success');
    });
});

// Inisialisasi
renderTable();
renderFooter();
initTimerFromSavedState();
