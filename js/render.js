/**
 * render.js
 * =========
 * Render tabel skor & footer (total), termasuk visual "gosong" (merah) dan
 * "sikut-sikutan" (pulsing merah/kuning). Juga yang mendeteksi Game Over.
 *
 * render.js SENGAJA gak import win-modal.js langsung (biar gak circular
 * dependency dua arah) - begitu game over kedetect, dia manggil callback
 * yang didaftarin lewat onGameOver(). win-modal.js yang daftarin dirinya.
 */

import { getRounds, players, getMatchStartTime, getMatchEndTime } from './store.js';
import { calculateTotals, getLiveOvertakeWarnings, getTotalProximityWarnings, countBurns, WIN_SCORE } from './scoring.js';
import { checkAndAnnounceBurns } from './burn-announcer.js';
import { markMatchEndIfNeeded, startMatchTimer, isTimerRunning, formatDuration } from './timer.js';

const tbody = document.getElementById('score-body');
const tfoot = document.getElementById('score-foot');
const btnAdd = document.getElementById('btn-add');
const quickActionsPanel = document.getElementById('quick-actions');

let gameOverHandler = null;
/** win-modal.js daftarin fungsinya di sini buat dipanggil pas game over kedetect. */
export function onGameOver(handler) {
    gameOverHandler = handler;
}

