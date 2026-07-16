/**
 * store.js
 * ========
 * Satu-satunya modul yang boleh baca/tulis langsung ke localStorage.
 * Modul lain akses state lewat fungsi-fungsi di sini, bukan lewat
 * localStorage langsung, biar gampang dilacak siapa ubah apa.
 */

const SCORE_KEY = 'score_tracker_state';
const NAME_KEY = 'score_tracker_names';
const HISTORY_KEY = 'score_tracker_history';
const MATCH_START_KEY = 'score_tracker_match_start';
const MATCH_END_KEY = 'score_tracker_match_end';

export const players = ['p1', 'p2', 'p3', 'p4'];

let state = JSON.parse(localStorage.getItem(SCORE_KEY)) || [];
let playerNames = JSON.parse(localStorage.getItem(NAME_KEY)) || { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4' };
let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let matchStartTime = parseInt(localStorage.getItem(MATCH_START_KEY)) || null;
let matchEndTime = parseInt(localStorage.getItem(MATCH_END_KEY)) || null;

// --- Rounds (state) ---
export function getRounds() {
    return state;
}

export function setRounds(newRounds) {
    state = newRounds;
    localStorage.setItem(SCORE_KEY, JSON.stringify(state));
}

export function saveRounds() {
    localStorage.setItem(SCORE_KEY, JSON.stringify(state));
}

export function addRound(round) {
    state.push(round);
    saveRounds();
}

// --- Player names ---
export function getPlayerNames() {
    return playerNames;
}

export function setPlayerName(key, value) {
    playerNames[key] = value || key.toUpperCase();
    localStorage.setItem(NAME_KEY, JSON.stringify(playerNames));
}

export function setAllPlayerNames(newNames) {
    playerNames = newNames;
    localStorage.setItem(NAME_KEY, JSON.stringify(playerNames));
}

// --- History ---
export function getHistory() {
    return history;
}

export function addHistoryEntry(entry) {
    history.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function setAllHistory(newHistory) {
    history = newHistory;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
    history = [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// --- Match timing ---
export function getMatchStartTime() {
    return matchStartTime;
}

export function getMatchEndTime() {
    return matchEndTime;
}

export function startNewMatch() {
    matchStartTime = Date.now();
    matchEndTime = null;
    localStorage.setItem(MATCH_START_KEY, String(matchStartTime));
    localStorage.removeItem(MATCH_END_KEY);
}

export function markMatchEnd() {
    if (!matchEndTime) {
        matchEndTime = Date.now();
        localStorage.setItem(MATCH_END_KEY, String(matchEndTime));
    }
}

export function clearMatchTiming() {
    matchStartTime = null;
    matchEndTime = null;
    localStorage.removeItem(MATCH_START_KEY);
    localStorage.removeItem(MATCH_END_KEY);
}

export function setMatchTiming(startTime, endTime) {
    matchStartTime = startTime;
    matchEndTime = endTime;
    if (matchStartTime) {
        localStorage.setItem(MATCH_START_KEY, String(matchStartTime));
    } else {
        localStorage.removeItem(MATCH_START_KEY);
    }
    if (matchEndTime) {
        localStorage.setItem(MATCH_END_KEY, String(matchEndTime));
    } else {
        localStorage.removeItem(MATCH_END_KEY);
    }
}

// --- Full reset ---
export function resetMatchOnly() {
    state = [];
    saveRounds();
}
