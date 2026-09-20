/**
 * sound.js
 * ========
 * Efek suara cerdas & audio meme Ceki:
 *   - Acak suara kebakar: audio/burn.mp3, burn1.mp3, burn2.mp3, burn3.mp3, dst.
 *   - Acak suara menang: audio/win.mp3, win1.mp3, win2.mp3, dst.
 *   - Suara peringatan mau nyalip / terancam: audio/warn.mp3
 *   - Suara feedback sentuhan tombol keypad
 * Jika file audio belum ada, otomatis memakai Web Audio API synthesizer sebagai fallback!
 * Ada tombol mute (🔊/🔇) yang kepersist ke localStorage.
 */

const MUTE_KEY = 'score_tracker_muted';
const btnMuteToggle = document.getElementById('btn-mute-toggle');

let muted = localStorage.getItem(MUTE_KEY) === 'true';

const BURN_FILES = [
    'audio/burn.mp3',
    'audio/burn1.mp3',
    'audio/burn2.mp3',
    'audio/burn3.mp3',
    'audio/burn4.mp3',
    'audio/burn5.mp3',
];

const WIN_FILES = [
    'audio/win.mp3',
    'audio/win1.mp3',
    'audio/win2.mp3',
    'audio/win3.mp3',
];

const warnAudio = new Audio('audio/warn.mp3');
warnAudio.preload = 'auto';

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

// Inisialisasi AudioContext saat interaksi pertama user agar aman dari blokir browser
document.addEventListener('pointerdown', () => getAudioContext(), { once: true });

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
    // Pilih acak dari pool audio kebakar/meme
    const chosen = BURN_FILES[Math.floor(Math.random() * BURN_FILES.length)];
    const audio = new Audio(chosen);
    audio.play().catch(() => {
        const baseAudio = new Audio('audio/burn.mp3');
        baseAudio.play().catch(() => {
            playSynthBurn();
        });
    });
}

export function playWinSound() {
    if (muted) return;
    const chosen = WIN_FILES[Math.floor(Math.random() * WIN_FILES.length)];
    const audio = new Audio(chosen);
    audio.play().catch(() => {
        const baseAudio = new Audio('audio/win.mp3');
        baseAudio.play().catch(() => {
            playSynthWin();
        });
    });
}

let lastWarnPlayedAt = 0;
export function playWarnSound() {
    if (muted) return;
    // Anti-spam debounce: maksimal sekali per 2.5 detik saat situasi genting
    const now = Date.now();
    if (now - lastWarnPlayedAt < 2500) return;
    lastWarnPlayedAt = now;

    warnAudio.currentTime = 0;
    warnAudio.play().catch(() => {
        playSynthWarn();
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
