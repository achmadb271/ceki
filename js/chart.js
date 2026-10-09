/**
 * chart.js
 * ========
 * Grafik Garis Drama Skor Pertandingan (Match Progression Chart) berbasis HTML5 Canvas murni.
 * Render garis kumulatif tiap pemain dari Ronde 0 (awal) hingga ronde terakhir.
 * Dilengkapi:
 *   - Garis target kemenangan 1000 poin (garis emas putus-putus)
 *   - Garis baseline 0 poin & garis minus jika ada pemain yang tekor
 *   - Titik marker di setiap ronde
 *   - Penanda khusus kobaran api 🔥 di ronde pemain kena bakar (reset / drop dramatis)
 *   - HiDPI/Retina crisp scaling agar tidak buram di layar smartphone
 *   - Offline 100% tanpa library eksternal
 */

import { players } from './store.js';

export const PLAYER_COLORS = {
    p1: '#38bdf8', // Sky 400
    p2: '#c084fc', // Purple 400
    p3: '#f472b6', // Pink 400
    p4: '#818cf8', // Indigo 400
};

export const PLAYER_BG_COLORS = {
    p1: 'rgba(56, 189, 248, 0.15)',
    p2: 'rgba(192, 132, 252, 0.15)',
    p3: 'rgba(244, 114, 182, 0.15)',
    p4: 'rgba(129, 140, 248, 0.15)',
};

/**
 * Menggambar grafik progression di elemen canvas yang diberikan.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<Object>} progressionHistory Array of { p1, p2, p3, p4 } dari R0..Rn
 * @param {Array<Array<string>>} burnHistory Array of player IDs yang kebakar di tiap ronde
 * @param {Object} playerNames { p1: 'Nama 1', ... }
 */
export function drawProgressionChart(canvas, progressionHistory, burnHistory = [], playerNames = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!progressionHistory || progressionHistory.length === 0) {
        progressionHistory = [{ p1: 0, p2: 0, p3: 0, p4: 0 }];
    }

    // Hitung ukuran rendering canvas dengan rasio Retina/HiDPI
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const container = canvas.parentElement;
    const clientWidth = container ? container.clientWidth : 340;
    const displayWidth = Math.max(280, clientWidth);
    const displayHeight = 220;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background kartu canvas
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, displayWidth, displayHeight, 14) : ctx.rect(0, 0, displayWidth, displayHeight);
    ctx.fill();

    // Area batas chart
    const padLeft = 44;
    const padRight = 24;
    const padTop = 32;
    const padBottom = 28;

    const chartW = displayWidth - padLeft - padRight;
    const chartH = displayHeight - padTop - padBottom;

    // Cari rentang skor Min dan Max
    let minScore = 0;
    let maxScore = 1000;

    progressionHistory.forEach(step => {
        players.forEach(p => {
            const val = step[p] || 0;
            if (val < minScore) minScore = val;
            if (val > maxScore) maxScore = val;
        });
    });

    // Beri margin atas & bawah agar titik dan label tidak menempel di border
    const rangeBufferTop = 80;
    const rangeBufferBottom = minScore < 0 ? 50 : 0;
    const effectiveMax = maxScore + rangeBufferTop;
    const effectiveMin = minScore - rangeBufferBottom;
    const scoreRange = effectiveMax - effectiveMin || 1;

    // Fungsi mapping nilai skor ke koordinat Y
    function getY(val) {
        const ratio = (val - effectiveMin) / scoreRange;
        return padTop + chartH - (ratio * chartH);
    }

    // Fungsi mapping indeks ronde ke koordinat X
    const totalSteps = progressionHistory.length; // e.g., R0..Rn (length = n + 1)
    function getX(stepIdx) {
        if (totalSteps <= 1) return padLeft + chartW / 2;
        return padLeft + (stepIdx / (totalSteps - 1)) * chartW;
    }

    // --- 1. Gambar Grid Horizontal & Label Sumbu Y ---
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px monospace';

    // Grid garis target 1000 (Emas)
    const y1000 = getY(1000);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y1000);
    ctx.lineTo(padLeft + chartW, y1000);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('1000 🏆', padLeft - 6, y1000);

    // Grid garis 500 (Tengah)
    if (effectiveMin < 500 && effectiveMax > 500) {
        const y500 = getY(500);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, y500);
        ctx.lineTo(padLeft + chartW, y500);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.fillText('500', padLeft - 6, y500);
    }

    // Grid garis 0 (Baseline)
    const y0 = getY(0);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padLeft, y0);
    ctx.lineTo(padLeft + chartW, y0);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('0', padLeft - 6, y0);

    // Grid garis minus (jika ada tekor)
    if (minScore < 0) {
        const roundedMin = Math.floor(minScore / 100) * 100;
        const yMin = getY(roundedMin);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, yMin);
        ctx.lineTo(padLeft + chartW, yMin);
        ctx.stroke();
        ctx.fillStyle = '#f87171';
        ctx.fillText(`${roundedMin}`, padLeft - 6, yMin);
    }

    ctx.setLineDash([]); // Reset line dash

    // --- 2. Gambar Label Sumbu X (Ronde) ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';

    // Jika ronde terlalu banyak, tampilkan loncatan (step) agar tidak bertumpuk
    const labelStep = totalSteps > 12 ? 3 : (totalSteps > 8 ? 2 : 1);
    for (let i = 0; i < totalSteps; i++) {
        if (i === 0 || i === totalSteps - 1 || i % labelStep === 0) {
            const x = getX(i);
            const label = i === 0 ? 'Awal' : `R${i}`;
            ctx.fillText(label, x, padTop + chartH + 8);
        }
    }

    // --- 3. Gambar Garis Perkembangan Skor tiap Pemain ---
    players.forEach(p => {
        const color = PLAYER_COLORS[p] || '#ffffff';

        // Buat path polyline
        ctx.beginPath();
        progressionHistory.forEach((step, idx) => {
            const x = getX(idx);
            const y = getY(step[p] || 0);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // Glow neon ringan
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Titik marker lingkaran
        progressionHistory.forEach((step, idx) => {
            const x = getX(idx);
            const y = getY(step[p] || 0);

            // Cek apakah di ronde ini pemain kena bakar
            const isBurnedInRound = idx > 0 && burnHistory[idx - 1] && burnHistory[idx - 1].includes(p);

            if (isBurnedInRound) {
                // Marker api drama kebakar 🔥
                ctx.save();
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 8;

                // Lingkaran merah menyala
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Ikon api di atas titik
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText('🔥', x, y - 6);
                ctx.restore();
            } else {
                // Titik marker biasa
                ctx.beginPath();
                ctx.arc(x, y, 3.2, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.stroke();
            }
        });
    });

    // --- 4. Tag Skor Terakhir di Ujung Kanan Garis ---
    if (totalSteps > 1) {
        const lastStep = progressionHistory[totalSteps - 1];
        players.forEach(p => {
            const val = lastStep[p] || 0;
            const x = getX(totalSteps - 1);
            const y = getY(val);
            const color = PLAYER_COLORS[p] || '#ffffff';

            ctx.save();
            ctx.fillStyle = color;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            // Geser sedikit agar tidak menabrak titik
            const textX = Math.min(displayWidth - 2, x + 6);
            ctx.fillText(`${val}`, textX, y);
            ctx.restore();
        });
    }

    ctx.restore();
}
