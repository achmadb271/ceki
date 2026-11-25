/**
 * win-modal.js
 * ============
 * Popup kemenangan dengan grafik drama skor, gelar pertandingan,
 * tombol Koreksi Skor (mencegah terjebak jika salah input di ronde terakhir),
 * serta penyimpanan riwayat yang aman untuk nama pemain kembar.
 */

import { players, getPlayerNames, addHistoryEntry, resetMatchOnly, getRounds } from './store.js';
import { renderTable, renderFooter, onGameOver, dismissGameOverForEdit, resetGameOverDismissed } from './render.js';
import { clearMatchTimer } from './timer.js';
import { resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { showAppToast } from './toast.js';
import { shareResultAsImage } from './share.js';
import { playWinSound } from './sound.js';
import { vibrateWin } from './haptics.js';
import { calculateTotals } from './scoring.js';
import { drawProgressionChart, getPlayerColors } from './chart.js';
import { onThemeChange } from './theme.js';
import { escapeHtml, ICONS } from './utils.js';

const winModal = document.getElementById('win-modal');
const winModalContent = document.getElementById('win-modal-content');
const winModalBody = document.getElementById('win-modal-body');

let pendingResult = null;
let lastChartData = null;
let confettiAnimationId = null;
let confettiCanvas = null;

function startConfetti() {
    stopConfetti();
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    document.body.appendChild(confettiCanvas);

    const ctx = confettiCanvas.getContext('2d');
    const width = (confettiCanvas.width = window.innerWidth);
    const height = (confettiCanvas.height = window.innerHeight);

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#fb7185', '#a78bfa'];
    const particles = Array.from({ length: 55 }, () => ({
        x: Math.random() * width,
        y: Math.random() * -height,
        r: Math.random() * 4.5 + 2.5,
        d: Math.random() * 25 + 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleIncremental: Math.random() * 0.06 + 0.03,
    }));

    function draw() {
        if (!confettiCanvas) return;
        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 2.6 + p.r / 2) * 0.7;
            p.x += Math.sin(p.d) * 1.2;
            p.tilt = Math.sin(p.tiltAngle) * 10;

            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
            ctx.stroke();

            if (p.y > height) {
                p.x = Math.random() * width;
                p.y = -15;
            }
        });

        confettiAnimationId = requestAnimationFrame(draw);
    }

    draw();
}

function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    if (confettiCanvas) {
        confettiCanvas.remove();
        confettiCanvas = null;
    }
}

function buildUniqueLegacyScores(playerNames, totals) {
    const out = {};
    players.forEach(p => {
        const base = playerNames[p] || p.toUpperCase();
        let key = base;
        let suffix = 2;
        while (Object.prototype.hasOwnProperty.call(out, key)) {
            key = `${base} (${suffix++})`;
        }
        out[key] = totals[p];
    });
    return out;
}

