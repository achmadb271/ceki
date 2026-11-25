/**
 * player-names.js
 * ===============
 * Input nama pemain di header tabel.
 *   - Tap/klik nama langsung men-select seluruh teks (tinggal ketik nama baru).
 *   - Enter untuk selesai, nama kosong otomatis kembali ke default (P1..P4).
 */

import { getPlayerNames, setPlayerName } from './store.js';
import { renderFooter } from './render.js';

document.querySelectorAll('.name-input').forEach(input => {
    const playerKey = input.getAttribute('data-player');
    input.value = getPlayerNames()[playerKey];

    let justFocused = false;

    input.addEventListener('focus', () => {
        justFocused = true;
        input.select();
        // iOS Safari kadang mengabaikan select() langsung saat focus
        setTimeout(() => input.select(), 0);
    });

    // Cegah klik mouse pertama membatalkan seleksi (desktop)
    input.addEventListener('mouseup', (e) => {
        if (justFocused) {
            e.preventDefault();
            justFocused = false;
        }
    });

    input.addEventListener('input', (e) => {
        setPlayerName(playerKey, e.target.value);
        renderFooter(true);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    });

    input.addEventListener('blur', () => {
        justFocused = false;
        input.value = getPlayerNames()[playerKey];
    });
});

/** Dipakai buat sinkronin ulang value input nama setelah import data / sync kode. */
export function refreshNameInputs() {
    const playerNames = getPlayerNames();
    document.querySelectorAll('.name-input').forEach(input => {
        const key = input.getAttribute('data-player');
        input.value = playerNames[key] || key.toUpperCase();
    });
}
