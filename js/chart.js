/**
 * chart.js
 * ========
 * Grafik Garis Drama Skor Pertandingan (HTML5 Canvas murni, HiDPI/Retina).
 * Mendukung tema Terang & Gelap, padding kanan cukup untuk 4+ digit,
 * dan algoritma anti-tabrakan vertikal untuk label skor akhir.
 */

import { players } from './store.js';
import { getTheme } from './theme.js';

export const PLAYER_COLORS_DARK = {
    p1: '#38bdf8',
    p2: '#a78bfa',
    p3: '#fb7185',
    p4: '#34d399',
};

export const PLAYER_COLORS_LIGHT = {
    p1: '#0284c7',
    p2: '#7c3aed',
    p3: '#e11d48',
    p4: '#059669',
};

export function getPlayerColors() {
    return getTheme() === 'light' ? PLAYER_COLORS_LIGHT : PLAYER_COLORS_DARK;
}

// Tetap export default alias untuk kompatibilitas
export const PLAYER_COLORS = PLAYER_COLORS_DARK;

export function drawProgressionChart(canvas, progressionHistory, burnHistory = [], playerNames = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!progressionHistory || progressionHistory.length === 0) {
        progressionHistory = [{ p1: 0, p2: 0, p3: 0, p4: 0 }];
    }

    const isLight = getTheme() === 'light';
    const colors = isLight ? PLAYER_COLORS_LIGHT : PLAYER_COLORS_DARK;

    const palette = isLight
        ? {
            bg: '#f8fafc',
            grid1000: 'rgba(217, 119, 6, 0.5)',
            text1000: '#b45309',
            gridMid: 'rgba(148, 163, 184, 0.45)',
            textMid: '#64748b',
            gridZero: 'rgba(100, 116, 139, 0.65)',
            textZero: '#475569',
            gridNeg: 'rgba(220, 38, 38, 0.3)',
            textNeg: '#dc2626',
            axisText: '#64748b',
            dotFill: '#ffffff',
            burnFill: '#dc2626',
            burnStroke: '#ffffff',
        }
        : {
            bg: '#0c0c10',
            grid1000: 'rgba(245, 158, 11, 0.45)',
            text1000: '#fbbf24',
            gridMid: 'rgba(113, 113, 122, 0.35)',
            textMid: '#71717a',
            gridZero: 'rgba(161, 161, 170, 0.45)',
            textZero: '#a1a1aa',
            gridNeg: 'rgba(239, 68, 68, 0.32)',
            textNeg: '#f87171',
            axisText: '#71717a',
            dotFill: '#111114',
            burnFill: '#ef4444',
            burnStroke: '#ffffff',
        };

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const container = canvas.parentElement;
    const clientWidth = container ? container.clientWidth : 340;
    const displayWidth = Math.max(260, clientWidth);
    const displayHeight = 220;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const padLeft = 42;
    const padRight = 46; // cukup lega untuk 4 digit + tanda minus
    const padTop = 26;
    const padBottom = 26;

    const chartW = displayWidth - padLeft - padRight;
    const chartH = displayHeight - padTop - padBottom;

    let minScore = 0;
    let maxScore = 1000;

    progressionHistory.forEach(step => {
        players.forEach(p => {
            const val = step[p] || 0;
            if (val < minScore) minScore = val;
            if (val > maxScore) maxScore = val;
        });
    });

    const rangeBufferTop = 80;
    const rangeBufferBottom = minScore < 0 ? 60 : 0;
    const effectiveMax = maxScore + rangeBufferTop;
    const effectiveMin = minScore - rangeBufferBottom;
    const scoreRange = effectiveMax - effectiveMin || 1;

    function getY(val) {
        const ratio = (val - effectiveMin) / scoreRange;
        return padTop + chartH - (ratio * chartH);
    }

    const totalSteps = progressionHistory.length;
    function getX(stepIdx) {
        if (totalSteps <= 1) return padLeft + chartW / 2;
        return padLeft + (stepIdx / (totalSteps - 1)) * chartW;
    }

    // --- 1. Grid Horizontal & Label Sumbu Y ---
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';

    const y1000 = getY(1000);
    ctx.strokeStyle = palette.grid1000;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y1000);
    ctx.lineTo(padLeft + chartW, y1000);
    ctx.stroke();
    ctx.fillStyle = palette.text1000;
    ctx.fillText('1000', padLeft - 6, y1000);

    if (effectiveMin < 500 && effectiveMax > 500) {
        const y500 = getY(500);
        ctx.strokeStyle = palette.gridMid;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, y500);
        ctx.lineTo(padLeft + chartW, y500);
        ctx.stroke();
        ctx.fillStyle = palette.textMid;
        ctx.fillText('500', padLeft - 6, y500);
    }

    const y0 = getY(0);
    ctx.strokeStyle = palette.gridZero;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y0);
    ctx.lineTo(padLeft + chartW, y0);
    ctx.stroke();
    ctx.fillStyle = palette.textZero;
    ctx.fillText('0', padLeft - 6, y0);

    if (minScore < 0) {
        const roundedMin = Math.floor(minScore / 100) * 100;
        const yMin = getY(roundedMin);
        ctx.strokeStyle = palette.gridNeg;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, yMin);
        ctx.lineTo(padLeft + chartW, yMin);
        ctx.stroke();
        ctx.fillStyle = palette.textNeg;
        ctx.fillText(`${roundedMin}`, padLeft - 6, yMin);
    }

    ctx.setLineDash([]);

    // --- 2. Label Sumbu X (Ronde) ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.axisText;
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';

    const labelStep = totalSteps > 14 ? 3 : (totalSteps > 8 ? 2 : 1);
    for (let i = 0; i < totalSteps; i++) {
        if (i === 0 || i === totalSteps - 1 || i % labelStep === 0) {
            const x = getX(i);
            const label = i === 0 ? 'R0' : `R${i}`;
            ctx.fillText(label, x, padTop + chartH + 8);
        }
    }

    // --- 3. Garis Perkembangan Skor tiap Pemain ---
    players.forEach(p => {
        const color = colors[p] || '#ffffff';

        ctx.beginPath();
        progressionHistory.forEach((step, idx) => {
            const x = getX(idx);
            const y = getY(step[p] || 0);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        progressionHistory.forEach((step, idx) => {
            const x = getX(idx);
            const y = getY(step[p] || 0);
            const isBurnedInRound = idx > 0 && burnHistory[idx - 1] && burnHistory[idx - 1].includes(p);

            if (isBurnedInRound) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 5.5, 0, Math.PI * 2);
                ctx.fillStyle = palette.burnFill;
                ctx.fill();
                ctx.lineWidth = 1.8;
                ctx.strokeStyle = palette.burnStroke;
                ctx.stroke();

                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText('🔥', x, y - 6);
                ctx.restore();
            } else if (totalSteps <= 16 || idx === 0 || idx === totalSteps - 1) {
                ctx.beginPath();
                ctx.arc(x, y, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = palette.dotFill;
                ctx.fill();
                ctx.lineWidth = 1.8;
                ctx.strokeStyle = color;
                ctx.stroke();
            }
        });
    });

    // --- 4. Label Skor Akhir di Ujung Kanan (Anti-Tabrakan Vertikal) ---
    if (totalSteps > 1) {
        const lastStep = progressionHistory[totalSteps - 1];
        const xEnd = getX(totalSteps - 1);
        const labelEntries = players.map(p => ({
            p,
            val: lastStep[p] || 0,
            y: getY(lastStep[p] || 0),
            color: colors[p] || '#ffffff',
        })).sort((a, b) => a.y - b.y);

        const minGap = 13;
        for (let i = 1; i < labelEntries.length; i++) {
            if (labelEntries[i].y - labelEntries[i - 1].y < minGap) {
                labelEntries[i].y = labelEntries[i - 1].y + minGap;
            }
        }
        // Clamp bawah jika melewati batas chart
        const maxAllowedY = padTop + chartH + 4;
        if (labelEntries[labelEntries.length - 1].y > maxAllowedY) {
            labelEntries[labelEntries.length - 1].y = maxAllowedY;
            for (let i = labelEntries.length - 2; i >= 0; i--) {
                if (labelEntries[i + 1].y - labelEntries[i].y < minGap) {
                    labelEntries[i].y = labelEntries[i + 1].y - minGap;
                }
            }
        }

        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        labelEntries.forEach(entry => {
            ctx.fillStyle = entry.color;
            ctx.fillText(String(entry.val), xEnd + 7, Math.max(10, entry.y));
        });
    }

    ctx.restore();
}
