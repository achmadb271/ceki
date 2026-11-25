/**
 * sound.js
 * ========
 * Efek suara & audio meme Ceki:
 *   - Suara kebakar: audio/burn.mp3 (fallback Web Audio synth)
 *   - Suara peringatan mau nyalip / terancam: audio/warn.mp3 (fallback synth)
 *   - Suara menang: Web Audio API fanfare synth langsung (tanpa 404 fetch)
 *   - Suara feedback sentuhan tombol keypad
 */

import { ICONS } from './utils.js';

const MUTE_KEY = 'score_tracker_muted';
const btnMuteToggle = document.getElementById('btn-mute-toggle');

let muted = (() => {
    try {
        return localStorage.getItem(MUTE_KEY) === 'true';
    } catch (e) {
        return false;
    }
})();

const BURN_FILES = [
    new URL('../audio/burn.mp3', import.meta.url).href,
];

const WARN_FILE = new URL('../audio/warn.mp3', import.meta.url).href;

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
            audioCtx = new AudioCtxClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

const audioBufferCache = new Map();

async function loadBuffer(url) {
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    const ctx = getAudioContext();
    if (!ctx) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            audioBufferCache.set(url, null);
            return null;
        }
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        audioBufferCache.set(url, audioBuf);
        return audioBuf;
    } catch (e) {
        audioBufferCache.set(url, null);
        return null;
    }
}

function playBuffer(buf) {
    const ctx = getAudioContext();
    if (!ctx || !buf) return false;
    try {
        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(ctx.destination);
        source.start(0);
        return true;
    } catch (e) {
        return false;
    }
}

async function playAudioFile(url, synthFallback) {
    if (muted) return;
    const ctx = getAudioContext();
    if (ctx) {
        let buf = audioBufferCache.get(url);
        if (buf === undefined) {
            buf = await loadBuffer(url);
        }
        if (buf && playBuffer(buf)) {
            return;
        }
    }
    if (synthFallback && typeof synthFallback === 'function') {
        synthFallback();
    }
}

function onFirstInteraction() {
    getAudioContext();
    loadBuffer(WARN_FILE);
    BURN_FILES.forEach(url => loadBuffer(url));
}
document.addEventListener('pointerdown', onFirstInteraction, { once: true });
document.addEventListener('click', onFirstInteraction, { once: true });

function playSynthBurn() {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
    } catch (e) {
        // ignore
    }
}

function playSynthWin() {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const now = ctx.currentTime;
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.1;
            const stopTime = startTime + 0.24;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.24, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, stopTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(stopTime);
        });
    } catch (e) {
        // ignore
    }
}

function playSynthWarn() {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        [0, 0.15].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now + delay);
            osc.frequency.exponentialRampToValueAtTime(440, now + delay + 0.12);
            gain.gain.setValueAtTime(0.3, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.12);
        });
    } catch (e) {
        // ignore
    }
}

export function playKeypadClick() {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.022);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.022);
    } catch (e) {
        // ignore
    }
}

export function playBurnSound() {
    if (muted) return;
    const chosen = BURN_FILES[Math.floor(Math.random() * BURN_FILES.length)];
    playAudioFile(chosen, playSynthBurn);
}

export function playWinSound() {
    if (muted) return;
    playSynthWin();
}

let lastWarnPlayedAt = 0;
export function playWarnSound() {
    if (muted) return;
    const now = Date.now();
    if (now - lastWarnPlayedAt < 400) return;
    lastWarnPlayedAt = now;
    playAudioFile(WARN_FILE, playSynthWarn);
}

function updateMuteIcon() {
    const btn = document.getElementById('btn-mute-toggle');
    if (!btn) return;
    btn.innerHTML = muted ? ICONS.volumeOff : ICONS.volumeOn;
    const label = muted ? 'Bunyikan suara' : 'Matikan suara';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.classList.toggle('is-active', !muted);
}

if (btnMuteToggle) {
    btnMuteToggle.addEventListener('click', () => {
        muted = !muted;
        try {
            localStorage.setItem(MUTE_KEY, String(muted));
        } catch (e) {
            // ignore
        }
        updateMuteIcon();
    });
}

updateMuteIcon();
