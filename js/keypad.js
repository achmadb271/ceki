/**
 * keypad.js
 * =========
 * Interaksi kolom skor & numpad custom bottom-sheet:
 *   - Auto-Lanjut cerdas: tombol OK otomatis melompat ke pemain kosong berikutnya
 *     di ronde yang sama (P1 -> P2 -> P3 -> P4), lalu berubah menjadi "Selesai"
 *     ketika semua pemain di ronde tersebut terisi.
 *   - Konfirmasi anti-salah pencet untuk shortcut tutup ronde (Gope/Triss/Nutup)
 *     jika pemain lain di ronde itu sudah terisi skornya.
 *   - Padding bawah halaman dinamis sesuai tinggi panel keypad.
 */

import { getRounds, saveRounds, players, getPlayerNames } from './store.js';
import { renderFooter, resetGameOverDismissed } from './render.js';
import { pushUndo } from './undo.js';
import { playKeypadClick } from './sound.js';
import { showConfirmModal } from './toast.js';
import { ICONS } from './utils.js';

const tbody = document.getElementById('score-body');
const quickActionsPanel = document.getElementById('quick-actions');
const btnCloseKeypad = document.getElementById('btn-close-keypad');
const btnPrevPlayer = document.getElementById('btn-prev-player');
const btnNextPlayer = document.getElementById('btn-next-player');
const keypadTitle = document.getElementById('keypad-title');
const keypadValuePreview = document.getElementById('keypad-value-preview');
const keypadOkBtn = document.getElementById('keypad-ok');
const bottomDock = document.getElementById('bottom-dock');

let activeInput = null;
let keypadBuffer = '';
let keypadFreshStart = true;
let keypadOpenedAt = 0;

const GOPE_VALUE = 500;
const NUTUP_VALUE = 250;
const TRISS_VALUE = 300;

function findNextEmptyPlayerInRound(index, currentPlayer) {
    const row = getRounds()[index];
    if (!row) return null;
    const startIdx = players.indexOf(currentPlayer);
    for (let step = 1; step < players.length; step++) {
        const candidate = players[(startIdx + step) % players.length];
        if (row[candidate] === '' || row[candidate] === undefined || row[candidate] === null) {
            return candidate;
        }
    }
    return null;
}

function updateOkButtonState() {
    if (!keypadOkBtn || !activeInput) return;
    const index = parseInt(activeInput.getAttribute('data-idx'), 10);
    const player = activeInput.getAttribute('data-player');
    const nextEmpty = findNextEmptyPlayerInRound(index, player);

    if (nextEmpty) {
        keypadOkBtn.innerHTML = `<span>Lanjut</span>${ICONS.arrowRight}`;
    } else {
        keypadOkBtn.innerHTML = `${ICONS.check}<span>Selesai</span>`;
    }
}

function updateKeypadHeader() {
    if (!activeInput) return;
    const index = parseInt(activeInput.getAttribute('data-idx'), 10);
    const player = activeInput.getAttribute('data-player');
    const playerNames = getPlayerNames();
    const pName = playerNames[player] || player.toUpperCase();

    if (keypadTitle) {
        keypadTitle.textContent = `R${index + 1} · ${pName}`;
        keypadTitle.className = `keypad-title player-${player}`;
    }

    if (keypadValuePreview) {
        const val = keypadBuffer !== '' ? keypadBuffer : (activeInput.value !== '' ? activeInput.value : '0');
        keypadValuePreview.textContent = val;
        keypadValuePreview.className = `keypad-preview player-${player}`;
    }

    updateOkButtonState();
}

function highlightActiveRow(inputEl) {
    document.querySelectorAll('#score-body tr').forEach(tr => {
        tr.classList.remove('row-spotlight');
    });
    if (inputEl) {
        const tr = inputEl.closest('tr');
        if (tr) tr.classList.add('row-spotlight');
    }
}

function applyDynamicBottomPadding() {
    if (!quickActionsPanel || quickActionsPanel.classList.contains('hidden')) {
        document.body.style.paddingBottom = '';
        return;
    }
    const keypadH = quickActionsPanel.offsetHeight || 300;
    // Baris TOT (bottom-dock) diposisikan tepat di atas keypad lewat CSS variable ini
    document.documentElement.style.setProperty('--keypad-h', `${keypadH}px`);
    const dockH = bottomDock ? bottomDock.offsetHeight : 0;
    document.body.style.paddingBottom = `${keypadH + dockH + 16}px`;
}

