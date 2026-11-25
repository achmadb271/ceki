/**
 * store.js
 * ========
 * Satu-satunya modul yang boleh baca/tulis langsung ke localStorage.
 * Semua pembacaan dibungkus try/catch agar storage korup tidak membuat app crash.
 */

const SCORE_KEY = 'score_tracker_state';
const NAME_KEY = 'score_tracker_names';
const HISTORY_KEY = 'score_tracker_history';
const MATCH_START_KEY = 'score_tracker_match_start';
const MATCH_END_KEY = 'score_tracker_match_end';

export const players = ['p1', 'p2', 'p3', 'p4'];
const DEFAULT_NAMES = { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4' };

function safeReadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (err) {
        return fallback;
    }
}

function safeWrite(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (err) {
        // ignore quota/private mode errors
    }
}

function safeRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (err) {
        // ignore
    }
}

function safeReadInt(key) {
    try {
        const val = parseInt(localStorage.getItem(key), 10);
        return Number.isFinite(val) ? val : null;
    } catch (err) {
        return null;
    }
}

let state = Array.isArray(safeReadJSON(SCORE_KEY, [])) ? safeReadJSON(SCORE_KEY, []) : [];
let playerNames = (() => {
    const saved = safeReadJSON(NAME_KEY, null);
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_NAMES };
    return {
        p1: typeof saved.p1 === 'string' && saved.p1.trim() ? saved.p1 : 'P1',
        p2: typeof saved.p2 === 'string' && saved.p2.trim() ? saved.p2 : 'P2',
        p3: typeof saved.p3 === 'string' && saved.p3.trim() ? saved.p3 : 'P3',
        p4: typeof saved.p4 === 'string' && saved.p4.trim() ? saved.p4 : 'P4',
    };
})();
let history = Array.isArray(safeReadJSON(HISTORY_KEY, [])) ? safeReadJSON(HISTORY_KEY, []) : [];
let matchStartTime = safeReadInt(MATCH_START_KEY);
let matchEndTime = safeReadInt(MATCH_END_KEY);

// --- Rounds (state) ---
export function getRounds() {
    return state;
}

export function setRounds(newRounds) {
    state = Array.isArray(newRounds) ? newRounds : [];
    safeWrite(SCORE_KEY, JSON.stringify(state));
}

export function saveRounds() {
    safeWrite(SCORE_KEY, JSON.stringify(state));
}

export function addRound(round) {
    state.push(round);
    saveRounds();
}

export function deleteRound(index) {
    if (index >= 0 && index < state.length) {
        state.splice(index, 1);
        saveRounds();
    }
}

export function clearRound(index) {
    if (index >= 0 && index < state.length) {
        players.forEach(p => {
            state[index][p] = '';
        });
        saveRounds();
    }
}

// --- Player names ---
export function getPlayerNames() {
    return playerNames;
}

export function setPlayerName(key, value) {
    const clean = typeof value === 'string' ? value.trim() : '';
    playerNames[key] = clean || key.toUpperCase();
    safeWrite(NAME_KEY, JSON.stringify(playerNames));
}

export function setAllPlayerNames(newNames) {
    playerNames = {
        p1: (newNames && typeof newNames.p1 === 'string' && newNames.p1.trim()) ? newNames.p1.trim().slice(0, 16) : 'P1',
        p2: (newNames && typeof newNames.p2 === 'string' && newNames.p2.trim()) ? newNames.p2.trim().slice(0, 16) : 'P2',
        p3: (newNames && typeof newNames.p3 === 'string' && newNames.p3.trim()) ? newNames.p3.trim().slice(0, 16) : 'P3',
        p4: (newNames && typeof newNames.p4 === 'string' && newNames.p4.trim()) ? newNames.p4.trim().slice(0, 16) : 'P4',
    };
    safeWrite(NAME_KEY, JSON.stringify(playerNames));
}

// --- History ---
export function getHistory() {
    return history;
}

export function addHistoryEntry(entry) {
    history.push(entry);
    safeWrite(HISTORY_KEY, JSON.stringify(history));
}

export function setAllHistory(newHistory) {
    history = Array.isArray(newHistory) ? newHistory : [];
    safeWrite(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
    history = [];
    safeWrite(HISTORY_KEY, JSON.stringify(history));
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
    safeWrite(MATCH_START_KEY, String(matchStartTime));
    safeRemove(MATCH_END_KEY);
}

export function markMatchEnd() {
    if (!matchEndTime) {
        matchEndTime = Date.now();
        safeWrite(MATCH_END_KEY, String(matchEndTime));
    }
}

export function clearMatchEnd() {
    if (matchEndTime !== null) {
        matchEndTime = null;
        safeRemove(MATCH_END_KEY);
    }
}

export function clearMatchTiming() {
    matchStartTime = null;
    matchEndTime = null;
    safeRemove(MATCH_START_KEY);
    safeRemove(MATCH_END_KEY);
}

export function setMatchTiming(startTime, endTime) {
    matchStartTime = startTime;
    matchEndTime = endTime;
    if (matchStartTime) {
        safeWrite(MATCH_START_KEY, String(matchStartTime));
    } else {
        safeRemove(MATCH_START_KEY);
    }
    if (matchEndTime) {
        safeWrite(MATCH_END_KEY, String(matchEndTime));
    } else {
        safeRemove(MATCH_END_KEY);
    }
}

// --- Full reset ---
export function resetMatchOnly() {
    state = [];
    saveRounds();
}
