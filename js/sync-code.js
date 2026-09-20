/**
 * sync-code.js
 * ============
 * Pindahin progress match antar-HP pake kode/QR (bukan sinkron real-time -
 * app ini gak punya server/database di belakangnya, semuanya cuma jalan di
 * localStorage HP masing-masing). Alurnya: HP A generate kode+QR dari state
 * sekarang, HP B scan QR-nya (atau tempel kodenya manual) buat numpuk timpa
 * state lokalnya sendiri.
 *
 * Kode-nya cuma JSON {rounds, playerNames, matchStartTime} yang di-base64.
 * SENGAJA gak termasuk riwayat (history) - fitur ini buat nerusin MATCH YANG
 * LAGI JALAN doang, bukan backup penuh.
 */

import { getRounds, setRounds, getPlayerNames, setAllPlayerNames, getMatchStartTime, setMatchTiming, clearMatchTiming } from './store.js';
import { renderTable, renderFooter } from './render.js';
import { refreshNameInputs } from './player-names.js';
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
const qrCodeCanvas = document.getElementById('qr-code-canvas');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnShareCode = document.getElementById('btn-share-code');
const importCodeInput = document.getElementById('import-code-input');
const btnImportCode = document.getElementById('btn-import-code');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCancelScan = document.getElementById('btn-cancel-scan');
const qrScannerBox = document.getElementById('qr-scanner-box');

let qrCodeInstance = null;   // instance qrcodejs yang lagi kepasang di qr-code-canvas
let html5QrCode = null;      // instance html5-qrcode (scanner kamera) yang lagi aktif

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
    refreshNameInputs();
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

/** Dipakai bareng baik dari hasil scan QR maupun dari tempel manual. */
function syncFromCode(raw) {
    if (!raw || !raw.trim()) {
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
}

// --- Scanner kamera ---
function startScanner() {
    qrScannerBox.classList.remove('hidden');
    html5QrCode = new Html5Qrcode('qr-reader');
    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
            stopScanner();
            syncFromCode(decodedText);
        },
        () => {
            // gagal scan 1 frame itu normal banget (kamera belum pas ke QR-nya) - diemin aja
        }
    ).catch((err) => {
        qrScannerBox.classList.add('hidden');
        showAppToast('⚠️ Gagal buka kamera. Pastiin izin kamera diizinin, atau tempel kode manual aja.', 'error');
    });
}

function stopScanner() {
    qrScannerBox.classList.add('hidden');
    if (html5QrCode) {
        html5QrCode.stop().catch(() => { }).finally(() => {
            html5QrCode.clear();
            html5QrCode = null;
        });
    }
}

function openSyncModal() {
    generatedCodeBox.classList.add('hidden');
    importCodeInput.value = '';
    syncModal.classList.remove('hidden');
}

function closeSyncModal() {
    syncModal.classList.add('hidden');
    stopScanner(); // jangan biarin kamera nyala di background pas modal ditutup
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
    const code = generateCode();
    generatedCodeText.value = code;

    qrCodeCanvas.innerHTML = ''; // bersihin QR sebelumnya biar gak numpuk
    qrCodeInstance = new QRCode(qrCodeCanvas, {
        text: code,
        width: 200,
        height: 200,
        correctLevel: QRCode.CorrectLevel.M,
    });

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

btnOpenScanner.addEventListener('click', startScanner);
btnCancelScan.addEventListener('click', stopScanner);

btnImportCode.addEventListener('click', () => {
    syncFromCode(importCodeInput.value.trim());
});