function getCoveredBottomHeight() {
    const keypadH = quickActionsPanel.offsetHeight || 280;
    const dockH = bottomDock ? bottomDock.offsetHeight : 0;
    return keypadH + dockH;
}

function scrollRowIntoSafeViewIfNeeded(inputEl) {
    if (!inputEl) return;
    const tr = inputEl.closest('tr') || inputEl;
    const rect = tr.getBoundingClientRect();
    const panelHeight = getCoveredBottomHeight();
    const safeBottom = window.innerHeight - panelHeight - 16;
    const safeTop = 112; // di bawah sticky topbar + sticky thead

    if (rect.top >= safeTop && rect.bottom <= safeBottom) {
        return;
    }

    setTimeout(() => {
        const updatedRect = tr.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetDocTop = updatedRect.top + scrollTop;
        const desiredTop = Math.max(0, targetDocTop - safeTop);

        window.scrollTo({
            top: desiredTop,
            behavior: 'smooth',
        });
    }, 45);
}

function commitActiveInputAndClosePanel() {
    quickActionsPanel.classList.add('hidden');
    document.body.classList.remove('keypad-open');
    document.body.style.paddingBottom = '';
    highlightActiveRow(null);
    if (activeInput) {
        activeInput.classList.remove('is-active-cell');
        resetGameOverDismissed();
        saveRounds();
        renderFooter();
        activeInput = null;
    }
    keypadBuffer = '';
    keypadFreshStart = true;
}

function syncActiveInputFromBuffer() {
    if (!activeInput) return;
    activeInput.value = keypadBuffer;

    const index = parseInt(activeInput.getAttribute('data-idx'), 10);
    const player = activeInput.getAttribute('data-player');
    const isIncomplete = keypadBuffer === '' || keypadBuffer === '-';
    getRounds()[index][player] = isIncomplete ? '' : parseInt(keypadBuffer, 10);

    updateKeypadHeader();
    renderFooter(true);
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

function moveToPlayerInSameRound(direction = 1) {
    if (!activeInput) return false;
    const index = activeInput.getAttribute('data-idx');
    const player = activeInput.getAttribute('data-player');
    const pIdx = players.indexOf(player);
    const nextPIdx = (pIdx + direction + players.length) % players.length;

    const nextPlayer = players[nextPIdx];
    const nextCell = tbody.querySelector(`.score-input[data-idx="${index}"][data-player="${nextPlayer}"]`);
    if (nextCell) {
        activateCell(nextCell);
        return true;
    }
    return false;
}

function executeClosingShortcut(index, closingPlayer, value) {
    const row = getRounds()[index];
    if (!row) return;

    players.forEach(p => {
        row[p] = (p === closingPlayer) ? value : 0;
    });

    players.forEach(p => {
        const cell = tbody.querySelector(`.score-input[data-idx="${index}"][data-player="${p}"]`);
        if (cell) cell.value = row[p];
    });

    commitActiveInputAndClosePanel();
}

function applyClosingShortcut(label, value) {
    if (!activeInput) return;
    const index = parseInt(activeInput.getAttribute('data-idx'), 10);
    const closingPlayer = activeInput.getAttribute('data-player');
    const row = getRounds()[index];
    if (!row) return;

    const otherFilled = players.some(p => p !== closingPlayer && row[p] !== '' && row[p] !== undefined && row[p] !== null);
    if (otherFilled) {
        const playerNames = getPlayerNames();
        const pName = playerNames[closingPlayer] || closingPlayer.toUpperCase();
        showConfirmModal(
            `Terapkan ${label} (+${value}) untuk ${pName}? Nilai pemain lain di Ronde ${index + 1} akan diubah jadi 0.`,
            () => executeClosingShortcut(index, closingPlayer, value)
        );
        return;
    }

    executeClosingShortcut(index, closingPlayer, value);
}

function handleKeypadKey(key) {
    if (!activeInput || activeInput.disabled) return;
    playKeypadClick();

    if (key === 'ok') {
        const index = parseInt(activeInput.getAttribute('data-idx'), 10);
        const player = activeInput.getAttribute('data-player');
        // Jika user menekan Lanjut saat cell masih kosong, isi otomatis 0 agar ronde cepat selesai
        const row = getRounds()[index];
        if (row && (row[player] === '' || row[player] === undefined)) {
            keypadBuffer = '0';
            syncActiveInputFromBuffer();
        }
        const nextEmpty = findNextEmptyPlayerInRound(index, player);
        if (nextEmpty) {
            const nextCell = tbody.querySelector(`.score-input[data-idx="${index}"][data-player="${nextEmpty}"]`);
            if (nextCell) {
                activateCell(nextCell);
                return;
            }
        }
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
        applyClosingShortcut('Gope', GOPE_VALUE);
        return;
    }

    if (key === 'nutup') {
        applyClosingShortcut('Nutup', NUTUP_VALUE);
        return;
    }

    if (key === 'triss') {
        applyClosingShortcut('Triss', TRISS_VALUE);
        return;
    }

    if (keypadFreshStart) {
        keypadBuffer = '';
        keypadFreshStart = false;
    }
    appendToBuffer(key);
    syncActiveInputFromBuffer();
}

function activateCell(inputEl) {
    if (!inputEl || inputEl.disabled) return;

    if (activeInput === inputEl && !quickActionsPanel.classList.contains('hidden')) {
        return;
    }

    keypadOpenedAt = Date.now();
    const isNewSession = activeInput !== inputEl;

    if (activeInput && isNewSession) {
        saveRounds();
        renderFooter();
    }

    activeInput = inputEl;

    document.querySelectorAll('.score-input').forEach(input => input.classList.remove('is-active-cell'));
    activeInput.classList.add('is-active-cell');

    if (isNewSession) {
        pushUndo();
        keypadBuffer = (activeInput.value || '').toString();
        keypadFreshStart = true;
    }

    updateKeypadHeader();
    highlightActiveRow(activeInput);

    document.body.classList.add('keypad-open');
    quickActionsPanel.classList.remove('hidden');
    applyDynamicBottomPadding();

    scrollRowIntoSafeViewIfNeeded(activeInput);
}

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
    if (Date.now() - keypadOpenedAt < 350) return;

    const tableCard = document.getElementById('scoreboard-card') || tbody;
    const confirmModal = document.getElementById('confirm-modal');
    const isTable = tableCard.contains(e.target);
    const isKeypad = quickActionsPanel.contains(e.target);
    const isDock = bottomDock && bottomDock.contains(e.target);
    const isConfirm = confirmModal && confirmModal.contains(e.target);

    if (!isTable && !isKeypad && !isDock && !isConfirm) {
        if (!quickActionsPanel.classList.contains('hidden')) {
            commitActiveInputAndClosePanel();
        }
    }
});

