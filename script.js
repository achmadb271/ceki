/**
 * Score Tracker 1000 - Ceki
 * ==========================
 * Logic utama app pencatat skor Ceki 4 pemain.
 *
 * Daftar isi (cari komentar section di bawah buat lompat langsung):
 *   1.  Setup Input Nama di Header
 *   2.  Kalkulasi Total & Deteksi Player Gosong     (aturan kebakar: skor >=100 & kesalip)
 *   2b. Deteksi "Sikut-sikutan"                     (preview live sebelum ronde final)
 *   3.  Render Tabel
 *   4.  Render Footer, Cek Menang, & Visual Gosong
 *   5.  Interaksi Kolom & Numpad                    (input angka custom, bukan keyboard HP)
 *   6.  Simpan ke Riwayat Match & Share Gambar
 *   6b. Share Hasil sebagai PNG (html2canvas)
 *   7.  Modal Riwayat
 *   8.  Tambah Ronde, Undo, & Reset
 *   9.  Backup / Restore Data (Export & Import JSON)
 *   10. PWA: Install Prompt & Service Worker
 *
 * State disimpan di localStorage (lihat konstanta *_KEY di bawah), jadi data
 * tetap ada walau tab/browser ditutup. Undo pakai in-memory stack terpisah
 * (gak di-persist), reset kalau reload halaman.
 */

const SCORE_KEY = 'score_tracker_state';
const NAME_KEY = 'score_tracker_names';
const HISTORY_KEY = 'score_tracker_history';
const MATCH_START_KEY = 'score_tracker_match_start';
const MATCH_END_KEY = 'score_tracker_match_end';

