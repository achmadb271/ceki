/**
 * progress-modal.js
 * ==================
 * Popup "skor sementara" - buat share progress kapan aja di tengah match,
 * gak perlu nunggu sampe ada yang tembus 1000 (kadang mainnya disudahin
 * duluan karena capek). Sengaja beda warna (biru) dari popup menang (ijo)
 * biar gak ketuker keliatannya, dan gak ada bahasa "menang/kalah" - cuma
 * ranking urutan skor sekarang.
 */

import { players, getPlayerNames, getRounds, getMatchStartTime } from './store.js';
import { calculateTotals, rankPlayers, countBurns } from './scoring.js';
import { formatDuration } from './timer.js';
import { shareProgressAsImage } from './share.js';
import { showAppToast } from './toast.js';

const btnShowProgress = document.getElementById('btn-show-progress');
const progressModal = document.getElementById('progress-modal');
const progressModalContent = document.getElementById('progress-modal-content');
const progressModalBody = document.getElementById('progress-modal-body');

function open() {
    const rounds = getRounds();
    if (rounds.length === 0) {
        showAppToast('Belum ada skor buat di-share.', 'info');
        return;
    }

    const playerNames = getPlayerNames();
    const { totals, burnHistory } = calculateTotals(rounds);
    const burnCounts = countBurns(burnHistory);
    const ranked = rankPlayers(totals);
    const durationText = getMatchStartTime() ? formatDuration(Date.now() - getMatchStartTime()) : '00:00';

    progressModalBody.innerHTML = `
    <div class="text-2xl font-black mb-1 text-center">📊 Skor Sementara</div>
    <div class="text-xs text-blue-100/80 mt-2 font-mono text-center">⏱️ Durasi: ${durationText} &middot; ${rounds.length} ronde</div>
    <div class="flex flex-col gap-2 mt-5">
      ${ranked.map((p, i) => `
        <div class="flex items-center gap-3 bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2.5">
          <div class="w-6 h-6 rounded-full bg-slate-700 text-slate-200 text-xs font-black flex items-center justify-center shrink-0">${i + 1}</div>
          <div class="flex-1 text-sm font-semibold text-slate-200 truncate">${playerNames[p]}</div>
          ${burnCounts[p] > 0 ? `<div class="text-[10px] text-orange-300 font-semibold">Kebakar ${burnCounts[p]}&times;</div>` : ''}
          <div class="text-lg font-black text-white">${totals[p]}</div>
        </div>
      `).join('')}
    </div>
    <button id="btn-share-progress-image" class="mt-6 w-full bg-white text-blue-700 hover:bg-slate-100 active:bg-slate-200 font-black py-3 rounded-lg shadow-lg transition-colors text-base">
      📸 Share Skor Sementara
    </button>
    <button id="btn-close-progress" class="mt-2 w-full bg-blue-700/40 hover:bg-blue-700/60 text-white font-bold py-2.5 rounded-lg border border-blue-500 transition-colors text-sm">
      Tutup
    </button>
  `;

    progressModal.classList.remove('hidden');
    void progressModalContent.offsetWidth; // trigger reflow biar animasi masuk jalan
    progressModal.classList.add('progress-modal-visible');
}

function close() {
    progressModal.classList.remove('progress-modal-visible');
    setTimeout(() => progressModal.classList.add('hidden'), 200);
}

btnShowProgress.addEventListener('click', open);

progressModalBody.addEventListener('click', (e) => {
    if (e.target.id === 'btn-close-progress') close();
    if (e.target.id === 'btn-share-progress-image') shareProgressAsImage();
});

// Klik di area gelap luar kartu = tutup juga
progressModal.addEventListener('click', (e) => {
    if (e.target === progressModal) close();
});
