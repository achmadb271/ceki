/**
 * wakelock.js
 * ===========
 * Screen Wake Lock - layar HP gak auto-mati/nge-dim pas match lagi
 * berlangsung, biar gak perlu buka kunci HP tiap ganti ronde.
 *
 * Browser WAJIB (bagian dari spec) ngelepas wake lock pas tab di-background
 * (pindah app lain / kunci HP manual), makanya kita perlu re-acquire pas
 * balik ke tab ini lagi (visibilitychange) - itu yang dijaga fungsi
 * `holdWakeLock`/listener di bawah, bukan cuma sekali minta terus lupa.
 *
 * Browser yang gak dukung (Firefox, Safari lama) otomatis di-skip, gak error.
 */

let wakeLock = null;
let shouldHold = false; // true selama match lagi aktif (ronde jalan, belum menang/reset)

async function acquire() {
    if (!('wakeLock' in navigator) || !shouldHold || wakeLock) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
        // Gapapa kalau gagal (misal battery saver aktif, atau tab lagi gak
        // fokus pas diminta) - app tetap jalan normal, cuma layar bisa
        // auto-mati kayak biasa.
        wakeLock = null;
    }
}

async function release() {
    const current = wakeLock;
    wakeLock = null; // clear duluan secara synchronous, biar acquire() susulan gak ketuker sama yang lagi di-release
    if (current) {
        await current.release().catch(() => {});
    }
}

/** Panggil pas match mulai/lanjut jalan. */
export function holdWakeLock() {
    shouldHold = true;
    acquire();
}

/** Panggil pas match berhenti (menang / reset / undo balik kosong). */
export function releaseWakeLock() {
    shouldHold = false;
    release();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
});