let state = JSON.parse(localStorage.getItem(SCORE_KEY)) || [{ p1: '', p2: '', p3: '', p4: '' }];
let playerNames = JSON.parse(localStorage.getItem(NAME_KEY)) || { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4' };
let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

let matchStartTime = parseInt(localStorage.getItem(MATCH_START_KEY)) || Date.now();
if (!localStorage.getItem(MATCH_START_KEY)) {
    localStorage.setItem(MATCH_START_KEY, String(matchStartTime));
}
let matchEndTime = parseInt(localStorage.getItem(MATCH_END_KEY)) || null;

const players = ['p1', 'p2', 'p3', 'p4'];
let activeInput = null;

const tbody = document.getElementById('score-body');
const tfoot = document.getElementById('score-foot');
const btnAdd = document.getElementById('btn-add');
const btnReset = document.getElementById('btn-reset');
const btnUndo = document.getElementById('btn-undo');
const winnerBanner = document.getElementById('winner-banner');
const quickActionsPanel = document.getElementById('quick-actions');
const matchTimerEl = document.getElementById('match-timer');

const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file-input');
const btnInstall = document.getElementById('btn-install');

const confirmModal = document.getElementById('confirm-modal');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');
const confirmModalOk = document.getElementById('confirm-modal-ok');

// --- Modal konfirmasi custom (gantiin window.confirm bawaan browser, yang sering diblokir di iframe preview) ---
let confirmModalCallback = null;

function showConfirmModal(message, onConfirm) {
    confirmModalMessage.textContent = message;
    confirmModalCallback = onConfirm;
    confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
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

// --- Toast notifikasi custom (gantiin window.alert bawaan browser) ---
function showAppToast(message, type = 'info', duration = 2600) {
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.textContent = message;
    const existingCount = document.querySelectorAll('.app-toast:not(.hide), .burn-toast:not(.hide)').length;
    toast.style.top = (16 + existingCount * 58) + 'px';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// --- Timer durasi pertandingan ---
let timerInterval = null;

function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function updateTimerDisplay() {
    if (!matchTimerEl) return;
    const end = matchEndTime || Date.now();
    matchTimerEl.textContent = '⏱️ ' + formatDuration(end - matchStartTime);
}

function startMatchTimer() {
    stopMatchTimer();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopMatchTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

function markMatchEndIfNeeded() {
    if (!matchEndTime) {
        matchEndTime = Date.now();
        localStorage.setItem(MATCH_END_KEY, String(matchEndTime));
    }
    stopMatchTimer();
    updateTimerDisplay();
}

function startNewMatchTimer() {
    matchStartTime = Date.now();
    matchEndTime = null;
    localStorage.setItem(MATCH_START_KEY, String(matchStartTime));
    localStorage.removeItem(MATCH_END_KEY);
    startMatchTimer();
}

// --- Undo stack ---
const MAX_UNDO = 50;
let undoStack = [];

function pushUndo() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoButton();
}

function updateUndoButton() {
    btnUndo.disabled = undoStack.length === 0;
}

function undoLastAction() {
    if (undoStack.length === 0) return;
    state = JSON.parse(undoStack.pop());
    saveState();
    renderTable();
    renderFooter();
    updateUndoButton();
}

// --- Notif "kebakar" ---
let lastAnnouncedRoundIndex = -1;

function showBurnToast(playerKeys) {
    const names = playerKeys.map(p => playerNames[p]).join(' & ');
    const toast = document.createElement('div');
    toast.className = 'burn-toast';
    toast.textContent = `🔥 ${names} KEBAKAR!`;
    const existingCount = document.querySelectorAll('.burn-toast:not(.hide), .app-toast:not(.hide)').length;
    toast.style.top = (16 + existingCount * 58) + 'px';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, 2200);
}

function checkAndAnnounceBurns(burnHistory, isLastRowFinished) {
    if (!isLastRowFinished) return;
    const lastIdx = burnHistory.length - 1;
    if (lastIdx <= lastAnnouncedRoundIndex) return;
    const burnsThisRound = burnHistory[lastIdx] || [];
    if (burnsThisRound.length > 0) {
        showBurnToast(burnsThisRound);
    }
    lastAnnouncedRoundIndex = lastIdx;
}

// 1. Setup Input Nama di Header
document.querySelectorAll('.name-input').forEach(input => {
    const playerKey = input.getAttribute('data-player');
    input.value = playerNames[playerKey];

    input.addEventListener('input', (e) => {
        playerNames[playerKey] = e.target.value || playerKey.toUpperCase();
        localStorage.setItem(NAME_KEY, JSON.stringify(playerNames));
        renderFooter();
    });
});

function saveState() {
    localStorage.setItem(SCORE_KEY, JSON.stringify(state));
}

// 2. Kalkulasi Total & Deteksi Player Gosong
function calculateTotals(customState) {
    const rows = customState || state;
    const BURN_THRESHOLD = 100; // Skor minimal biar bisa "kebakar" kalau disalip
    let currentTotals = { p1: 0, p2: 0, p3: 0, p4: 0 };
    let burnHistory = []; // Simpan data siapa yang gosong di setiap ronde

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let prevTotals = { ...currentTotals };
        let tempTotals = { ...currentTotals };
        let burnedInThisRound = [];

        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            tempTotals[p] += parseInt(row[p]) || 0;
        });

        const isRowFinished = row.p1 !== '' && row.p2 !== '' && row.p3 !== '' && row.p4 !== '';

        if (isRowFinished) {
            let burnedPlayers = new Set();

            ['p1', 'p2', 'p3', 'p4'].forEach(playerA => {
                // Mode "kebakar" cuma aktif kalau skor player itu SEBELUM ronde ini
                // udah minimal 100. Di bawah itu, disalip ya wajar, gak kena hukuman.
                if (prevTotals[playerA] < BURN_THRESHOLD) return;

                ['p1', 'p2', 'p3', 'p4'].forEach(playerB => {
                    if (playerA !== playerB) {
                        if (prevTotals[playerA] > prevTotals[playerB] && tempTotals[playerB] > tempTotals[playerA]) {
                            burnedPlayers.add(playerA); // Lagi di atas 100, terus disalip -> gosong!
                        }
                    }
                });
            });

            burnedPlayers.forEach(p => {
                tempTotals[p] = 0; // Hukuman reset 0
                burnedInThisRound.push(p);
            });
        }

        burnHistory.push(burnedInThisRound);
        currentTotals = tempTotals;
    }

    return { totals: currentTotals, burnHistory };
}

