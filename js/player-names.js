/**
 * player-names.js
 * ===============
 * Input nama pemain di header tabel. Ganti nama langsung ke-refresh di footer
 * (misal winner banner lagi nampilin nama pemenang).
 */

import { getPlayerNames, setPlayerName } from './store.js';
import { renderFooter } from './render.js';

document.querySelectorAll('.name-input').forEach(input => {
    const playerKey = input.getAttribute('data-player');
    input.value = getPlayerNames()[playerKey];

    input.addEventListener('input', (e) => {
        setPlayerName(playerKey, e.target.value);
        renderFooter();
    });
});

/** Dipakai backup.js buat sinkronin ulang value input setelah import data. */
export function refreshNameInputs() {
    const playerNames = getPlayerNames();
    document.querySelectorAll('.name-input').forEach(input => {
        const key = input.getAttribute('data-player');
        input.value = playerNames[key] || key.toUpperCase();
    });
}
