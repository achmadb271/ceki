/**
 * keypad.js
 * =========
 * Interaksi kolom skor & numpad custom (input keyboard HP sengaja dimatiin
 * lewat readonly+inputmode="none" di render.js, semua input lewat sini).
 */

import { getRounds, saveRounds, players, getPlayerNames } from './store.js';
import { renderFooter } from './render.js';
import { pushUndo } from './undo.js';
import { playKeypadClick } from './sound.js';

const tbody = document.getElementById('score-body');
const tfoot = document.getElementById('score-foot');
const quickActionsPanel = document.getElementById('quick-actions');
const btnCloseKeypad = document.getElementById('btn-close-keypad');
const btnPrevPlayer = document.getElementById('btn-prev-player');
const btnNextPlayer = document.getElementById('btn-next-player');
const keypadTitle = document.getElementById('keypad-title');
const keypadValuePreview = document.getElementById('keypad-value-preview');

let activeInput = null;
let keypadBuffer = '';       // digit yang lagi diketik buat kolom aktif
let keypadFreshStart = true; // true kalau belum ada tombol numpad dipencet sejak fokus ke kolom ini
let keypadOpenedAt = 0;      // timestamp saat keypad dibuka, pencegah glitch auto-close

const GOPE_VALUE = 500;   // shortcut nilai umum di Ceki
const NUTUP_VALUE = 250;  // nilai buat yang nutup ronde
const TRISS_VALUE = 300;  // shortcut nilai umum lainnya

function updateKeypadHeader() {
    if (!activeInput) return;
    const index = activeInput.getAttribute('data-idx');
    const player = activeInput.getAttribute('data-player');
    const playerNames = getPlayerNames();
    const pName = playerNames[player] || player.toUpperCase();

    if (keypadTitle) {
        keypadTitle.textContent = `R${parseInt(index, 10) + 1} · ${pName}`;
    }

    if (keypadValuePreview) {
        const val = keypadBuffer !== '' ? keypadBuffer : (activeInput.value !== '' ? activeInput.value : '0');
        keypadValuePreview.textContent = val;
    }
}

function highlightActiveRow(inputEl) {
    document.querySelectorAll('#score-body tr').forEach(tr => tr.classList.remove('bg-blue-950/40'));
    if (inputEl) {
        const tr = inputEl.closest('tr');
        if (tr) tr.classList.add('bg-blue-950/40');
    }
}

function scrollRowIntoSafeViewIfNeeded(inputEl) {
    if (!inputEl) return;
    const tr = inputEl.closest('tr') || inputEl;
    const rect = tr.getBoundingClientRect();
    const panelHeight = quickActionsPanel.offsetHeight || 250;
    const safeBottom = window.innerHeight - panelHeight - 12;
    const safeTop = 60; // di bawah sticky table header

    // Jika baris SUDAH terlihat di layar dengan aman (tidak tertutup keypad dan tidak tertutup header):
    // TIDAK PERLU SCROLL sama sekali! Ini mencegah glitch/flicker saat ronde masih sedikit (1-5).
    if (rect.top >= safeTop && rect.bottom <= safeBottom) {
        return;
    }

    // Baris di luar area aman (akan tertutup keypad atau di atas header) -> beri padding bawah dan scroll:
    document.body.classList.add('keypad-open');

    // Beri jeda sebentar agar browser mengaplikasikan padding baru sebelum scroll
    setTimeout(() => {
        const updatedRect = tr.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetDocTop = updatedRect.top + scrollTop;
        const desiredTop = Math.max(0, targetDocTop - 65);

        window.scrollTo({
            top: desiredTop,
            behavior: 'smooth'
        });
    }, 40);
}

