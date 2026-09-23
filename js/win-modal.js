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
let confettiAnimationId = null;
let confettiCanvas = null;

function startConfetti() {
    stopConfetti();
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    document.body.appendChild(confettiCanvas);

    const ctx = confettiCanvas.getContext('2d');
    let width = (confettiCanvas.width = window.innerWidth);
    let height = (confettiCanvas.height = window.innerHeight);

    const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#fbbf24'];
    const particles = Array.from({ length: 75 }, () => ({
        x: Math.random() * width,
        y: Math.random() * -height,
        r: Math.random() * 5 + 3,
        d: Math.random() * 30 + 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleIncremental: Math.random() * 0.07 + 0.04,
    }));

    function draw() {
        if (!confettiCanvas) return;
        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) * 0.75;
            p.x += Math.sin(p.d) * 1.5;
            p.tilt = Math.sin(p.tiltAngle) * 12;

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

function open(result) {
    pendingResult = result;
    playWinSound();
    vibrateWin();
    startConfetti();
    const playerNames = getPlayerNames();
    const { winners, losers, minScore, totals, durationText, burnCounts, burnsInflictedCounts = {} } = result;
    const winnerDisplay = winners.map(w => playerNames[w]).join(' & ');
    const loserDisplay = losers.map(l => playerNames[l]).join(' & ');

    const maxInflicted = Math.max(...players.map(p => burnsInflictedCounts[p] || 0));
    const executioners = maxInflicted > 0 ? players.filter(p => burnsInflictedCounts[p] === maxInflicted) : [];
    const maxBurns = Math.max(...players.map(p => burnCounts[p] || 0));
    const gosongers = maxBurns > 0 ? players.filter(p => burnCounts[p] === maxBurns) : [];

    winModalBody.innerHTML = `
    <div class="text-3xl font-black mb-1 text-center"><span class="trophy-bounce">🏆</span> ${winnerDisplay} Menang!</div>
    <div class="text-center mt-2">
      <span class="text-sm bg-green-700/40 text-white inline-block px-4 py-1.5 rounded-full border border-green-600">
        Skor Terendah: <span class="text-red-200 font-bold">${loserDisplay} (${minScore})</span>
      </span>
    </div>
    <div class="text-xs text-green-100/80 mt-2 font-mono text-center">⏱️ Durasi: ${durationText}</div>
    <div class="grid grid-cols-2 gap-2 mt-4">
      ${players.map(p => `
        <div class="bg-slate-900/40 border border-slate-700/80 rounded-xl p-2.5 text-center">
          <div class="text-[11px] text-slate-300 font-bold truncate">${playerNames[p]}</div>
          <div class="text-xl font-black font-mono mt-0.5 ${winners.includes(p) ? 'text-green-300' : (losers.includes(p) ? 'text-red-400' : 'text-slate-100')}">${totals[p]}</div>
          <div class="flex flex-col gap-0.5 mt-1">
            ${(burnsInflictedCounts[p] || 0) > 0 ? `<div class="text-[10px] text-emerald-300 font-semibold">⚔️ bakar ${burnsInflictedCounts[p]}x</div>` : ''}
            ${(burnCounts[p] || 0) > 0 ? `<div class="text-[10px] text-orange-300 font-semibold">🔥 kebakar ${burnCounts[p]}x</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    ${(executioners.length > 0 || gosongers.length > 0) ? `
      <div class="mt-3.5 bg-slate-900/50 rounded-xl p-2.5 border border-slate-700/60 text-left space-y-1">
        <div class="text-[10px] text-green-200/70 font-bold uppercase tracking-wider text-center mb-1">🎖️ Gelar Pertandingan</div>
        ${executioners.length > 0 ? `
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-emerald-300 font-semibold flex items-center gap-1">⚔️ The Executioner</span>
            <span class="text-white font-bold">${executioners.map(p => playerNames[p]).join(', ')} (${maxInflicted}x)</span>
          </div>
        ` : ''}
        ${gosongers.length > 0 ? `
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-orange-300 font-semibold flex items-center gap-1">🔥 Mr. Gosong</span>
            <span class="text-white font-bold">${gosongers.map(p => playerNames[p]).join(', ')} (${maxBurns}x)</span>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <div class="text-[9px] text-green-200/50 font-mono tracking-widest text-center mt-3">SCORE TRACKER 1000 &middot; CEKI</div>

    <button id="btn-save-history" class="mt-5 w-full bg-white text-green-700 hover:bg-slate-100 active:bg-slate-200 font-black py-3 rounded-xl shadow-lg transition-colors text-base">
      Simpan & Mulai Baru
    </button>
    <button id="btn-share-image" class="mt-2 w-full bg-green-700/40 hover:bg-green-700/60 text-white font-bold py-2.5 rounded-xl border border-green-500 transition-colors text-xs">
      📸 Share Hasil ke Gambar
    </button>
  `;

    winModal.classList.remove('hidden');
    // Trigger reflow biar transisi masuk jalan (bukan langsung full-state)
    void winModalContent.offsetWidth;
    winModal.classList.add('win-modal-visible');
}

function close() {
    stopConfetti();
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
