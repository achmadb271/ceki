/**
 * render.js
 * =========
 * Render tabel skor & sticky total dock, termasuk visual kebakar,
 * preview sikut-sikutan, dan deteksi Game Over (beserta mode koreksi skor).
 */

import { getRounds, players, getMatchStartTime, getMatchEndTime, deleteRound, clearRound } from './store.js';
import { calculateTotals, getLiveOvertakeWarnings, getTotalProximityWarnings, determineWinners, rankPlayers, WIN_SCORE } from './scoring.js';
import { checkAndAnnounceBurns, checkAndAnnounceWarning, syncAnnouncersToRounds } from './burn-announcer.js';
import {
    markMatchEndIfNeeded,
    resumeMatchTimerIfReopened,
    startMatchTimer,
    isTimerRunning,
    formatDuration,
    clearMatchTimer,
    updateTimerDisplay,
} from './timer.js';
import { pushUndo } from './undo.js';
import { showAppToast, showConfirmModal } from './toast.js';

const tbody = document.getElementById('score-body');
const tfoot = document.getElementById('score-foot');
const btnAdd = document.getElementById('btn-add');
const quickActionsPanel = document.getElementById('quick-actions');

const roundActionModal = document.getElementById('round-action-modal');
const roundActionTitle = document.getElementById('round-action-title');
const btnClearRoundRow = document.getElementById('btn-clear-round-row');
const btnDeleteRoundRow = document.getElementById('btn-delete-round-row');
const btnCancelRoundAction = document.getElementById('btn-cancel-round-action');
const btnCloseRoundAction = document.getElementById('btn-close-round-action');

let activeActionRoundIdx = -1;
let gameOverDismissed = false;

export function resetGameOverDismissed() {
    gameOverDismissed = false;
}

export function dismissGameOverForEdit() {
    gameOverDismissed = true;
    document.querySelectorAll('.score-input').forEach(input => { input.disabled = false; });
    if (btnAdd) btnAdd.disabled = false;
}

export function openRoundActionModal(index) {
    activeActionRoundIdx = index;
    if (roundActionTitle) {
        roundActionTitle.textContent = `Opsi Ronde ${index + 1}`;
    }
    if (roundActionModal) {
        roundActionModal.classList.remove('hidden');
    }
}

export function closeRoundActionModal() {
    activeActionRoundIdx = -1;
    if (roundActionModal) {
        roundActionModal.classList.add('hidden');
    }
}

if (btnClearRoundRow) {
    btnClearRoundRow.addEventListener('click', () => {
        if (activeActionRoundIdx < 0) return;
        const targetIdx = activeActionRoundIdx;
        closeRoundActionModal();
        pushUndo();
        clearRound(targetIdx);
        syncAnnouncersToRounds(getRounds().length);
        resetGameOverDismissed();
        renderTable();
        renderFooter();
        showAppToast(`Nilai Ronde ${targetIdx + 1} dikosongkan.`, 'info');
    });
}

if (btnDeleteRoundRow) {
    btnDeleteRoundRow.addEventListener('click', () => {
        if (activeActionRoundIdx < 0) return;
        const targetIdx = activeActionRoundIdx;
        closeRoundActionModal();
        showConfirmModal(`Yakin mau hapus baris Ronde ${targetIdx + 1}?`, () => {
            pushUndo();
            deleteRound(targetIdx);
            syncAnnouncersToRounds(getRounds().length);
            resetGameOverDismissed();
            if (getRounds().length === 0) {
                clearMatchTimer();
            }
            renderTable();
            renderFooter();
            showAppToast(`Ronde ${targetIdx + 1} berhasil dihapus.`, 'info');
        });
    });
}

if (btnCancelRoundAction) btnCancelRoundAction.addEventListener('click', closeRoundActionModal);
if (btnCloseRoundAction) btnCloseRoundAction.addEventListener('click', closeRoundActionModal);
if (roundActionModal) {
    roundActionModal.addEventListener('click', (e) => {
        if (e.target === roundActionModal) closeRoundActionModal();
    });
}

tbody.addEventListener('click', (e) => {
    const roundBtn = e.target.closest('.round-num-btn');
    if (roundBtn) {
        e.stopPropagation();
        const idx = parseInt(roundBtn.getAttribute('data-round-idx'), 10);
        openRoundActionModal(idx);
    }
});

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
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                        </div>
                        <div class="empty-state-title">Belum ada ronde</div>
                        <div class="empty-state-desc">Tap <strong>+ Ronde Baru</strong> di bawah untuk mulai mencatat skor &amp; menjalankan timer.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    rounds.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = 'score-row';
        tr.innerHTML = `
            <td style="text-align: center;">
                <button type="button" class="round-num-btn" data-round-idx="${index}" title="Opsi Ronde ${index + 1}" aria-label="Opsi Ronde ${index + 1}">
                    ${index + 1}
                </button>
            </td>
            ${players.map(p => {
                const rawVal = row[p] === '' || row[p] === undefined || row[p] === null ? '' : String(row[p]);
                const numVal = parseInt(rawVal, 10);
                const negClass = Number.isFinite(numVal) && numVal < 0 ? ' is-negative' : '';
                return `<td><input type="text" inputmode="none" readonly data-idx="${index}" data-player="${p}" value="${rawVal}" class="score-input${negClass}" aria-label="Ronde ${index + 1} ${p.toUpperCase()}"></td>`;
            }).join('')}
        `;
        tbody.appendChild(tr);
    });
}