function commitActiveInputAndClosePanel() {
    quickActionsPanel.classList.add('hidden');
    document.body.classList.remove('keypad-open');
    highlightActiveRow(null);
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

    updateKeypadHeader();
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
 * Pindah ke pemain lain pada ronde yang sama (misal P1 -> P2 -> P3 -> P4)
 * tanpa menutup keypad, sehingga keypad tetap stabil dan tidak naik-turun.
 */
function moveToPlayerInSameRound(direction = 1) {
    if (!activeInput) return false;
    const index = activeInput.getAttribute('data-idx');
    const player = activeInput.getAttribute('data-player');
    const pIdx = players.indexOf(player);
    const nextPIdx = pIdx + direction;

    if (nextPIdx >= 0 && nextPIdx < players.length) {
        const nextPlayer = players[nextPIdx];
        const nextCell = tbody.querySelector(`.score-input[data-idx="${index}"][data-player="${nextPlayer}"]`);
        if (nextCell) {
            activateCell(nextCell);
            return true;
        }
    }
    return false;
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
    playKeypadClick();

    if (key === 'ok') {
        // Jika masih ada player berikutnya di ronde ini, langsung lompat ke player berikutnya!
        // Tanpa menutup keypad (biar tidak ada animasi naik-turun yang menutupi cell).
        const hasNext = moveToPlayerInSameRound(1);
        if (!hasNext) {
            // Sudah player terakhir di ronde ini (P4) -> commit & tutup
            commitActiveInputAndClosePanel();
        }
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

function activateCell(inputEl) {
    if (!inputEl || inputEl.disabled) return;

    // Jika cell ini sudah aktif dan keypad sudah terbuka, abaikan panggilan dobel
    if (activeInput === inputEl && !quickActionsPanel.classList.contains('hidden')) {
        return;
    }

    keypadOpenedAt = Date.now();

    const isNewSession = activeInput !== inputEl;

    if (activeInput && isNewSession) {
        saveRounds();
        renderFooter(); // Hitung mutlak jika pindah kolom
    }

    activeInput = inputEl;

    document.querySelectorAll('.score-input').forEach(input => input.classList.remove('ring-2', 'ring-blue-500'));
    activeInput.classList.add('ring-2', 'ring-blue-500');

    if (isNewSession) {
        pushUndo(); // 1 snapshot per kolom yang mulai diedit, bukan per digit
        keypadBuffer = (activeInput.value || '').toString();
        keypadFreshStart = true;
    }

    updateKeypadHeader();
    highlightActiveRow(activeInput);
    quickActionsPanel.classList.remove('hidden');

    // Scroll hanya jika cell tertutup keypad (mencegah glitch pada ronde yang sudah muat)
    scrollRowIntoSafeViewIfNeeded(activeInput);
}

// Tangani klik langsung pada cell atau padding td agar tidak ada glitch "kebuka lalu ketutup"
tbody.addEventListener('click', (e) => {
    const input = e.target.closest('.score-input') || e.target.closest('td')?.querySelector('.score-input');
    if (input) {
        e.stopPropagation();
        activateCell(input);
    }
});

tbody.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('score-input')) {
        activateCell(e.target);
    }
});

// Cegah klik di dalam area keypad agar tidak dianggap klik di luar
quickActionsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
});

if (btnCloseKeypad) {
    btnCloseKeypad.addEventListener('click', (e) => {
        e.stopPropagation();
        commitActiveInputAndClosePanel();
    });
}

if (btnPrevPlayer) {
    btnPrevPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
        playKeypadClick();
        moveToPlayerInSameRound(-1);
    });
}

if (btnNextPlayer) {
    btnNextPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
        playKeypadClick();
        moveToPlayerInSameRound(1);
    });
}

document.addEventListener('click', (e) => {
    // Abaikan jika keypad baru saja dibuka (mencegah glitch dari event tap/click yang tersisa)
    if (Date.now() - keypadOpenedAt < 400) return;

    const tableCard = tbody.closest('.bg-slate-800\\/50') || tbody;
    const isTable = tableCard.contains(e.target);
    const isKeypad = quickActionsPanel.contains(e.target);

    // Hanya tutup jika klik BENAR-BENAR di luar seluruh kartu tabel skor dan di luar keypad
    if (!isTable && !isKeypad) {
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
    highlightActiveRow(null);
    quickActionsPanel.classList.add('hidden');
    document.body.classList.remove('keypad-open');
}
