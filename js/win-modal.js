/**
 * win-modal.js
 * ============
 * Dulu hasil menang cuma nongol jadi banner ijo di atas tabel. Sekarang
 * jadi popup modal beneran (fullscreen overlay, senada sama history-modal
 * & confirm-modal) dengan animasi masuk, biar momen menangnya lebih berasa.
 */

import { players, getPlayerNames, addHistoryEntry, resetMatchOnly } from './store.js';
import { renderTable, renderFooter, onGameOver } from './render.js';
import { clearMatchTimer } from './timer.js';
import { resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { showAppToast } from './toast.js';
import { shareResultAsImage } from './share.js';
import { playWinSound } from './sound.js';
import { vibrateWin } from './haptics.js';

const winModal = document.getElementById('win-modal');
const winModalContent = document.getElementById('win-modal-content');
const winModalBody = document.getElementById('win-modal-body');

let pendingResult = null;

function open(result) {
    pendingResult = result;
    playWinSound();
    vibrateWin();
    const playerNames = getPlayerNames();
    const { winners, losers, minScore, totals, durationText, burnCounts } = result;
    const winnerDisplay = winners.map(w => playerNames[w]).join(' & ');
    const loserDisplay = losers.map(l => playerNames[l]).join(' & ');

    winModalBody.innerHTML = `
    <div class="text-3xl font-black mb-1 text-center">🏆 ${winnerDisplay} Menang!</div>
    <div class="text-center mt-2">
      <span class="text-sm bg-green-700/40 text-white inline-block px-4 py-1.5 rounded-full border border-green-600">
        Skor Terendah: <span class="text-red-200 font-bold">${loserDisplay} (${minScore})</span>
      </span>
    </div>
    <div class="text-xs text-green-100/80 mt-3 font-mono text-center">⏱️ Durasi Pertandingan: ${durationText}</div>
    <div class="grid grid-cols-2 gap-2 mt-5">
      ${players.map(p => `
        <div class="bg-slate-900/40 border border-slate-700 rounded-lg p-2 text-center">
          <div class="text-[11px] text-slate-400 truncate">${playerNames[p]}</div>
          <div class="text-lg font-bold ${winners.includes(p) ? 'text-green-400' : (losers.includes(p) ? 'text-red-400' : 'text-slate-200')}">${totals[p]}</div>
          ${burnCounts[p] > 0 ? `<div class="text-[10px] text-orange-300 font-semibold mt-0.5">🔥 kebakar ${burnCounts[p]}x</div>` : ''}
        </div>
      `).join('')}
    </div>
    <button id="btn-save-history" class="mt-6 w-full bg-white text-green-700 hover:bg-slate-100 active:bg-slate-200 font-black py-3 rounded-lg shadow-lg transition-colors text-lg">
      Simpan & Mulai Baru
    </button>
    <button id="btn-share-image" class="mt-2 w-full bg-green-700/40 hover:bg-green-700/60 text-white font-bold py-2.5 rounded-lg border border-green-500 transition-colors text-sm">
      📸 Share Hasil ke Gambar
    </button>
  `;

    winModal.classList.remove('hidden');
    // Trigger reflow biar transisi masuk jalan (bukan langsung full-state)
    void winModalContent.offsetWidth;
    winModal.classList.add('win-modal-visible');
}

function close() {
    winModal.classList.remove('win-modal-visible');
    setTimeout(() => winModal.classList.add('hidden'), 200);
}

winModalBody.addEventListener('click', (e) => {
    if (e.target.id === 'btn-save-history') {
        if (!pendingResult) return;
        const playerNames = getPlayerNames();
        const { winners, losers, minScore, totals, durationText } = pendingResult;

        addHistoryEntry({
            date: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            winner: winners.map(w => playerNames[w]).join(' & '),
            loser: losers.map(l => playerNames[l]).join(' & '),
            minScore: minScore,
            duration: durationText,
            scores: Object.fromEntries(players.map(p => [playerNames[p], totals[p]])),
        });

        resetMatchOnly();
        resetUndoStack();
        resetBurnAnnouncer();
        clearMatchTimer();
        clearActiveInput();
        close();
        pendingResult = null;
        renderTable();
        renderFooter();

        showAppToast('✅ Data tersimpan! Tap "+ Ronde Baru" buat mulai match berikutnya.', 'success');
    }

    if (e.target.id === 'btn-share-image') {
        shareResultAsImage();
    }
});

// Daftarin diri ke render.js: begitu game over kedetect, popup ini yang kebuka.
onGameOver(open);
