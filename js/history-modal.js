/**
 * history-modal.js
 * ================
 * Modal riwayat pertandingan yang tersimpan di localStorage.
 * Aman untuk nama pemain kembar (pakai totalsByPlayer, fallback ke format lama)
 * dan semua string di-escape anti-XSS.
 */

import { getHistory, clearHistory, players } from './store.js';
import { showConfirmModal, showAppToast } from './toast.js';
import { drawProgressionChart, getPlayerColors } from './chart.js';
import { calculateTotals } from './scoring.js';
import { onThemeChange } from './theme.js';
import { escapeHtml, ICONS } from './utils.js';

const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const btnOpenHistory = document.getElementById('btn-open-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnClearHistory = document.getElementById('btn-clear-history');

let currentRenderedHistory = [];

function resolveMatchScores(match) {
    if (match.totalsByPlayer && typeof match.totalsByPlayer === 'object') {
        const names = match.playerNames || { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4' };
        return players.map(p => ({
            key: p,
            name: names[p] || p.toUpperCase(),
            score: match.totalsByPlayer[p] ?? 0,
        }));
    }
    const entries = Object.entries(match.scores || {});
    return entries.map(([name, score], i) => ({
        key: players[i] || `p${i + 1}`,
        name,
        score,
    }));
}

export function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">Belum ada riwayat</div>
                <div class="empty-state-desc">Selesaikan 1 pertandingan dan simpan untuk melihat arsip skor &amp; grafiknya di sini.</div>
            </div>
        `;
        currentRenderedHistory = [];
        return;
    }

    const pColors = getPlayerColors();
    currentRenderedHistory = history.slice().reverse();

    historyList.innerHTML = currentRenderedHistory.map((match, idx) => {
        const roundCount = match.rounds ? match.rounds.length : (match.progressionHistory ? match.progressionHistory.length - 1 : null);
        const resolvedScores = resolveMatchScores(match);
        const matchPlayerNames = match.playerNames || {
            p1: resolvedScores[0]?.name || 'P1',
            p2: resolvedScores[1]?.name || 'P2',
            p3: resolvedScores[2]?.name || 'P3',
            p4: resolvedScores[3]?.name || 'P4',
        };

        return `
            <article class="history-card" data-idx="${idx}">
                <div class="history-meta">
                    <span>${escapeHtml(match.date)}</span>
                    <div class="history-badges">
                        ${roundCount ? `<span class="pill">${roundCount} Ronde</span>` : ''}
                        ${match.duration ? `<span class="pill tabular-nums">${ICONS.clock} ${escapeHtml(match.duration)}</span>` : ''}
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                    <div style="font-weight:800;font-size:16px;color:var(--success);">🏆 ${escapeHtml(match.winner)}</div>
                    <span class="loser-pill" style="margin-top:0;font-size:11px;">Terendah: ${escapeHtml(match.loser)} (${match.minScore})</span>
                </div>

                <div class="history-scores-grid">
                    ${resolvedScores.map(item => `
                        <div style="min-width:0;">
                            <div style="font-size:11px;font-weight:700;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
                            <div class="tabular-nums" style="font-family:var(--font-mono);font-size:14px;font-weight:800;margin-top:2px;color:${item.score >= 1000 ? 'var(--success)' : 'var(--text-primary)'};">${item.score}</div>
                        </div>
                    `).join('')}
                </div>

                <button type="button" class="history-toggle-btn btn-toggle-history-chart" data-idx="${idx}">
                    <span style="display:inline-flex;align-items:center;gap:6px;">${ICONS.chart} <span class="chart-toggle-text">Lihat Grafik Drama Skor</span></span>
                    <span class="chart-toggle-icon" style="display:inline-flex;transition:transform 0.2s ease;">${ICONS.chevronDown}</span>
                </button>

                <div id="history-chart-wrapper-${idx}" class="history-chart-wrapper hidden" style="margin-top:12px;">
                    <div class="chart-legend">
                        ${players.map(p => `
                            <div class="chart-legend-item">
                                <span class="chart-legend-dot" style="background-color:${pColors[p]}"></span>
                                <span class="chart-legend-label">${escapeHtml(matchPlayerNames[p])}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="chart-canvas-wrap">
                        <canvas id="history-chart-${idx}"></canvas>
                    </div>
                    <div class="chart-caption">🔥 Titik ronde pemain terbakar / reset skor</div>
                </div>
            </article>
        `;
    }).join('');
}

function drawHistoryChartForIndex(idx) {
    const canvas = document.getElementById(`history-chart-${idx}`);
    const match = currentRenderedHistory[idx];
    if (!canvas || !match) return;

    let progression = match.progressionHistory;
    let burns = match.burnHistory || [];
    const names = match.playerNames || {};

    if (!progression && match.rounds && match.rounds.length > 0) {
        const calculated = calculateTotals(match.rounds);
        progression = calculated.progressionHistory;
        burns = calculated.burnHistory;
    }

    if (!progression || progression.length === 0) {
        const resolved = resolveMatchScores(match);
        const step0 = { p1: 0, p2: 0, p3: 0, p4: 0 };
        const step1 = {};
        players.forEach((p, i) => {
            step1[p] = resolved[i]?.score || 0;
        });
        progression = [step0, step1];
    }

    requestAnimationFrame(() => {
        drawProgressionChart(canvas, progression, burns, names);
    });
}

function toggleChart(idx) {
    const wrapper = document.getElementById(`history-chart-wrapper-${idx}`);
    if (!wrapper) return;

    const btn = historyList.querySelector(`.btn-toggle-history-chart[data-idx="${idx}"]`);
    const icon = btn ? btn.querySelector('.chart-toggle-icon') : null;
    const text = btn ? btn.querySelector('.chart-toggle-text') : null;

    const isOpening = wrapper.classList.contains('hidden');
    if (isOpening) {
        wrapper.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (text) text.textContent = 'Sembunyikan Grafik';
        drawHistoryChartForIndex(idx);
    } else {
        wrapper.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (text) text.textContent = 'Lihat Grafik Drama Skor';
    }
}

onThemeChange(() => {
    if (historyModal.classList.contains('hidden')) return;
    currentRenderedHistory.forEach((_, idx) => {
        const wrapper = document.getElementById(`history-chart-wrapper-${idx}`);
        if (wrapper && !wrapper.classList.contains('hidden')) {
            drawHistoryChartForIndex(idx);
        }
    });
});

historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-toggle-history-chart');
    if (btn) {
        e.stopPropagation();
        toggleChart(parseInt(btn.getAttribute('data-idx'), 10));
        return;
    }
    const item = e.target.closest('.history-card');
    if (item) {
        toggleChart(parseInt(item.getAttribute('data-idx'), 10));
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
        showAppToast('Riwayat sudah kosong.', 'info');
        return;
    }
    showConfirmModal('Yakin mau hapus SEMUA riwayat pertandingan? Data yang dihapus tidak bisa dikembalikan.', () => {
        clearHistory();
        renderHistory();
        showAppToast('Riwayat berhasil dihapus.', 'success');
    });
});
