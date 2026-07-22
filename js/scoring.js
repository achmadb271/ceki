/**
 * scoring.js
 * ==========
 * Fungsi kalkulasi murni (pure functions) - gak nyentuh DOM atau localStorage
 * sama sekali. Gampang di-test terpisah kalau suatu saat mau nambah unit test.
 */

import { players } from './store.js';

export const BURN_THRESHOLD = 100; // Skor minimal biar bisa "kebakar" kalau disalip
export const PROXIMITY_GAP = 50;   // Selisih total buat dianggap "udah deketan"
export const WIN_SCORE = 1000;

/**
 * Hitung total skor tiap pemain ronde demi ronde, sambil deteksi siapa
 * "kebakar" (skornya di atas ambang lalu kesalip -> direset ke 0), DAN siapa
 * yang jadi penyebabnya (yang nyalip).
 */
export function calculateTotals(rows) {
    let currentTotals = { p1: 0, p2: 0, p3: 0, p4: 0 };
    let burnHistory = [];   // Simpan data siapa yang gosong di setiap ronde
    let burnedByHistory = []; // Simpan data siapa yang JADI PENYEBAB gosong (yang nyalip) di tiap ronde

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let prevTotals = { ...currentTotals };
        let tempTotals = { ...currentTotals };
        let burnedInThisRound = [];
        let burnedByInThisRound = new Set();

        players.forEach(p => {
            tempTotals[p] += parseInt(row[p]) || 0;
        });

        const isRowFinished = players.every(p => row[p] !== '');

        if (isRowFinished) {
            let burnedPlayers = new Set();

            players.forEach(playerA => {
                // Mode "kebakar" cuma aktif kalau skor player itu SEBELUM ronde ini
                // udah minimal BURN_THRESHOLD. Di bawah itu, disalip ya wajar.
                if (prevTotals[playerA] < BURN_THRESHOLD) return;

                players.forEach(playerB => {
                    if (playerA !== playerB) {
                        if (prevTotals[playerA] > prevTotals[playerB] && tempTotals[playerB] > tempTotals[playerA]) {
                            burnedPlayers.add(playerA); // Lagi di atas ambang, terus disalip -> gosong!
                            burnedByInThisRound.add(playerB); // playerB yang nyalip -> penyebabnya
                        }
                    }
                });
            });

            burnedPlayers.forEach(p => {
                tempTotals[p] = 0; // Hukuman reset 0
                burnedInThisRound.push(p);
            });
        }

        burnHistory.push(burnedInThisRound);
        burnedByHistory.push([...burnedByInThisRound]);
        currentTotals = tempTotals;
    }

    return { totals: currentTotals, burnHistory, burnedByHistory };
}

/**
 * Preview live siapa yang KEMUNGKINAN kesalip/nyalip di ronde yang lagi
 * diketik (belum lengkap 4 kolom), pakai angka yang udah ke-input sejauh ini.
 */
export function getLiveOvertakeWarnings(rows) {
    const atRisk = new Set();     // udah di atas ambang, lagi keancem kesalip -> bakal kebakar
    const overtaking = new Set(); // yang lagi nyalip dia

    if (rows.length < 1) return { atRisk, overtaking };

    const lastIdx = rows.length - 1;
    const { totals: prevTotals } = calculateTotals(rows.slice(0, lastIdx));
    const row = rows[lastIdx];
    const previewTemp = { ...prevTotals };
    players.forEach(p => { previewTemp[p] += parseInt(row[p]) || 0; });

    players.forEach(a => {
        if (prevTotals[a] < BURN_THRESHOLD) return;
        players.forEach(b => {
            if (a === b) return;
            if (prevTotals[a] > prevTotals[b] && previewTemp[b] > previewTemp[a]) {
                atRisk.add(a);
                overtaking.add(b);
            }
        });
    });

    return { atRisk, overtaking };
}

/**
 * Deteksi "udah deketan" di TOTAL POINT sekarang (gak butuh ngetik apa-apa dulu).
 * Kalau selisih total 2 pemain <= PROXIMITY_GAP dan yang unggul udah lewat ambang
 * kebakar, langsung kasih highlight: yang unggul (keancem) & yang ngintil (siap nyalip).
 */
export function getTotalProximityWarnings(totals) {
    const atRisk = new Set();
    const closing = new Set();

    players.forEach(a => {
        if (totals[a] < BURN_THRESHOLD) return;
        players.forEach(b => {
            if (a === b) return;
            if (totals[a] > totals[b] && (totals[a] - totals[b]) <= PROXIMITY_GAP) {
                atRisk.add(a);
                closing.add(b);
            }
        });
    });

    return { atRisk, closing };
}

/** Ranking pemain berdasarkan total skor, dari tertinggi ke terendah. */
export function rankPlayers(totals) {
    return [...players].sort((a, b) => totals[b] - totals[a]);
}

/** Hitung berapa kali tiap pemain kebakar sepanjang match, dari burnHistory (hasil calculateTotals). */
export function countBurns(burnHistory) {
    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    burnHistory.forEach(burnedThisRound => {
        burnedThisRound.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    });
    return counts;
}