export function renderFooter(isPreview = false) {
    const rounds = getRounds();
    const { totals, burnHistory, burnedByHistory, burnCounts, burnsInflictedCounts } = calculateTotals(rounds);

    // Update visual status cell (kebakar / pembakar / minus)
    document.querySelectorAll('.score-input').forEach(input => {
        const idx = parseInt(input.getAttribute('data-idx'), 10);
        const p = input.getAttribute('data-player');
        const val = parseInt(input.value, 10);

        input.classList.remove('is-burned', 'is-burner', 'is-negative');

        if (burnHistory[idx] && burnHistory[idx].includes(p)) {
            input.classList.add('is-burned');
        } else if (burnedByHistory[idx] && burnedByHistory[idx].includes(p)) {
            input.classList.add('is-burner');
        } else if (Number.isFinite(val) && val < 0) {
            input.classList.add('is-negative');
        }
    });

    const hasReachedWinScore = players.some(p => totals[p] >= WIN_SCORE);
    const lastRow = rounds[rounds.length - 1];
    const isCurrentRoundFinished = lastRow ? players.every(p => lastRow[p] !== '') : false;

    const liveOvertake = !isCurrentRoundFinished
        ? getLiveOvertakeWarnings(rounds)
        : { atRisk: new Set(), overtaking: new Set() };

    // Highlight sikut-sikutan untuk ronde aktif yang sedang diisi
    document.querySelectorAll('.score-input').forEach(input => {
        input.classList.remove('tense-atrisk', 'tense-overtaking');
    });
    if (!isCurrentRoundFinished && rounds.length > 0) {
        const lastIdx = rounds.length - 1;
        players.forEach(p => {
            const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
            if (!cell) return;
            if (liveOvertake.overtaking.has(p)) cell.classList.add('tense-overtaking');
            else if (liveOvertake.atRisk.has(p)) cell.classList.add('tense-atrisk');
        });
    }

    // Notif & animasi saat ada yang baru kebakar
    if (!isPreview) {
        checkAndAnnounceBurns(burnHistory, isCurrentRoundFinished);
        const lastIdx = burnHistory.length - 1;
        const freshBurns = burnHistory[lastIdx] || [];
        if (isCurrentRoundFinished && freshBurns.length > 0) {
            freshBurns.forEach(p => {
                const cell = tbody.querySelector(`.score-input[data-idx="${lastIdx}"][data-player="${p}"]`);
                if (cell) {
                    cell.classList.remove('burn-flicker');
                    void cell.offsetWidth;
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
        winners = determineWinners(totals, burnsInflictedCounts, burnCounts);
        minScore = Math.min(...players.map(p => totals[p]));
        losers = players.filter(p => totals[p] === minScore);
    }

    const rankedPlayers = rankPlayers(totals, burnsInflictedCounts, burnCounts);
    const leaderPlayer = rankedPlayers[0];
    const leaderScore = totals[leaderPlayer];
    const hasAnyPositive = players.some(p => totals[p] > 0);

    const getRankHtml = (p) => {
        if (!hasAnyPositive && rounds.length === 0) return '<div class="total-rank">—</div>';
        const rankIdx = rankedPlayers.indexOf(p);
        if (rankIdx === 0 && totals[p] > 0) return '<div class="total-rank is-leader">#1</div>';
        if (rankIdx === 3 && totals[p] <= 0) return '<div class="total-rank is-last">#4</div>';
        return `<div class="total-rank">#${rankIdx + 1}</div>`;
    };

    const getDiffHtml = (p) => {
        if (!hasAnyPositive) return '<div class="total-diff">&nbsp;</div>';
        if (p === leaderPlayer && totals[p] > 0) return '<div class="total-diff is-lead">LEAD</div>';
        const diff = totals[p] - leaderScore;
        return `<div class="total-diff">${diff}</div>`;
    };

    const getScoreClass = (p) => {
        if (!isGameOver) return 'total-score';
        if (winners.includes(p)) return 'total-score is-winner';
        if (losers.includes(p)) return 'total-score is-loser';
        return 'total-score';
    };

    const getProgressHtml = (p) => {
        const pct = Math.max(0, Math.min(100, (totals[p] / WIN_SCORE) * 100));
        return `<div class="total-progress" aria-hidden="true" title="${Math.round(pct)}% menuju ${WIN_SCORE}"><span style="width:${pct}%;background:var(--${p})"></span></div>`;
    };

    tfoot.innerHTML = `
        <div class="totals-label">TOT</div>
        ${players.map(p => `
            <div data-total-player="${p}" class="total-cell">
                ${getRankHtml(p)}
                <div class="${getScoreClass(p)}">${totals[p]}</div>
                ${getDiffHtml(p)}
                ${getProgressHtml(p)}
            </div>
        `).join('')}
    `;

    updateTimerDisplay();

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

    checkAndAnnounceWarning(rounds, liveOvertake, totalAtRisk, totalClosing, isGameOver);

    if (!isPreview) {
        if (isGameOver) {
            if (!gameOverDismissed) {
                markMatchEndIfNeeded();
                const durationText = formatDuration((getMatchEndTime() || Date.now()) - (getMatchStartTime() || Date.now()));

                document.querySelectorAll('.score-input').forEach(input => { input.disabled = true; });
                if (btnAdd) btnAdd.disabled = true;
                if (quickActionsPanel) quickActionsPanel.classList.add('hidden');
                document.body.classList.remove('keypad-open');
                document.body.style.paddingBottom = '';

                if (gameOverHandler) {
                    gameOverHandler({ winners, losers, minScore, totals, durationText, burnCounts, burnsInflictedCounts });
                }
            }
        } else {
            gameOverDismissed = false;
            document.querySelectorAll('.score-input').forEach(input => { input.disabled = false; });
            if (btnAdd) btnAdd.disabled = false;
            if (getMatchEndTime()) {
                resumeMatchTimerIfReopened();
            } else if (!isTimerRunning() && getMatchStartTime()) {
                startMatchTimer();
            }
        }
    }
}
