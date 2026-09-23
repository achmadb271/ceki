/**
 * scoring.js
 * ==========
 * Fungsi kalkulasi murni (pure functions) - gak nyentuh DOM atau localStorage
 * sama sekali. Gampang di-test terpisah kalau suatu saat mau nambah unit test.
 */

import { players } from './store.js';

export const BURN_THRESHOLD = 100; // Skor minimal biar bisa "kebakar" kalau disalip (<100 = safezone)
export const PROXIMITY_GAP = 50;   // Selisih total buat dianggap "udah deketan"
export const WIN_SCORE = 1000;

/**
 * Hitung total skor tiap pemain ronde demi ronde, sambil deteksi siapa
 * "kebakar" (skornya di atas ambang lalu BENERAN kesalip -> direset, minus tetap nancep),
 * DAN siapa yang jadi penyebabnya (yang nyalip).
 *
 * Aturan Kebakar:
 *   1. Poin sebelum ronde HARUS >= BURN_THRESHOLD (100).
 *   2. Safezone: Poin setelah ronde (sebelum di-reset) HARUS tetap >= BURN_THRESHOLD (100).
 *      Jika poinnya turun ke <100, pemain masuk safezone (aman dari kebakar).
 *   3. Penantang harus BENERAN nyalip (total akhir penantang > total akhir leader).
 *   4. Poin yang didapat penantang di ronde ini harus POSITIF (>0).
 *   5. Opsi C: Jika kebakar, poin sebelum ronde hangus ke 0, tetapi penalti minus
 *      di ronde ini TETAP MASUK: tempTotals = Math.min(0, poin_ronde).
 */
export function calculateTotals(rows) {
    let currentTotals = { p1: 0, p2: 0, p3: 0, p4: 0 };
    let burnHistory = [];          // Simpan data siapa yang gosong di setiap ronde
    let burnedByHistory = [];      // Simpan data siapa yang JADI PENYEBAB gosong (yang nyalip) di tiap ronde
    let burnCounts = { p1: 0, p2: 0, p3: 0, p4: 0 };           // Berapa kali tiap pemain kena bakar
    let burnsInflictedCounts = { p1: 0, p2: 0, p3: 0, p4: 0 }; // Berapa kali tiap pemain ngebakar orang lain

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let prevTotals = { ...currentTotals };
        let tempTotals = { ...currentTotals };
        let burnedInThisRound = [];
        let burnedByInThisRound = [];

        players.forEach(p => {
            tempTotals[p] += parseInt(row[p]) || 0;
        });

        const isRowFinished = players.every(p => row[p] !== '');

        if (isRowFinished) {
            let burnedPlayers = new Set();
            let roundBurnPairs = [];

            players.forEach(playerA => {
                // Syarat 1: Skor playerA SEBELUM ronde ini harus sudah minimal BURN_THRESHOLD (100)
                if (prevTotals[playerA] < BURN_THRESHOLD) return;

                // Cari semua kandidat penantang yang memenuhi syarat menyalip playerA:
                // 1. Penantang playerB sebelumnya di bawah playerA (wasAhead: prevTotals[A] > prevTotals[B])
                // 2. Total akhir penantang sekarang di atas total akhir playerA (nowBehind: tempTotals[B] > tempTotals[A])
                // 3. Poin yang didapat penantang di ronde ini harus POSITIF (gain > 0)
                const candidates = [];
                players.forEach(playerB => {
                    if (playerA !== playerB) {
                        const wasAhead = prevTotals[playerA] > prevTotals[playerB];
                        const nowBehind = tempTotals[playerB] > tempTotals[playerA];
                        const playerBGainThisRound = parseInt(row[playerB]) || 0;
                        const genuineGain = playerBGainThisRound > 0;

                        if (wasAhead && nowBehind && genuineGain) {
                            candidates.push(playerB);
                        }
                    }
                });

                if (candidates.length === 0) return;

                // Syarat Safezone:
                // Jika playerA turun ke [0, BURN_THRESHOLD - 1] (0-99), dan TIDAK ADA penantang
                // yang melampaui skor lama playerA (tempTotals[B] > prevTotals[playerA]),
                // maka playerA aman di safezone (tidak kebakar).
                // Tapi jika playerA < 0 (minus/tekor) atau ada penantang yang berhasil melewati skor lama playerA,
                // maka playerA tetap kebakar.
                const isInSafezone = tempTotals[playerA] >= 0 && tempTotals[playerA] < BURN_THRESHOLD;
                const anySurpassedOldScore = candidates.some(b => tempTotals[b] > prevTotals[playerA]);

                if (isInSafezone && !anySurpassedOldScore) return;

                burnedPlayers.add(playerA);

                // Penantang dengan skor tertinggi yang berhak membakar playerA
                // (jika ada beberapa pemain yang menyalip, hanya skor tertinggi yang dihitung membakar)
                const maxCandidateScore = Math.max(...candidates.map(b => tempTotals[b]));
                const bestBurners = candidates.filter(b => tempTotals[b] === maxCandidateScore);
                bestBurners.forEach(burner => {
                    roundBurnPairs.push({ victim: playerA, burner });
                });
            });

            burnedPlayers.forEach(p => {
                const roundScore = parseInt(row[p]) || 0;
                // Opsi C: Skor sebelum ronde hangus ke 0. Jika ronde ini kena minus,
                // minusnya tetap masuk (0 + roundScore). Jika ronde ini >= 0, skor direset ke 0.
                tempTotals[p] = Math.min(0, roundScore);
                burnedInThisRound.push(p);
                burnCounts[p] = (burnCounts[p] || 0) + 1;
            });

            roundBurnPairs.forEach(({ burner }) => {
                burnedByInThisRound.push(burner);
                burnsInflictedCounts[burner] = (burnsInflictedCounts[burner] || 0) + 1;
            });
        }

        burnHistory.push(burnedInThisRound);
        burnedByHistory.push([...new Set(burnedByInThisRound)]);
        currentTotals = tempTotals;
    }

    return {
        totals: currentTotals,
        burnHistory,
        burnedByHistory,
        burnCounts,
        burnsInflictedCounts
    };
}

