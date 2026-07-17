/**
 * sound.js
 * ========
 * Efek suara CUSTOM - mainin file audio kamu sendiri dari folder /audio,
 * bukan nada synthesized lagi. Taruh file-mu di sana:
 *   - audio/burn.mp3  -> dimainin pas ada yang kebakar
 *   - audio/win.mp3   -> dimainin pas ada yang menang
 * (lihat audio/README.md). Kalau filenya belum ada, gapapa - suara cuma gak
 * kedengeran, app tetap jalan normal.
 *
 * Ada tombol mute (🔊/🔇) yang kepersist ke localStorage.
 */

const MUTE_KEY = 'score_tracker_muted';
const btnMuteToggle = document.getElementById('btn-mute-toggle');

let muted = localStorage.getItem(MUTE_KEY) === 'true';

const burnAudio = new Audio('audio/burn.mp3');
const winAudio = new Audio('audio/win.mp3');
burnAudio.preload = 'auto';
winAudio.preload = 'auto';

function play(audio) {
    if (muted) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
        // Gapapa kalau gagal (file belum ditaro, atau browser blokir autoplay
        // sebelum ada gesture user pertama) - lanjut normal tanpa suara.
    });
}

export function playBurnSound() {
    play(burnAudio);
}

export function playWinSound() {
    play(winAudio);
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