function open(result) {
    pendingResult = result;
    playWinSound();
    vibrateWin();
    startConfetti();

    const playerNames = getPlayerNames();
    const pColors = getPlayerColors();
    const { winners, losers, minScore, totals, durationText, burnCounts, burnsInflictedCounts = {} } = result;
    const winnerDisplay = winners.map(w => escapeHtml(playerNames[w])).join(' &amp; ');
    const loserDisplay = losers.map(l => escapeHtml(playerNames[l])).join(' &amp; ');

    const maxInflicted = Math.max(...players.map(p => burnsInflictedCounts[p] || 0));
    const executioners = maxInflicted > 0 ? players.filter(p => burnsInflictedCounts[p] === maxInflicted) : [];
    const maxBurns = Math.max(...players.map(p => burnCounts[p] || 0));
    const gosongers = maxBurns > 0 ? players.filter(p => burnCounts[p] === maxBurns) : [];

    const rounds = getRounds();
    const { progressionHistory, burnHistory } = calculateTotals(rounds);
    lastChartData = { progressionHistory, burnHistory, playerNames: { ...playerNames } };

    winModalBody.innerHTML = `
        <div class="win-hero">
            <div class="win-badge">🏆 Pertandingan Selesai</div>
            <h2 class="win-headline">${winnerDisplay} Menang!</h2>
            <div class="win-meta">
                <span>${ICONS.clock} ${escapeHtml(durationText)}</span>
                <span>&middot;</span>
                <span>${rounds.length} ronde</span>
            </div>
            <div>
                <span class="loser-pill">Terendah: ${loserDisplay} (${minScore})</span>
            </div>
        </div>

        <div class="score-summary-grid">
            ${players.map(p => `
                <div class="score-summary-card${winners.includes(p) ? ' is-winner' : ''}">
                    <div class="score-summary-name">${escapeHtml(playerNames[p])}</div>
                    <div class="score-summary-value" style="color: ${winners.includes(p) ? 'var(--success)' : (losers.includes(p) ? 'var(--danger)' : 'var(--text-primary)')}">${totals[p]}</div>
                    <div class="score-summary-tags">
                        ${(burnsInflictedCounts[p] || 0) > 0 ? `<span class="tag-burner">${ICONS.sword} ${burnsInflictedCounts[p]}x</span>` : ''}
                        ${(burnCounts[p] || 0) > 0 ? `<span class="tag-burned">${ICONS.flame} ${burnCounts[p]}x</span>` : ''}
                    </div>
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
                <canvas id="win-progression-chart"></canvas>
            </div>
            <div class="chart-caption">🔥 Menandakan ronde pemain terbakar / reset skor</div>
        </div>

        ${(executioners.length > 0 || gosongers.length > 0) ? `
            <div class="awards-box">
                <div class="awards-title">Gelar Pertandingan</div>
                ${executioners.length > 0 ? `
                    <div class="award-row">
                        <span class="tag-burner">${ICONS.sword} The Executioner</span>
                        <strong>${executioners.map(p => escapeHtml(playerNames[p])).join(', ')} (${maxInflicted}x)</strong>
                    </div>
                ` : ''}
                ${gosongers.length > 0 ? `
                    <div class="award-row">
                        <span class="tag-burned">${ICONS.flame} Mr. Gosong</span>
                        <strong>${gosongers.map(p => escapeHtml(playerNames[p])).join(', ')} (${maxBurns}x)</strong>
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <div class="modal-watermark">CEKI 1000 &middot; SCORE TRACKER</div>

        <div class="modal-actions">
            <button id="btn-save-history" type="button" class="btn btn-success btn-full">Simpan &amp; Mulai Baru</button>
            <div class="modal-actions-row">
                <button id="btn-share-image" type="button" class="btn btn-secondary btn-sm">${ICONS.share} <span>Share PNG</span></button>
                <button id="btn-edit-win-score" type="button" class="btn btn-secondary btn-sm">${ICONS.edit} <span>Koreksi Skor</span></button>
            </div>
        </div>
    `;

    winModal.classList.remove('hidden');
    void winModalContent.offsetWidth;
    winModal.classList.add('is-visible');

    const chartCanvas = document.getElementById('win-progression-chart');
    if (chartCanvas) {
        drawProgressionChart(chartCanvas, progressionHistory, burnHistory, playerNames);
        requestAnimationFrame(() => {
            drawProgressionChart(chartCanvas, progressionHistory, burnHistory, playerNames);
        });
    }
}

function close() {
    stopConfetti();
    winModal.classList.remove('is-visible');
    setTimeout(() => winModal.classList.add('hidden'), 200);
}

onThemeChange(() => {
    if (!winModal.classList.contains('hidden') && lastChartData) {
        const chartCanvas = document.getElementById('win-progression-chart');
        if (chartCanvas) {
            drawProgressionChart(chartCanvas, lastChartData.progressionHistory, lastChartData.burnHistory, lastChartData.playerNames);
        }
    }
});

winModalBody.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('#btn-save-history');
    if (saveBtn) {
        if (!pendingResult) return;
        const playerNames = getPlayerNames();
        const { winners, losers, minScore, totals, durationText, burnCounts, burnsInflictedCounts = {} } = pendingResult;
        const rounds = getRounds();
        const { progressionHistory, burnHistory } = calculateTotals(rounds);

        addHistoryEntry({
            date: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            winner: winners.map(w => playerNames[w]).join(' & '),
            loser: losers.map(l => playerNames[l]).join(' & '),
            minScore,
            duration: durationText,
            scores: buildUniqueLegacyScores(playerNames, totals),
            totalsByPlayer: { ...totals },
            rounds: JSON.parse(JSON.stringify(rounds)),
            progressionHistory,
            burnHistory,
            playerNames: { ...playerNames },
            burnCounts: { ...burnCounts },
            burnsInflictedCounts: { ...burnsInflictedCounts },
        });

        resetMatchOnly();
        resetUndoStack();
        resetBurnAnnouncer();
        resetGameOverDismissed();
        clearMatchTimer();
        clearActiveInput();
        close();
        pendingResult = null;
        lastChartData = null;
        renderTable();
        renderFooter();

        showAppToast('Data tersimpan ke Riwayat! Tap "+ Ronde Baru" untuk match berikutnya.', 'success');
        return;
    }

    if (e.target.closest('#btn-share-image')) {
        shareResultAsImage();
        return;
    }

    if (e.target.closest('#btn-edit-win-score')) {
        close();
        dismissGameOverForEdit();
        showAppToast('Mode koreksi aktif. Ubah angka atau tekan Undo.', 'info');
    }
});

onGameOver(open);