/**
 * Preview live siapa yang KEMUNGKINAN kesalip/nyalip di ronde yang lagi
 * diketik (belum lengkap 4 kolom), pakai angka yang udah ke-input sejauh ini.
 */
export function getLiveOvertakeWarnings(rows) {
    const atRisk = new Set();     // udah di atas ambang & di luar safezone, lagi keancem kesalip -> bakal kebakar
    const overtaking = new Set(); // yang lagi nyalip dia

    if (rows.length < 1) return { atRisk, overtaking };

    const lastIdx = rows.length - 1;
    const { totals: prevTotals } = calculateTotals(rows.slice(0, lastIdx));
    const row = rows[lastIdx];
    const previewTemp = { ...prevTotals };
    players.forEach(p => { previewTemp[p] += parseInt(row[p]) || 0; });

    players.forEach(a => {
        if (prevTotals[a] < BURN_THRESHOLD) return;

        const candidates = [];
        players.forEach(b => {
            if (a !== b) {
                const wasAhead = prevTotals[a] > prevTotals[b];
                const nowBehind = previewTemp[b] > previewTemp[a];
                const playerBGainSoFar = parseInt(row[b]) || 0;
                const genuineGain = playerBGainSoFar > 0;

                if (wasAhead && nowBehind && genuineGain) {
                    candidates.push(b);
                }
            }
        });

        if (candidates.length === 0) return;

        const isInSafezone = previewTemp[a] >= 0 && previewTemp[a] < BURN_THRESHOLD;
        const anySurpassedOldScore = candidates.some(b => previewTemp[b] > prevTotals[a]);

        if (isInSafezone && !anySurpassedOldScore) return;

        atRisk.add(a);

        // Hanya penantang dengan skor tertinggi yang di-highlight overtaking
        const maxCandidateScore = Math.max(...candidates.map(b => previewTemp[b]));
        candidates.filter(b => previewTemp[b] === maxCandidateScore).forEach(b => {
            overtaking.add(b);
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
            if (totals[a] >= totals[b] && (totals[a] - totals[b]) <= PROXIMITY_GAP) {
                atRisk.add(a);
                closing.add(b);
            }
        });
    });

    return { atRisk, closing };
}

/**
 * Ranking pemain berdasarkan total skor, dari tertinggi ke terendah.
 * Jika total skor sama (seri):
 *   1. Dihitung dari seberapa sering dia ngebakar pemain lain (burnsInflicted - terbanyak).
 *   2. Dihitung dari seberapa jarang dia kena bakar (burnsSuffered - tersedikit).
 */
export function rankPlayers(totals, burnsInflicted = null, burnsSuffered = null) {
    return [...players].sort((a, b) => {
        if (totals[b] !== totals[a]) {
            return totals[b] - totals[a];
        }
        if (burnsInflicted) {
            const diffInflicted = (burnsInflicted[b] || 0) - (burnsInflicted[a] || 0);
            if (diffInflicted !== 0) return diffInflicted;
        }
        if (burnsSuffered) {
            const diffSuffered = (burnsSuffered[a] || 0) - (burnsSuffered[b] || 0);
            if (diffSuffered !== 0) return diffSuffered;
        }
        return 0;
    });
}

/**
 * Tentukan pemenang (juara 1) saat game over.
 * Menggunakan aturan tie-breaker jika ada pemain dengan skor tertinggi yang bernilai sama:
 *   1. Paling banyak membakar pemain lain
 *   2. Paling sedikit kena bakar
 *   3. Jika masih sama persis, juara bersama
 */
export function determineWinners(totals, burnsInflicted, burnsSuffered) {
    const qualified = players.filter(p => totals[p] >= WIN_SCORE);
    if (qualified.length === 0) return [];

    const maxScore = Math.max(...qualified.map(p => totals[p]));
    const topScorers = qualified.filter(p => totals[p] === maxScore);

    if (topScorers.length === 1) {
        return topScorers;
    }

    // Seri skor tertinggi -> Tie-breaker
    // 1. Paling sering membakar lawan
    const maxInflicted = Math.max(...topScorers.map(p => burnsInflicted[p] || 0));
    const byInflicted = topScorers.filter(p => (burnsInflicted[p] || 0) === maxInflicted);
    if (byInflicted.length === 1) {
        return byInflicted;
    }

    // 2. Paling sedikit kena bakar
    const minSuffered = Math.min(...byInflicted.map(p => burnsSuffered[p] || 0));
    const bySuffered = byInflicted.filter(p => (burnsSuffered[p] || 0) === minSuffered);

    return bySuffered;
}

/** Hitung berapa kali tiap pemain kebakar sepanjang match, dari burnHistory (hasil calculateTotals). */
export function countBurns(burnHistory) {
    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    burnHistory.forEach(burnedThisRound => {
        burnedThisRound.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    });
    return counts;
}