// 2b. Deteksi "sikut-sikutan" - preview live siapa yang KEMUNGKINAN kesalip/nyalip
// di ronde yang lagi diketik (belum lengkap 4 kolom), pakai angka yang udah ke-input sejauh ini.
function getLiveOvertakeWarnings() {
    const atRisk = new Set();     // udah di atas 100, lagi keancem kesalip -> bakal kebakar
    const overtaking = new Set(); // yang lagi nyalip dia

    if (state.length < 1) return { atRisk, overtaking };

    const lastIdx = state.length - 1;
    const { totals: prevTotals } = calculateTotals(state.slice(0, lastIdx));
    const row = state[lastIdx];
    const previewTemp = { ...prevTotals };
    players.forEach(p => { previewTemp[p] += parseInt(row[p]) || 0; });

    const BURN_THRESHOLD = 100;
    players.forEach(a => {
        if (prevTotals[a] < BURN_THRESHOLD) return;
        players.forEach(b => {
            if (a === b) return;
            if (prevTotals[a] > prevTotals[b] && previewTemp[b] > previewTemp[a]) {
                atRisk.add(a);
                overtaking.add(b);
            }
        });
    });

    return { atRisk, overtaking };
}

// 3. Render Tabel (Input Keyboard Nonaktif & Disiapkan Border transparan untuk efek Gosong)
function renderTable() {
    tbody.innerHTML = '';
    state.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-700/50";
        tr.innerHTML = `
      <td class="p-1 text-center text-xs font-bold text-slate-500">${index + 1}</td>
      <td class="p-1"><input type="text" inputmode="none" readonly data-idx="${index}" data-player="p1" value="${row.p1}" class="score-input w-full bg-slate-800/80 text-white border border-transparent text-center p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all cursor-pointer select-none"></td>
      <td class="p-1"><input type="text" inputmode="none" readonly data-idx="${index}" data-player="p2" value="${row.p2}" class="score-input w-full bg-slate-800/80 text-white border border-transparent text-center p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all cursor-pointer select-none"></td>
      <td class="p-1"><input type="text" inputmode="none" readonly data-idx="${index}" data-player="p3" value="${row.p3}" class="score-input w-full bg-slate-800/80 text-white border border-transparent text-center p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all cursor-pointer select-none"></td>
      <td class="p-1"><input type="text" inputmode="none" readonly data-idx="${index}" data-player="p4" value="${row.p4}" class="score-input w-full bg-slate-800/80 text-white border border-transparent text-center p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all cursor-pointer select-none"></td>
    `;
        tbody.appendChild(tr);
    });
}

