/**
 * undo.js
 * =======
 * Undo stack in-memory (gak di-persist ke localStorage), reset kalau reload halaman.
 * 1 snapshot per kolom yang MULAI diedit, bukan per digit yang diketik.
 */

import { getRounds, setRounds } from './store.js';

const MAX_UNDO = 50;
let undoStack = [];
const btnUndo = document.getElementById('btn-undo');

function updateUndoButton() {
    btnUndo.disabled = undoStack.length === 0;
}

export function pushUndo() {
    undoStack.push(JSON.stringify(getRounds()));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoButton();
}

export function resetUndoStack() {
    undoStack = [];
    updateUndoButton();
}

/** Balikin true kalau ada state yang di-restore (dan langsung diterapkan ke store). */
export function popUndo() {
    if (undoStack.length === 0) return false;
    setRounds(JSON.parse(undoStack.pop()));
    updateUndoButton();
    return true;
}

updateUndoButton();