// Dukungan keyboard fisik (desktop/laptop) selama keypad terbuka:
// 0-9, - / + (ganti tanda), Backspace, Delete (kosongkan), Enter (Lanjut/Selesai),
// ArrowLeft/ArrowRight (pindah pemain), Escape (tutup).
document.addEventListener('keydown', (e) => {
    if (quickActionsPanel.classList.contains('hidden') || !activeInput) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) return;

    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        (t.tagName === 'INPUT' && !t.classList.contains('score-input')))) {
        return;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        commitActiveInputAndClosePanel();
        return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        playKeypadClick();
        moveToPlayerInSameRound(e.key === 'ArrowLeft' ? -1 : 1);
        return;
    }

    let key = null;
    if (/^[0-9]$/.test(e.key)) key = e.key;
    else if (e.key === '-' || e.key === '+') key = 'sign';
    else if (e.key === 'Backspace') key = 'backspace';
    else if (e.key === 'Delete') key = 'clear';
    else if (e.key === 'Enter') key = 'ok';

    if (!key) return;
    e.preventDefault();
    handleKeypadKey(key);
});

window.addEventListener('resize', applyDynamicBottomPadding);

document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        handleKeypadKey(btn.getAttribute('data-key'));
    });
});

/** Dipakai main.js pas reset/undo-ke-kosong biar gak ada kolom "aktif" nyangkut. */
export function clearActiveInput() {
    if (activeInput) activeInput.classList.remove('is-active-cell');
    activeInput = null;
    highlightActiveRow(null);
    quickActionsPanel.classList.add('hidden');
    document.body.classList.remove('keypad-open');
    document.body.style.paddingBottom = '';
}
