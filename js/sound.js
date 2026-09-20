/**
 * sound.js
 * ========
 * Efek suara cerdas & audio meme Ceki:
 *   - Acak suara kebakar: audio/burn1.mp3, burn2.mp3, burn.mp3
 *   - Acak suara menang: audio/win.mp3, win1.mp3
 *   - Suara peringatan mau nyalip / terancam: audio/warn.mp3
 *   - Suara feedback sentuhan tombol keypad
 * Menggunakan Web Audio API Buffer Engine (anti-blokir autoplay mobile, bebas delay),
 * dan otomatis fallback ke Web Audio API synthesizer jika file belum ada.
 * Ada tombol mute (🔊/🔇) yang kepersist ke localStorage.
 */

const MUTE_KEY = 'score_tracker_muted';
const btnMuteToggle = document.getElementById('btn-mute-toggle');

let muted = localStorage.getItem(MUTE_KEY) === 'true';

// Gunakan URL absolut yang di-resolve berdasarkan lokasi modul saat ini (aman untuk GitHub Pages subpath)
const BURN_FILES = [
    new URL('../audio/burn1.mp3', import.meta.url).href,
    new URL('../audio/burn2.mp3', import.meta.url).href,
    new URL('../audio/burn.mp3', import.meta.url).href,
];

const WIN_FILES = [
    new URL('../audio/win.mp3', import.meta.url).href,
    new URL('../audio/win1.mp3', import.meta.url).href,
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

// In-memory audio buffer cache agar pemutaran instan tanpa request berulang
const audioBufferCache = new Map();

async function loadBuffer(url) {
    if (audioBufferCache.has(url)) return audioBufferCache.get(url);
    const ctx = getAudioContext();
    if (!ctx) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        audioBufferCache.set(url, audioBuf);
        return audioBuf;
    } catch (e) {
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
        if (!buf) {
            buf = await loadBuffer(url);
        }
        if (buf && playBuffer(buf)) {
            return;
        }
    }

    // Fallback: HTML5 Audio jika Web Audio Buffer gagal
    try {
        const audio = new Audio(url);
        audio.currentTime = 0;
        await audio.play();
    } catch (err) {
        if (synthFallback) synthFallback();
    }
}

// Inisialisasi AudioContext & preload audio pada tap/klik pertama agar mobile browser mengizinkan audio
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
        gain.gain.setValueAtTime(0.3, now);
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
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const now = ctx.currentTime;
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + idx * 0.11;
            const stopTime = startTime + 0.22;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.25, startTime);
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
        // Nada alert sonar / bahaya dua nada naik-turun cepat
        const now = ctx.currentTime;
        [0, 0.15].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now + delay);
            osc.frequency.exponentialRampToValueAtTime(440, now + delay + 0.12);
            gain.gain.setValueAtTime(0.35, now + delay);
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
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(820, now + 0.025);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.025);
    } catch (e) {
        // ignore
    }
}

export function playBurnSound() {
    if (muted) return;
    // Pilih acak dari pool file audio kebakar yang tersedia
    const chosen = BURN_FILES[Math.floor(Math.random() * BURN_FILES.length)];
    playAudioFile(chosen, () => {
        playAudioFile(BURN_FILES[0], playSynthBurn);
    });
}

export function playWinSound() {
    if (muted) return;
    const chosen = WIN_FILES[Math.floor(Math.random() * WIN_FILES.length)];
    playAudioFile(chosen, playSynthWin);
}

let lastWarnPlayedAt = 0;
export function playWarnSound() {
    if (muted) return;
    // Anti-spam debounce: maksimal sekali per 2.5 detik saat situasi genting
    const now = Date.now();
    if (now - lastWarnPlayedAt < 2500) return;
    lastWarnPlayedAt = now;

    playAudioFile(WARN_FILE, playSynthWarn);
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
