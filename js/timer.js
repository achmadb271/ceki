/**
 * timer.js
 * ========
 * Timer durasi pertandingan. Timer BARU mulai begitu ronde pertama
 * ditambahin (lihat main.js), bukan pas halaman dibuka.
 */

import {
    getMatchStartTime,
    getMatchEndTime,
    startNewMatch as storeStartNewMatch,
    markMatchEnd as storeMarkMatchEnd,
    clearMatchEnd as storeClearMatchEnd,
    clearMatchTiming,
} from './store.js';
import { holdWakeLock, releaseWakeLock } from './wakelock.js';

let timerInterval = null;

export function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function updateTimerDisplay() {
    const textEl = document.getElementById('match-timer-text');
    const pill = document.getElementById('match-timer');
    if (!textEl) return;
    const start = getMatchStartTime();
    const endTs = getMatchEndTime();

    if (pill) {
        pill.classList.toggle('is-running', !!start && !endTs && isTimerRunning());
        pill.classList.toggle('is-finished', !!start && !!endTs);
        pill.title = !start
            ? 'Timer mulai saat ronde pertama dibuat'
            : (endTs ? 'Durasi akhir pertandingan' : 'Pertandingan sedang berjalan');
    }

    if (!start) {
        textEl.textContent = '00:00';
        return;
    }
    const end = endTs || Date.now();
    textEl.textContent = formatDuration(end - start);
}

export function startMatchTimer() {
    stopMatchTimer();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
    holdWakeLock();
}

export function stopMatchTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    releaseWakeLock();
    updateTimerDisplay();
}

export function isTimerRunning() {
    return timerInterval !== null;
}

export function markMatchEndIfNeeded() {
    storeMarkMatchEnd();
    stopMatchTimer();
    updateTimerDisplay();
}

export function resumeMatchTimerIfReopened() {
    storeClearMatchEnd();
    if (getMatchStartTime() && !isTimerRunning()) {
        startMatchTimer();
    }
}

export function startNewMatchTimer() {
    storeStartNewMatch();
    startMatchTimer();
}

/** Balikin timer ke kondisi "belum mulai sama sekali" (papan skor kosong lagi) */
export function clearMatchTimer() {
    stopMatchTimer();
    clearMatchTiming();
    updateTimerDisplay();
}

/** Dipanggil sekali pas load: lanjutin timer kalau match lagi jalan, atau tampilin durasi final kalau udah selesai. */
export function initTimerFromSavedState() {
    if (getMatchEndTime()) {
        updateTimerDisplay();
    } else if (getMatchStartTime()) {
        startMatchTimer();
    } else {
        updateTimerDisplay();
    }
}