// 4. Render Footer, Pengecekan Kemenangan, & Visual Gosong
function renderFooter(isPreview = false) {
    const { totals, burnHistory } = calculateTotals();

    // Update Visual Warna "Gosong"
    document.querySelectorAll('.score-input').forEach(input => {
        const idx = input.getAttribute('data-idx');
        const p = input.getAttribute('data-player');

        if (burnHistory[idx] && burnHistory[idx].includes(p)) {
            // Ganti warna jadi merah kalau gosong di baris ini
            input.classList.remove('bg-slate-800/80', 'text-white', 'border-transparent');
            input.classList.add('bg-red-950', 'text-red-400', 'border-red-600', 'font-black');
        } else {
            // Kembalikan ke normal
            input.classList.remove('bg-red-950', 'text-red-400', 'border-red-600', 'font-black');
            input.classList.add('bg-slate-800/80', 'text-white', 'border-transparent');
        }
    });

    const hasReached1000 = players.some(p => totals[p] >= 1000);
    const lastRow = state[state.length - 1];
    const isCurrentRoundFinished = lastRow.p1 !== '' && lastRow.p2 !== '' && lastRow.p3 !== '' && lastRow.p4 !== '';

    // "Sikut-sikutan" - highlight deg-degan buat ronde yang LAGI diketik (belum lengkap 4 kolom).
    // Begitu rondenya lengkap, status kebakar udah pasti (ditangani warna merah di atas), jadi preview ini gak perlu lagi.
    document.querySelectorAll('.score-input').forEach(input => {
        input.classList.remove('tense-atrisk', 'tense-overtaking');
    });
    if (!isCurrentRoundFinished) {
        const { atRisk, overtaking } = getLiveOvertakeWarnings();
        const lastIdx = state.length - 1;
        players.forEach(p => {
            const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
            if (!cell) return;
            if (atRisk.has(p)) cell.classList.add('tense-atrisk');
            else if (overtaking.has(p)) cell.classList.add('tense-overtaking');
        });
    }

    // Notif & animasi pas ada yang baru kebakar (cuma pas ronde beneran baru selesai, bukan preview)
    if (!isPreview) {
        checkAndAnnounceBurns(burnHistory, isCurrentRoundFinished);
        const lastIdx = burnHistory.length - 1;
        const freshBurns = burnHistory[lastIdx] || [];
        if (isCurrentRoundFinished && freshBurns.length > 0) {
            freshBurns.forEach(p => {
                const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
                if (cell) {
                    cell.classList.remove('burn-flicker');
                    // trigger reflow biar animasi bisa diulang
                    void cell.offsetWidth;
                    cell.classList.add('burn-flicker');
                }
            });
        }
    }

    const isGameOver = !isPreview && hasReached1000 && isCurrentRoundFinished;

    let winners = [];
    let losers = [];
    let minScore = 0;

    if (isGameOver) {
        winners = players.filter(p => totals[p] >= 1000);
        minScore = Math.min(totals.p1, totals.p2, totals.p3, totals.p4);
        losers = players.filter(p => totals[p] === minScore);
    }

    const getColor = (player) => {
        if (!isGameOver) return 'text-white';
        if (winners.includes(player)) return 'text-green-400 font-black';
        if (losers.includes(player)) return 'text-red-400';
        return 'text-slate-400';
    };

    tfoot.innerHTML = `
    <tr class="bg-slate-900 font-bold text-xl sticky bottom-0 border-t-2 border-slate-600 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.5)] transition-colors z-30">
      <td class="p-3 text-center text-blue-400 text-sm">TOT</td>
      <td class="p-3 text-center ${getColor('p1')}">${totals.p1}</td>
      <td class="p-3 text-center ${getColor('p2')}">${totals.p2}</td>
      <td class="p-3 text-center ${getColor('p3')}">${totals.p3}</td>
      <td class="p-3 text-center ${getColor('p4')}">${totals.p4}</td>
    </tr>
  `;

    if (!isPreview) {
        if (isGameOver) {
            markMatchEndIfNeeded();
            const durationText = formatDuration((matchEndTime || Date.now()) - matchStartTime);
            const winnerDisplay = winners.map(w => playerNames[w]).join(' & ');
            const loserDisplay = losers.map(l => playerNames[l]).join(' & ');

            winnerBanner.classList.remove('hidden');
            winnerBanner.innerHTML = `
        <div class="text-2xl font-black mb-1">🏆 ${winnerDisplay} Menang!</div>
        <div class="text-sm bg-green-700/40 text-white inline-block px-4 py-1.5 rounded-full mt-2 border border-green-600">
          Skor Terendah: <span class="text-red-200 font-bold">${loserDisplay} (${minScore})</span>
        </div>
        <div class="text-xs text-green-100/80 mt-2 font-mono">⏱️ Durasi Pertandingan: ${durationText}</div>
        <button id="btn-save-history" class="mt-5 w-full bg-white text-green-700 hover:bg-slate-100 active:bg-slate-200 font-black py-3 rounded-lg shadow-lg transition-colors text-lg">
          Simpan & Mulai Baru
        </button>
        <button id="btn-share-image" class="mt-2 w-full bg-green-700/40 hover:bg-green-700/60 text-white font-bold py-2.5 rounded-lg border border-green-500 transition-colors text-sm">
          📸 Share Hasil ke Gambar
        </button>
      `;

            document.querySelectorAll('.score-input').forEach(input => input.disabled = true);
            btnAdd.disabled = true;
            btnAdd.classList.add('opacity-50', 'cursor-not-allowed');
            quickActionsPanel.classList.add('hidden');
        } else {
            winnerBanner.classList.add('hidden');
            document.querySelectorAll('.score-input').forEach(input => input.disabled = false);
            btnAdd.disabled = false;
            btnAdd.classList.remove('opacity-50', 'cursor-not-allowed');
            if (!timerInterval) startMatchTimer();
        }
    }
}

// 5. Interaksi Kolom & Numpad
let keypadBuffer = '';       // digit yang lagi diketik buat kolom aktif
let keypadFreshStart = true; // true kalau belum ada tombol numpad dipencet sejak fokus ke kolom ini

