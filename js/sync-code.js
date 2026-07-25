/**
 * sync-code.js
 * ============
 * Pindahin progress match antar-HP pake kode (bukan sinkron real-time -
 * app ini gak punya server/database di belakangnya, semuanya cuma jalan di
 * localStorage HP masing-masing). Alurnya: HP A generate kode dari state
 * sekarang, kode itu di-copy/share manual ke HP B, HP B masukin kodenya buat
 * numpuk timpa state lokalnya sendiri.
 *
 * Kode-nya cuma JSON {rounds, playerNames, matchStartTime} yang di-base64.
 * SENGAJA gak termasuk riwayat (history) - fitur ini buat nerusin MATCH YANG
 * LAGI JALAN doang, bukan backup penuh.
 */

import { getRounds, setRounds, getPlayerNames, setAllPlayerNames, getMatchStartTime, setMatchTiming, clearMatchTiming } from './store.js';
import { renderTable, renderFooter } from './render.js';
import { resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { startMatchTimer, stopMatchTimer, updateTimerDisplay } from './timer.js';
import { showAppToast, showConfirmModal } from './toast.js';

const CODE_FORMAT_VERSION = 1;

const btnOpenSync = document.getElementById('btn-open-sync');
const syncModal = document.getElementById('sync-modal');
const btnCloseSync = document.getElementById('btn-close-sync');
const btnGenerateCode = document.getElementById('btn-generate-code');
const generatedCodeBox = document.getElementById('generated-code-box');
const generatedCodeText = document.getElementById('generated-code-text');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnShareCode = document.getElementById('btn-share-code');
const importCodeInput = document.getElementById('import-code-input');
const btnImportCode = document.getElementById('btn-import-code');

// --- Encode/decode UTF-8-safe base64 (biar nama pemain apapun karakternya aman) ---
function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function generateCode() {
    const payload = {
        v: CODE_FORMAT_VERSION,
        rounds: getRounds(),
        playerNames: getPlayerNames(),
        matchStartTime: getMatchStartTime(),
    };
    return toBase64(JSON.stringify(payload));
}

function parseCode(code) {
    let payload;
    try {
        payload = JSON.parse(fromBase64(code.trim()));
    } catch (err) {
        throw new Error('Format kode gak valid.');
    }
    if (!payload || !Array.isArray(payload.rounds) || typeof payload.playerNames !== 'object') {
        throw new Error('Format kode gak valid.');
    }
    return payload;
}

function applyPayload(payload) {
    setRounds(payload.rounds);
    setAllPlayerNames(payload.playerNames);
    resetUndoStack();
    resetBurnAnnouncer();
    clearActiveInput();

    if (payload.rounds.length === 0) {
        clearMatchTiming();
        stopMatchTimer();
        updateTimerDisplay();
    } else {
        setMatchTiming(payload.matchStartTime || Date.now(), null);
        startMatchTimer();
    }

    renderTable();
    renderFooter();
}

function openSyncModal() {
    generatedCodeBox.classList.add('hidden');
    importCodeInput.value = '';
    syncModal.classList.remove('hidden');
}

function closeSyncModal() {
    syncModal.classList.add('hidden');
}

btnOpenSync.addEventListener('click', openSyncModal);
btnCloseSync.addEventListener('click', closeSyncModal);
syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) closeSyncModal();
});

btnGenerateCode.addEventListener('click', () => {
    if (getRounds().length === 0) {
        showAppToast('Belum ada progress buat di-generate kodenya.', 'info');
        return;
    }
    generatedCodeText.value = generateCode();
    generatedCodeBox.classList.remove('hidden');
});

btnCopyCode.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(generatedCodeText.value);
        showAppToast('📋 Kode disalin!', 'success');
    } catch (err) {
        generatedCodeText.select();
        showAppToast('Gagal nyalin otomatis, coba select manual & copy.', 'error');
    }
});

btnShareCode.addEventListener('click', async () => {
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Kode Progress Ceki', text: generatedCodeText.value });
        } catch (err) {
            // user batalin share, gapapa
        }
    } else {
        btnCopyCode.click();
    }
});

btnImportCode.addEventListener('click', () => {
    const raw = importCodeInput.value.trim();
    if (!raw) {
        showAppToast('Kodenya belum diisi.', 'info');
        return;
    }

    let payload;
    try {
        payload = parseCode(raw);
    } catch (err) {
        showAppToast('⚠️ ' + err.message, 'error');
        return;
    }

    showConfirmModal('Ini bakal NIMPA progress yang lagi jalan di HP ini sama data dari kode. Lanjut?', () => {
        applyPayload(payload);
        closeSyncModal();
        showAppToast('✅ Progress berhasil disinkronkan!', 'success');
    });
});
