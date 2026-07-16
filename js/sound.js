/**
 * sound.js
 * ========
 * Efek suara pakai Web Audio API (nada di-generate langsung dari kode, gak
 * butuh file audio eksternal - tetep ringan & offline-friendly kayak
 * prinsip module lain di project ini). Ada tombol mute yang kepersist ke
 * localStorage.
 */

const MUTE_KEY = 'score_tracker_muted';
const btnMuteToggle = document.getElementById('btn-mute-toggle');

let audioCtx = null;
let muted = localStorage.getItem(MUTE_KEY) === 'true';

function getContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Browser modern nge-suspend AudioContext sampe ada gesture user - resume kalau perlu
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function tone(ctx, freq, startTime, duration, type, gainPeak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}

/** Nada turun 3 tahap + timbre kasar (sawtooth/square), kesan "kebakar". */
export function playBurnSound() {
    if (muted) return;
    const ctx = getContext();
    const now = ctx.currentTime;
    tone(ctx, 420, now, 0.12, 'sawtooth', 0.18);
    tone(ctx, 280, now + 0.08, 0.18, 'sawtooth', 0.16);
    tone(ctx, 160, now + 0.16, 0.22, 'square', 0.14);
}

/** Arpeggio 4 nada naik, kesan "menang" / fanfare pendek. */
export function playWinSound() {
    if (muted) return;
    const ctx = getContext();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(ctx, freq, now + i * 0.11, 0.28, 'triangle', 0.18);
    });
}

function updateMuteIcon() {
    btnMuteToggle.textContent = muted ? '🔇' : '🔊';
    btnMuteToggle.setAttribute('aria-label', muted ? 'Bunyikan suara' : 'Matikan suara');
}

btnMuteToggle.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, String(muted));
    updateMuteIcon();
});

updateMuteIcon();