export function renderTable() {
    const rounds = getRounds();
    tbody.innerHTML = '';

    if (rounds.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-slate-500 text-sm">
          Belum ada ronde.<br>
          <span class="text-slate-400 font-semibold">Tap "+ Ronde Baru" buat mulai main & jalanin timer!</span>
        </td>
      </tr>
    `;
        return;
    }

    rounds.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-700/50";
        tr.innerHTML = `
      <td class="p-1 text-center text-xs font-bold text-slate-500">${index + 1}</td>
      ${players.map(p => `<td class="p-1"><input type="text" inputmode="none" readonly data-idx="${index}" data-player="${p}" value="${row[p]}" class="score-input w-full bg-slate-800/80 text-white border border-transparent text-center p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all cursor-pointer select-none"></td>`).join('')}
    `;
        tbody.appendChild(tr);
    });
}

export function renderFooter(isPreview = false) {
    const rounds = getRounds();
    const { totals, burnHistory, burnedByHistory } = calculateTotals(rounds);

    // Update Visual Warna "Gosong" - merah buat yang kebakar, ijo buat penyebabnya (yang nyalip)
    document.querySelectorAll('.score-input').forEach(input => {
        const idx = input.getAttribute('data-idx');
        const p = input.getAttribute('data-player');
        input.classList.remove(
            'bg-slate-800/80', 'text-white', 'border-transparent',
            'bg-red-950', 'text-red-400', 'border-red-600',
            'bg-green-950', 'text-green-400', 'border-green-600',
            'font-black'
        );

        if (burnHistory[idx] && burnHistory[idx].includes(p)) {
            input.classList.add('bg-red-950', 'text-red-400', 'border-red-600', 'font-black');
        } else if (burnedByHistory[idx] && burnedByHistory[idx].includes(p)) {
            input.classList.add('bg-green-950', 'text-green-400', 'border-green-600', 'font-black');
        } else {
            input.classList.add('bg-slate-800/80', 'text-white', 'border-transparent');
        }
    });

    const hasReachedWinScore = players.some(p => totals[p] >= WIN_SCORE);
    const lastRow = rounds[rounds.length - 1];
    const isCurrentRoundFinished = lastRow ? players.every(p => lastRow[p] !== '') : false;

    // Status "sikut-sikutan" versi BENERAN kesalip (dari ronde yang lagi diketik, belum lengkap
    // 4 kolom). Dihitung sekali di sini, dipake bareng buat kolom input DAN baris TOT di bawah,
    // biar dua-duanya konsisten (gak ada lagi TOT bilang "cuma deket" padahal kolom input udah
    // bilang "kesalip beneran").
    const liveOvertake = !isCurrentRoundFinished
        ? getLiveOvertakeWarnings(rounds)
        : { atRisk: new Set(), overtaking: new Set() };

    // "Sikut-sikutan" - highlight pulsing buat ronde yang LAGI diketik (belum lengkap 4 kolom)
    document.querySelectorAll('.score-input').forEach(input => {
        input.classList.remove('tense-atrisk', 'tense-overtaking');
    });
    if (!isCurrentRoundFinished) {
        const lastIdx = rounds.length - 1;
        players.forEach(p => {
            const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
            if (!cell) return;
            // "overtaking" (ijo) menang kalau kebetulan sama-sama kena "atRisk" (kuning) -
            // misal pemain B lagi ngedeketin A, tapi B sendiri juga lagi diincer C dari
            // belakang. Progress "lagi nyalip" lebih relevan buat ditampilin duluan.
            if (liveOvertake.overtaking.has(p)) cell.classList.add('tense-overtaking');
            else if (liveOvertake.atRisk.has(p)) cell.classList.add('tense-atrisk');
        });
    }

    // Notif & animasi pas ada yang baru kebakar (cuma pas ronde beneran baru selesai, bukan preview)
    if (!isPreview) {
        checkAndAnnounceBurns(burnHistory, isCurrentRoundFinished);
        const lastIdx = burnHistory.length - 1;
        const freshBurns = burnHistory[lastIdx] || [];
        if (isCurrentRoundFinished && freshBurns.length > 0) {
            freshBurns.forEach(p => {
                const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
                if (cell) {
                    cell.classList.remove('burn-flicker');
                    void cell.offsetWidth; // trigger reflow biar animasi bisa diulang
                    cell.classList.add('burn-flicker');
                }
            });
        }
    }

    const isGameOver = !isPreview && hasReachedWinScore && isCurrentRoundFinished;

    let winners = [];
    let losers = [];
    let minScore = 0;

    if (isGameOver) {
        winners = players.filter(p => totals[p] >= WIN_SCORE);
        minScore = Math.min(...players.map(p => totals[p]));
        losers = players.filter(p => totals[p] === minScore);
    }

    const getColor = (player) => {
        if (!isGameOver) return 'text-white';
        if (winners.includes(player)) return 'text-green-400 font-black';
        if (losers.includes(player)) return 'text-red-400';
        return 'text-slate-400';
    };

    tfoot.innerHTML = `
    <tr class="bg-slate-900 font-bold text-xl sticky bottom-0 border-t-2 border-slate-600 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.5)] transition-colors z-30">
      <td class="p-3 text-center text-blue-400 text-sm">TOT</td>
      ${players.map(p => `<td data-total-player="${p}" class="p-3 text-center border border-transparent transition-colors ${getColor(p)}">${totals[p]}</td>`).join('')}
    </tr>
  `;

    // Highlight "udah deketan" di total point - selalu aktif, gak perlu nunggu ngetik apa-apa.
    // Prioritasin status "beneran kesalip" (liveOvertake) dulu kalau lagi kejadian di ronde yang
    // diketik, baru fallback ke "sekedar deket" (proximity statis) - biar TOT gak pernah bilang
    // "cuma deket" pas kolom input di atas udah jelas-jelas nunjukin ada yang beneran kesalip.
    const { atRisk: totalAtRisk, closing: totalClosing } = getTotalProximityWarnings(totals);
    players.forEach(p => {
        const cell = tfoot.querySelector(`[data-total-player="${p}"]`);
        if (!cell) return;
        cell.classList.remove('tense-atrisk', 'tense-overtaking');
        if (liveOvertake.overtaking.has(p)) cell.classList.add('tense-overtaking');
        else if (liveOvertake.atRisk.has(p)) cell.classList.add('tense-atrisk');
        else if (totalClosing.has(p)) cell.classList.add('tense-overtaking');
        else if (totalAtRisk.has(p)) cell.classList.add('tense-atrisk');
    });

    if (!isPreview) {
        if (isGameOver) {
            markMatchEndIfNeeded();
            const durationText = formatDuration((getMatchEndTime() || Date.now()) - getMatchStartTime());

            document.querySelectorAll('.score-input').forEach(input => input.disabled = true);
            btnAdd.disabled = true;
            btnAdd.classList.add('opacity-50', 'cursor-not-allowed');
            quickActionsPanel.classList.add('hidden');

            if (gameOverHandler) {
                const burnCounts = countBurns(burnHistory);
                gameOverHandler({ winners, losers, minScore, totals, durationText, burnCounts });
            }
        } else {
            document.querySelectorAll('.score-input').forEach(input => input.disabled = false);
            btnAdd.disabled = false;
            btnAdd.classList.remove('opacity-50', 'cursor-not-allowed');
            if (!isTimerRunning() && getMatchStartTime()) startMatchTimer();
        }
    }
}
