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

    winModalBody.innerHTML = `
    <div class="text-3xl font-black mb-1 text-center"><span class="trophy-bounce">🏆</span> ${winnerDisplay} Menang!</div>
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
          <div class="flex flex-col gap-0.5 mt-1">
            ${(burnsInflictedCounts[p] || 0) > 0 ? `<div class="text-[10px] text-emerald-300 font-semibold">⚔️ bakar ${burnsInflictedCounts[p]}x</div>` : ''}
            ${(burnCounts[p] || 0) > 0 ? `<div class="text-[10px] text-orange-300 font-semibold">🔥 kebakar ${burnCounts[p]}x</div>` : ''}
          </div>
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
