/**
 * history-modal.js
 * ================
 * Modal riwayat pertandingan yang udah di-save.
 */

import { getHistory, clearHistory } from './store.js';
import { showConfirmModal, showAppToast } from './toast.js';

const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnClearHistory = document.getElementById('btn-clear-history');

export function renderHistory() {
    const history = getHistory();
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
