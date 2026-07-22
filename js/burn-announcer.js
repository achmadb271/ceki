/**
 * burn-announcer.js
 * =================
 * Nge-track ronde mana yang notif "kebakar"-nya udah pernah ditampilin,
 * biar gak muncul berkali-kali tiap renderFooter() dipanggil ulang.
 */

import { showBurnToast } from './toast.js';
import { playBurnSound } from './sound.js';
import { vibrateBurn } from './haptics.js';

let lastAnnouncedRoundIndex = -1;

export function checkAndAnnounceBurns(burnHistory, isLastRowFinished) {
    if (!isLastRowFinished) return;
    const lastIdx = burnHistory.length - 1;
    if (lastIdx <= lastAnnouncedRoundIndex) return;
    const burnsThisRound = burnHistory[lastIdx] || [];
    if (burnsThisRound.length > 0) {
        showBurnToast(burnsThisRound);
        playBurnSound();
        vibrateBurn();
    }
    lastAnnouncedRoundIndex = lastIdx;
}

/** Panggil ini tiap kali papan skor di-reset (reset/save-history/undo-ke-kosong/import). */
export function resetBurnAnnouncer() {
    lastAnnouncedRoundIndex = -1;
}
