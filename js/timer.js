/**
 * timer.js
 * ========
 * Timer durasi pertandingan. Timer BARU mulai begitu ronde pertama
 * ditambahin (lihat main.js), bukan pas halaman dibuka.
 */

import { getMatchStartTime, getMatchEndTime, startNewMatch as storeStartNewMatch, markMatchEnd as storeMarkMatchEnd, clearMatchTiming } from './store.js';
import { holdWakeLock, releaseWakeLock } from './wakelock.js';

const matchTimerEl = document.getElementById('match-timer');
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
    if (!matchTimerEl) return;
    const start = getMatchStartTime();
    if (!start) {
        matchTimerEl.textContent = '⏱️ 00:00';
        return;
    }
    const end = getMatchEndTime() || Date.now();
    matchTimerEl.textContent = '⏱️ ' + formatDuration(end - start);
}

export function startMatchTimer() {
    stopMatchTimer();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    holdWakeLock();
}

export function stopMatchTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    releaseWakeLock();
}

export function isTimerRunning() {
    return timerInterval !== null;
}

export function markMatchEndIfNeeded() {
    storeMarkMatchEnd();
    stopMatchTimer();
    updateTimerDisplay();
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
        updateTimerDisplay(); // game sebelumnya udah selesai, timer beku di durasi akhir
    } else if (getMatchStartTime()) {
        startMatchTimer(); // ada match yang lagi jalan (reload di tengah permainan) -> lanjutin
    } else {
        updateTimerDisplay(); // belum ada ronde sama sekali
    }
}
