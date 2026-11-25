/**
 * progress-modal.js
 * =================
 * Popup "Skor Sementara" untuk melihat klasemen & share progress di tengah match.
 */

import { players, getPlayerNames, getRounds, getMatchStartTime } from './store.js';
import { calculateTotals, rankPlayers } from './scoring.js';
import { formatDuration } from './timer.js';
import { shareProgressAsImage } from './share.js';
import { showAppToast } from './toast.js';
import { drawProgressionChart, getPlayerColors } from './chart.js';
import { onThemeChange } from './theme.js';
import { escapeHtml, ICONS } from './utils.js';

const btnShowProgress = document.getElementById('btn-show-progress');
const progressModal = document.getElementById('progress-modal');
const progressModalContent = document.getElementById('progress-modal-content');
const progressModalBody = document.getElementById('progress-modal-body');

let lastChartData = null;

function open() {
    const rounds = getRounds();
    if (rounds.length === 0) {
        showAppToast('Belum ada skor untuk dibagikan.', 'info');
        return;
    }

    const playerNames = getPlayerNames();
    const pColors = getPlayerColors();
    const { totals, burnCounts, burnsInflictedCounts, progressionHistory, burnHistory } = calculateTotals(rounds);
    const ranked = rankPlayers(totals, burnsInflictedCounts, burnCounts);
    const durationText = getMatchStartTime() ? formatDuration(Date.now() - getMatchStartTime()) : '00:00';
    lastChartData = { progressionHistory, burnHistory, playerNames: { ...playerNames } };

    progressModalBody.innerHTML = `
        <div class="win-hero">
            <div class="win-badge progress-badge">Klasemen Sementara</div>
            <h2 class="win-headline">Skor Sementara</h2>
            <div class="win-meta">
                <span>${ICONS.clock} ${escapeHtml(durationText)}</span>
                <span>&middot;</span>
                <span>${rounds.length} ronde</span>
            </div>
        </div>

        <div class="rank-list">
            ${ranked.map((p, i) => `
                <div class="rank-item">
                    <div class="rank-num">${i + 1}</div>
                    <div class="rank-info">
                        <div class="rank-name">${escapeHtml(playerNames[p])}</div>
                        <div class="score-summary-tags" style="justify-content:flex-start;margin-top:2px;">
                            ${(burnsInflictedCounts[p] || 0) > 0 ? `<span class="tag-burner">${ICONS.sword} Bakar ${burnsInflictedCounts[p]}x</span>` : ''}
                            ${(burnCounts[p] || 0) > 0 ? `<span class="tag-burned">${ICONS.flame} Kebakar ${burnCounts[p]}x</span>` : ''}
                        </div>
                    </div>
                    <div class="rank-score">${totals[p]}</div>
                </div>
            `).join('')}
        </div>

        <div class="chart-box">
            <div class="chart-header">
                <span style="display:inline-flex;align-items:center;gap:6px;">${ICONS.chart} Grafik Drama Skor</span>
                <span class="tabular-nums" style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">${rounds.length} ronde</span>
            </div>
            <div class="chart-legend">
                ${players.map(p => `
                    <div class="chart-legend-item">
                        <span class="chart-legend-dot" style="background-color:${pColors[p]}"></span>
                        <span class="chart-legend-label">${escapeHtml(playerNames[p])}</span>
                    </div>
                `).join('')}
            </div>
            <div class="chart-canvas-wrap">
                <canvas id="progress-progression-chart"></canvas>
            </div>
            <div class="chart-caption">🔥 Menandakan ronde pemain terbakar / reset skor</div>
        </div>

        <div class="modal-watermark">CEKI 1000 &middot; SCORE TRACKER</div>

        <div class="modal-actions">
            <button id="btn-share-progress-image" type="button" class="btn btn-primary btn-full">${ICONS.share} <span>Share Skor Sementara</span></button>
            <button id="btn-close-progress" type="button" class="btn btn-secondary btn-full btn-sm">Tutup</button>
        </div>
    `;

    progressModal.classList.remove('hidden');
    void progressModalContent.offsetWidth;
    progressModal.classList.add('is-visible');

    const chartCanvas = document.getElementById('progress-progression-chart');
    if (chartCanvas) {
        drawProgressionChart(chartCanvas, progressionHistory, burnHistory, playerNames);
        requestAnimationFrame(() => {
            drawProgressionChart(chartCanvas, progressionHistory, burnHistory, playerNames);
        });
    }
}

function close() {
    progressModal.classList.remove('is-visible');
    setTimeout(() => progressModal.classList.add('hidden'), 200);
}

onThemeChange(() => {
    if (!progressModal.classList.contains('hidden') && lastChartData) {
        const chartCanvas = document.getElementById('progress-progression-chart');
        if (chartCanvas) {
            drawProgressionChart(chartCanvas, lastChartData.progressionHistory, lastChartData.burnHistory, lastChartData.playerNames);
        }
    }
});

if (btnShowProgress) btnShowProgress.addEventListener('click', open);

progressModalBody.addEventListener('click', (e) => {
    if (e.target.closest('#btn-close-progress')) close();
    if (e.target.closest('#btn-share-progress-image')) shareProgressAsImage();
});

progressModal.addEventListener('click', (e) => {
    if (e.target === progressModal) close();
});
