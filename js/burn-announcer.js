/**
 * burn-announcer.js
 * =================
 * Nge-track ronde mana yang notif "kebakar" dan audio "warning" deket-deketan
 * udah pernah ditampilin, biar maksimal bunyi SEKALI per ronde (anti-spam).
 */

import { showBurnToast } from './toast.js';
import { playBurnSound, playWarnSound } from './sound.js';
import { vibrateBurn } from './haptics.js';

let lastAnnouncedRoundIndex = -1;
let lastWarnedRoundIndex = -1;

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

/**
 * Peringatan suara sekali per ronde saat pemain berada di zona bahaya:
 * - Selisih poin mepet (<= 50, misal gap 5 s.d. 50 poin, leader >= 100)
 * - Atau saat ada aksi nyalip (live overtake)
 * Hanya berbunyi sekali per ronde (baik saat mengetik maupun saat ronde selesai).
 */
export function checkAndAnnounceWarning(rounds, liveOvertake, totalAtRisk, totalClosing, isGameOver) {
    if (isGameOver || !rounds || rounds.length === 0) return;

    const currentRoundIdx = rounds.length - 1;
    if (currentRoundIdx <= lastWarnedRoundIndex) return;

    const lastRow = rounds[currentRoundIdx];
    const hasSomeInput = lastRow && Object.values(lastRow).some(val => val !== '');
    const isRoundFinished = lastRow && Object.values(lastRow).every(val => val !== '');

    // Jangan berbunyi instan saat tombol "+ Ronde Baru" baru ditekan (semua masih kosong)
    if (!hasSomeInput && !isRoundFinished) return;

    const hasOvertakeThreat = (liveOvertake?.overtaking && liveOvertake.overtaking.size > 0) ||
                             (liveOvertake?.atRisk && liveOvertake.atRisk.size > 0);
    const hasProximityThreat = (totalAtRisk && totalAtRisk.size > 0) ||
                              (totalClosing && totalClosing.size > 0);

    if (hasOvertakeThreat || hasProximityThreat) {
        playWarnSound();
        lastWarnedRoundIndex = currentRoundIdx;
    }
}

/** Sinkronkan penanda ronde saat pengguna melakukan Undo langkah */
export function syncAnnouncersToRounds(roundsLength) {
    if (lastAnnouncedRoundIndex >= roundsLength) {
        lastAnnouncedRoundIndex = roundsLength - 1;
    }
    if (lastWarnedRoundIndex >= roundsLength) {
        lastWarnedRoundIndex = roundsLength - 1;
    }
}

export function resetWarnAnnouncer() {
    lastWarnedRoundIndex = -1;
}

/** Panggil ini tiap kali papan skor di-reset (reset/save-history/undo-ke-kosong/import). */
export function resetBurnAnnouncer() {
    lastAnnouncedRoundIndex = -1;
    lastWarnedRoundIndex = -1;
}
