/**
 * haptics.js
 * ==========
 * Getar HP pas kebakar/menang (Vibration API). Berguna banget kalau HP lagi
 * silent/DND - getar tetep kerasa walau suara gak bunyi.
 *
 * Cuma jalan di browser yang dukung (Chrome/Android dkk). iPhone/Safari
 * emang gak pernah nyediain API ini buat web sama sekali - otomatis
 * di-skip di situ, gak bikin error.
 */

function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

/** Getar pendek-jeda-pendek-jeda-panjang, kesan "kebakar". */
export function vibrateBurn() {
    vibrate([100, 50, 100, 50, 200]);
}

/** Getar 3x pendek beruntun ditutup 1x panjang, kesan "menang". */
export function vibrateWin() {
    vibrate([80, 40, 80, 40, 80, 40, 250]);
}