function commitActiveInputAndClosePanel() {
    quickActionsPanel.classList.add('hidden');
    if (activeInput) {
        activeInput.classList.remove('ring-2', 'ring-blue-500');
        saveState();
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
    state[index][player] = isIncomplete ? '' : parseInt(keypadBuffer, 10);

    renderFooter(true); // Preview live tanpa trigger Game Over prematur
}

function appendToBuffer(str) {
    const sign = keypadBuffer.startsWith('-') ? '-' : '';
    const digits = keypadBuffer.replace('-', '');
    if (digits.length >= 5) return; // batasin biar gak kepanjangan
    keypadBuffer = sign + digits + str;
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
            saveState();
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

// 6. Menyimpan ke Sejarah Match & Share Gambar
winnerBanner.addEventListener('click', (e) => {
    if (e.target.id === 'btn-save-history') {
        const { totals } = calculateTotals();
        const minScore = Math.min(totals.p1, totals.p2, totals.p3, totals.p4);
        const winners = players.filter(p => totals[p] >= 1000).map(w => playerNames[w]).join(' & ');
        const losers = players.filter(p => totals[p] === minScore).map(l => playerNames[l]).join(' & ');

        const matchData = {
            date: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            winner: winners,
            loser: losers,
            minScore: minScore,
            duration: formatDuration((matchEndTime || Date.now()) - matchStartTime),
            scores: {
                [playerNames.p1]: totals.p1,
                [playerNames.p2]: totals.p2,
                [playerNames.p3]: totals.p3,
                [playerNames.p4]: totals.p4,
            }
        };

        history.push(matchData);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

        state = [{ p1: '', p2: '', p3: '', p4: '' }];
        saveState();
        undoStack = [];
        updateUndoButton();
        lastAnnouncedRoundIndex = -1;
        startNewMatchTimer();
        renderTable();
        renderFooter();
        activeInput = null;
        quickActionsPanel.classList.add('hidden');

        showAppToast('✅ Data tersimpan! Memulai ronde baru.', 'success');
    }

    if (e.target.id === 'btn-share-image') {
        shareResultAsImage();
    }
});

// 6b. Share hasil pertandingan sebagai gambar PNG
async function shareResultAsImage() {
    const shareBtn = document.getElementById('btn-share-image');
    const originalLabel = shareBtn ? shareBtn.textContent : '';
    if (shareBtn) {
        shareBtn.disabled = true;
        shareBtn.textContent = 'Menyiapkan gambar...';
    }

    const { totals } = calculateTotals();
    const minScore = Math.min(totals.p1, totals.p2, totals.p3, totals.p4);
    const winners = players.filter(p => totals[p] >= 1000);
    const losers = players.filter(p => totals[p] === minScore);

    const card = document.createElement('div');
    card.style.cssText = 'position:fixed; left:-9999px; top:0; width:380px; padding:28px; background:linear-gradient(135deg,#0f172a,#1e293b); font-family: sans-serif; color:white; border-radius:20px;';
    card.innerHTML = `
    <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:10px;">${new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    <div style="text-align:center; font-size:26px; font-weight:900; color:#4ade80; margin-bottom:18px;">🏆 ${winners.map(w => playerNames[w]).join(' & ')} Menang!</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      ${players.map(p => `
        <div style="background:rgba(255,255,255,0.06); border:1px solid #334155; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:12px; color:#94a3b8; margin-bottom:4px;">${playerNames[p]}</div>
          <div style="font-size:24px; font-weight:800; color:${winners.includes(p) ? '#4ade80' : (losers.includes(p) ? '#f87171' : '#e2e8f0')};">${totals[p]}</div>
        </div>
      `).join('')}
    </div>
    <div style="text-align:center; margin-top:18px; font-size:11px; color:#64748b;">Skor Terendah: ${losers.map(l => playerNames[l]).join(' & ')} (${minScore}) • Score Tracker 1000</div>
  `;
    document.body.appendChild(card);

    try {
        const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 });
        await new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], 'hasil-ceki.png', { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file], title: 'Hasil Ceki', text: 'Hasil pertandingan Ceki' });
                    } catch (err) {
                        // user membatalkan share, gapapa
                    }
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'hasil-ceki.png';
                    a.click();
                    URL.revokeObjectURL(url);
                }
                resolve();
            });
        });
    } catch (err) {
        showAppToast('⚠️ Gagal bikin gambar. Coba lagi ya.', 'error');
    } finally {
        card.remove();
        if (shareBtn) {
            shareBtn.disabled = false;
            shareBtn.textContent = originalLabel;
        }
    }
}

// 7. Modal Riwayat
btnOpenHistory.addEventListener('click', () => {
    historyModal.classList.remove('hidden');
    renderHistory();
});

