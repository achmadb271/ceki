/**
 * history-modal.js
 * ================
 * Modal riwayat pertandingan yang tersimpan di localStorage.
 * Dilengkapi ringkasan grafik drama skor interaktif jika baris/kartu riwayat dipencet.
 */

import { getHistory, clearHistory, players } from './store.js';
import { showConfirmModal, showAppToast } from './toast.js';
import { drawProgressionChart, PLAYER_COLORS } from './chart.js';
import { calculateTotals } from './scoring.js';

const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnClearHistory = document.getElementById('btn-clear-history');

// Simpan data history yang sedang dirender untuk akses canvas
let currentRenderedHistory = [];

export function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyList.innerHTML = '<div class="text-center text-slate-400 mt-10">Belum ada riwayat pertandingan. Mainkan dan selesaikan 1 game untuk menyimpannya di sini.</div>';
        currentRenderedHistory = [];
        return;
    }

    // Urutkan dari yang terbaru ke terlama
    currentRenderedHistory = history.slice().reverse();

    historyList.innerHTML = currentRenderedHistory.map((match, idx) => {
        const roundCount = match.rounds ? match.rounds.length : (match.progressionHistory ? match.progressionHistory.length - 1 : null);
        const matchPlayerNames = match.playerNames || {
            p1: Object.keys(match.scores)[0] || 'P1',
            p2: Object.keys(match.scores)[1] || 'P2',
            p3: Object.keys(match.scores)[2] || 'P3',
            p4: Object.keys(match.scores)[3] || 'P4',
        };

        return `
    <div class="history-item bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg transition-all" data-idx="${idx}">
      <div class="flex justify-between items-center text-xs text-slate-400 mb-3 border-b border-slate-700/80 pb-2">
        <span class="font-medium">${match.date}</span>
        <div class="flex items-center gap-1.5">
          ${roundCount ? `<span class="text-[10px] bg-slate-700/80 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-slate-600">${roundCount} Ronde</span>` : ''}
          ${match.duration ? `<span class="font-mono text-slate-400">⏱️ ${match.duration}</span>` : ''}
        </div>
      </div>

      <div class="flex justify-between items-center mb-3">
        <span class="text-green-400 font-black text-base sm:text-lg">🏆 ${match.winner}</span>
        <span class="text-red-400 text-xs bg-red-900/20 px-2 py-1 rounded border border-red-900/50">Terendah: ${match.loser} (${match.minScore})</span>
      </div>

      <div class="grid grid-cols-4 gap-2 text-center text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-800">
        ${Object.entries(match.scores).map(([name, score]) => `
          <div>
            <div class="text-slate-400 text-xs truncate mb-0.5 font-bold">${name}</div>
            <div class="font-bold ${score >= 1000 ? 'text-green-400' : 'text-slate-200'}">${score}</div>
          </div>
        `).join('')}
      </div>

      <!-- Tombol Toggle Grafik -->
      <button type="button" class="btn-toggle-history-chart w-full mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors" data-idx="${idx}">
        <span class="flex items-center gap-1.5">
          <span>📈</span>
          <span class="chart-toggle-text">Lihat Grafik Drama Skor</span>
        </span>
        <span class="chart-toggle-icon text-slate-400 text-sm font-bold transition-transform">▾</span>
      </button>

      <!-- Wadah Grafik Terbuka (Collapsible) -->
      <div id="history-chart-wrapper-${idx}" class="history-chart-wrapper hidden mt-3 pt-3 border-t border-slate-700/60 space-y-2">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-bold">
          ${players.map(p => `
            <div class="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
              <span class="w-2 h-2 rounded-full inline-block shrink-0 shadow-sm" style="background-color: ${PLAYER_COLORS[p]}"></span>
              <span class="text-slate-300 truncate">${matchPlayerNames[p]}</span>
            </div>
          `).join('')}
        </div>
        <div class="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-[#090d16]">
          <canvas id="history-chart-${idx}" class="w-full block"></canvas>
        </div>
        <div class="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
          <span>🔥 Titik ronde pemain terbakar / reset skor</span>
        </div>
      </div>
    </div>
  `;
    }).join('');
}

function toggleChart(idx) {
    const wrapper = document.getElementById(`history-chart-wrapper-${idx}`);
    if (!wrapper) return;

    const btn = historyList.querySelector(`.btn-toggle-history-chart[data-idx="${idx}"]`);
    const icon = btn ? btn.querySelector('.chart-toggle-icon') : null;
    const text = btn ? btn.querySelector('.chart-toggle-text') : null;
    const canvas = document.getElementById(`history-chart-${idx}`);
    const match = currentRenderedHistory[idx];

    const isOpening = wrapper.classList.contains('hidden');

    if (isOpening) {
        wrapper.classList.remove('hidden');
        if (icon) icon.textContent = '▴';
        if (text) text.textContent = 'Sembunyikan Grafik';

        if (canvas && match) {
            let progression = match.progressionHistory;
            let burns = match.burnHistory || [];
            let names = match.playerNames || {};

            // Fallback: Rekonstruksi jika data lama belum punya progressionHistory tapi punya rounds
            if (!progression && match.rounds && match.rounds.length > 0) {
                const calculated = calculateTotals(match.rounds);
                progression = calculated.progressionHistory;
                burns = calculated.burnHistory;
            }

            // Fallback ekstra: jika data sangat lama (hanya ada final scores)
            if (!progression || progression.length === 0) {
                const step0 = { p1: 0, p2: 0, p3: 0, p4: 0 };
                const step1 = {};
                players.forEach((p, i) => {
                    const scoreKey = Object.keys(match.scores)[i];
                    step1[p] = match.scores[scoreKey] || 0;
                });
                progression = [step0, step1];
            }

            requestAnimationFrame(() => {
                drawProgressionChart(canvas, progression, burns, names);
            });
        }
    } else {
        wrapper.classList.add('hidden');
        if (icon) icon.textContent = '▾';
        if (text) text.textContent = 'Lihat Grafik Drama Skor';
    }
}

// Event Delegation untuk klik toggle pada kartu atau tombol
historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-toggle-history-chart');
    if (btn) {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        toggleChart(idx);
        return;
    }

    const item = e.target.closest('.history-item');
    if (item) {
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        toggleChart(idx);
    }
});

export function openHistoryModal() {
    historyModal.classList.remove('hidden');
    renderHistory();
}

export function closeHistoryModal() {
    historyModal.classList.add('hidden');
}

btnOpenHistory.addEventListener('click', openHistoryModal);
btnCloseHistory.addEventListener('click', closeHistoryModal);
btnClearHistory.addEventListener('click', () => {
    if (getHistory().length === 0) {
        showAppToast('Riwayat udah kosong.', 'info');
        return;
    }
    showConfirmModal('Yakin mau hapus SEMUA riwayat pertandingan? Data yang udah dihapus gak bisa dibalikin lagi.', () => {
        clearHistory();
        renderHistory();
        showAppToast('🗑️ Riwayat berhasil dihapus.', 'success');
    });
});
