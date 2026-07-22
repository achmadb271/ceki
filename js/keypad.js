/**
 * keypad.js
 * =========
 * Interaksi kolom skor & numpad custom (input keyboard HP sengaja dimatiin
 * lewat readonly+inputmode="none" di render.js, semua input lewat sini).
 */

import { getRounds, saveRounds, players } from './store.js';
import { renderFooter } from './render.js';
import { pushUndo } from './undo.js';

const tbody = document.getElementById('score-body');
const quickActionsPanel = document.getElementById('quick-actions');

let activeInput = null;
let keypadBuffer = '';       // digit yang lagi diketik buat kolom aktif
let keypadFreshStart = true; // true kalau belum ada tombol numpad dipencet sejak fokus ke kolom ini

const GOPE_VALUE = 500;   // shortcut nilai umum di Ceki
const NUTUP_VALUE = 250;  // nilai buat yang nutup ronde
const TRISS_VALUE = 300;  // shortcut nilai umum lainnya

function commitActiveInputAndClosePanel() {
    quickActionsPanel.classList.add('hidden');
    if (activeInput) {
        activeInput.classList.remove('ring-2', 'ring-blue-500');
        saveRounds();
        renderFooter(); // Hitung mutlak (Game Over bisa ter-trigger di sini)
        activeInput = null;
    }
    keypadBuffer = '';
    keypadFreshStart = true;
}

function syncActiveInputFromBuffer() {
    if (!activeInput) return;
    activeInput.value = keypadBuffer;

    const index = activeInput.getAttribute('data-idx');
    const player = activeInput.getAttribute('data-player');
    const isIncomplete = keypadBuffer === '' || keypadBuffer === '-';
    getRounds()[index][player] = isIncomplete ? '' : parseInt(keypadBuffer, 10);

    renderFooter(true); // Preview live tanpa trigger Game Over prematur
}

function appendToBuffer(str) {
    const sign = keypadBuffer.startsWith('-') ? '-' : '';
    let digits = keypadBuffer.replace('-', '');

    if (digits === '0') {
        if (str === '0' || str === '00') return;
        digits = '';
    }

    if (digits.length >= 5) return;
    digits += str;
    if (digits === '00') digits = '0';

    keypadBuffer = sign + digits;
}

/**
 * Shortcut "tutup ronde": isi kolom aktif dengan `value`, sisa 3 kolom pemain
 * lain di ronde itu otomatis 0, terus langsung commit (kayak nge-OK). Dipakai
 * bareng buat Gope/Nutup/Triss - bedanya cuma angkanya.
 */
function applyClosingShortcut(value) {
    const index = activeInput.getAttribute('data-idx');
    const closingPlayer = activeInput.getAttribute('data-player');
    const row = getRounds()[index];

    players.forEach(p => {
        row[p] = (p === closingPlayer) ? value : 0;
    });

    // Refresh SEMUA kolom di ronde ini di layar (bukan cuma kolom yang lagi aktif)
    players.forEach(p => {
        const cell = tbody.querySelector(`.score-input[data-idx="${index}"][data-player="${p}"]`);
        if (cell) cell.value = row[p];
    });

    commitActiveInputAndClosePanel(); // ronde ini otomatis udah lengkap -> commit kayak nge-OK
}

function handleKeypadKey(key) {
    if (!activeInput || activeInput.disabled) return;

    if (key === 'ok') {
        commitActiveInputAndClosePanel();
        return;
    }

    if (key === 'clear') {
        keypadBuffer = '';
        keypadFreshStart = false;
        syncActiveInputFromBuffer();
        return;
    }

    if (key === 'backspace') {
        if (keypadFreshStart) {
            keypadBuffer = (activeInput.value || '').toString();
            keypadFreshStart = false;
        }
        keypadBuffer = keypadBuffer.slice(0, -1);
        syncActiveInputFromBuffer();
        return;
    }

    if (key === 'sign') {
        if (keypadFreshStart) {
            keypadBuffer = (activeInput.value || '').toString();
            keypadFreshStart = false;
        }
        if (keypadBuffer.startsWith('-')) {
            keypadBuffer = keypadBuffer.slice(1);
        } else if (keypadBuffer !== '') {
            keypadBuffer = '-' + keypadBuffer;
        } else {
            keypadBuffer = '-';
        }
        syncActiveInputFromBuffer();
        return;
    }

    if (key === 'gope') {
        applyClosingShortcut(GOPE_VALUE);
        return;
    }

    if (key === 'nutup') {
        applyClosingShortcut(NUTUP_VALUE);
        return;
    }

    if (key === 'triss') {
        applyClosingShortcut(TRISS_VALUE);
        return;
    }

    // key numerik: '0'-'9' atau '00'
    if (keypadFreshStart) {
        keypadBuffer = '';
        keypadFreshStart = false;
    }
    appendToBuffer(key);
    syncActiveInputFromBuffer();
}

tbody.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('score-input')) {
        const isNewSession = activeInput !== e.target;

        if (activeInput && isNewSession) {
            saveRounds();
            renderFooter(); // Hitung mutlak jika pindah kolom
        }

        activeInput = e.target;

        document.querySelectorAll('.score-input').forEach(input => input.classList.remove('ring-2', 'ring-blue-500'));
        activeInput.classList.add('ring-2', 'ring-blue-500');

        if (isNewSession) {
            pushUndo(); // 1 snapshot per kolom yang mulai diedit, bukan per digit
            keypadBuffer = '';
            keypadFreshStart = true;
        }

        quickActionsPanel.classList.remove('hidden');
    }
});

document.addEventListener('click', (e) => {
    const isInput = e.target.classList.contains('score-input');
    const isQuickActionArea = quickActionsPanel.contains(e.target);

    if (!isInput && !isQuickActionArea) {
        if (!quickActionsPanel.classList.contains('hidden')) {
            commitActiveInputAndClosePanel();
        }
    }
});

document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        handleKeypadKey(btn.getAttribute('data-key'));
    });
});

/** Dipakai main.js pas reset/undo-ke-kosong biar gak ada kolom "aktif" nyangkut. */
export function clearActiveInput() {
    activeInput = null;
    quickActionsPanel.classList.add('hidden');
}