btnCloseHistory.addEventListener('click', () => {
    historyModal.classList.add('hidden');
});

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<div class="text-center text-slate-400 mt-10">Belum ada sejarah pertandingan. Mainkan dan selesaikan 1 game untuk menyimpannya di sini.</div>';
        return;
    }

    historyList.innerHTML = history.slice().reverse().map((match) => `
    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
      <div class="flex justify-between items-center text-xs text-slate-400 mb-3 border-b border-slate-700 pb-2">
        <span>${match.date}</span>
        ${match.duration ? `<span class="font-mono">⏱️ ${match.duration}</span>` : ''}
      </div>
      <div class="flex justify-between items-center mb-3">
        <span class="text-green-400 font-black text-lg">🏆 ${match.winner}</span>
        <span class="text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded border border-red-900/50">Terendah: ${match.loser} (${match.minScore})</span>
      </div>
      <div class="grid grid-cols-4 gap-2 text-center text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-800">
        ${Object.entries(match.scores).map(([name, score]) => `
          <div>
            <div class="text-slate-500 text-xs truncate mb-1">${name}</div>
            <div class="font-bold ${score >= 1000 ? 'text-green-400' : 'text-slate-200'}">${score}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// 8. Tambah Ronde, Undo, & Reset
btnAdd.addEventListener('click', () => {
    pushUndo();
    state.push({ p1: '', p2: '', p3: '', p4: '' });
    saveState();
    renderTable();
    renderFooter();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

btnUndo.addEventListener('click', () => {
    undoLastAction();
});

btnReset.addEventListener('click', () => {
    showConfirmModal('Yakin mau reset skor? (Data yang belum di-save ke Riwayat akan hilang)', () => {
        state = [{ p1: '', p2: '', p3: '', p4: '' }];
        saveState();
        undoStack = [];
        updateUndoButton();
        lastAnnouncedRoundIndex = -1;
        startNewMatchTimer();
        renderTable();
        renderFooter();
        activeInput = null;
        quickActionsPanel.classList.add('hidden');
        showAppToast('🔄 Skor berhasil di-reset.', 'success');
    });
});

// 9. Backup / Restore Data
function exportData() {
    const backup = {
        app: 'ceki-score-tracker',
        version: 2,
        exportedAt: new Date().toISOString(),
        state,
        playerNames,
        history,
        matchStartTime,
        matchEndTime,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `ceki-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            showAppToast('⚠️ Gagal import: file bukan JSON yang valid.', 'error');
            return;
        }
        if (!data || !Array.isArray(data.state) || !data.playerNames || !Array.isArray(data.history)) {
            showAppToast('⚠️ Gagal import: format file tidak sesuai backup Score Tracker 1000.', 'error');
            return;
        }

        showConfirmModal('Import akan MENIMPA data ronde, nama pemain, dan riwayat yang ada sekarang. Lanjut?', () => {
            state = data.state;
            playerNames = data.playerNames;
            history = data.history;

            // Backup lama (versi 1) belum nyimpen waktu, jadi fallback ke "mulai sekarang"
            matchStartTime = data.matchStartTime || Date.now();
            matchEndTime = data.matchEndTime || null;
            localStorage.setItem(MATCH_START_KEY, String(matchStartTime));
            if (matchEndTime) {
                localStorage.setItem(MATCH_END_KEY, String(matchEndTime));
            } else {
                localStorage.removeItem(MATCH_END_KEY);
            }

            saveState();
            localStorage.setItem(NAME_KEY, JSON.stringify(playerNames));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

            document.querySelectorAll('.name-input').forEach(input => {
                const key = input.getAttribute('data-player');
                input.value = playerNames[key] || key.toUpperCase();
            });

            undoStack = [];
            updateUndoButton();
            lastAnnouncedRoundIndex = -1;

            if (matchEndTime) {
                stopMatchTimer();
                updateTimerDisplay();
            } else {
                startMatchTimer();
            }

            renderTable();
            renderFooter();
            historyModal.classList.add('hidden');
            showAppToast('✅ Data berhasil di-import!', 'success');
        });
    };
    reader.readAsText(file);
}

btnExportData.addEventListener('click', exportData);
btnImportData.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importDataFromFile(file);
    importFileInput.value = '';
});

// 10. PWA: install prompt & service worker
let deferredInstallPrompt = null;
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // gapapa kalau gagal register, app tetap jalan normal (cuma gak offline-ready)
        });
    });
}

// Inisialisasi
updateUndoButton();
renderTable();
renderFooter();
if (matchEndTime) {
    updateTimerDisplay(); // game sebelumnya udah selesai, timer beku di durasi akhir
} else {
    startMatchTimer();
}