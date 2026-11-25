/**
 * sync-code.js
 * ============
 * Transfer progress match antar-HP lewat Kode Base64 & QR Code.
 * Mendukung format v2 yang padat (array ringkas agar QR lebih mudah di-scan
 * pada match panjang) sekaligus backward-compatible membaca kode v1 lama.
 */

import { getRounds, setRounds, getPlayerNames, setAllPlayerNames, getMatchStartTime, setMatchTiming, clearMatchTiming, players } from './store.js';
import { calculateTotals, WIN_SCORE } from './scoring.js';
import { renderTable, renderFooter, resetGameOverDismissed } from './render.js';
import { refreshNameInputs } from './player-names.js';
import { resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { clearActiveInput } from './keypad.js';
import { startMatchTimer, stopMatchTimer, updateTimerDisplay } from './timer.js';
import { showAppToast, showConfirmModal } from './toast.js';

const CODE_FORMAT_VERSION = 2;
const MAX_SYNC_ROUNDS = 200;

const btnOpenSync = document.getElementById('btn-open-sync');
const syncModal = document.getElementById('sync-modal');
const btnCloseSync = document.getElementById('btn-close-sync');
const btnGenerateCode = document.getElementById('btn-generate-code');
const generatedCodeBox = document.getElementById('generated-code-box');
const generatedCodeText = document.getElementById('generated-code-text');
const qrFrameBox = document.getElementById('qr-frame-box');
const qrCodeCanvas = document.getElementById('qr-code-canvas');
const qrHintText = document.getElementById('qr-hint-text');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnShareCode = document.getElementById('btn-share-code');
const importCodeInput = document.getElementById('import-code-input');
const btnImportCode = document.getElementById('btn-import-code');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCancelScan = document.getElementById('btn-cancel-scan');
const qrScannerBox = document.getElementById('qr-scanner-box');

let html5QrCode = null;

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

function sanitizeScoreCell(val) {
    if (val === '' || val === null || val === undefined) return '';
    const n = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (!Number.isFinite(n) || n < -99999 || n > 99999) {
        throw new Error('Nilai skor pada kode tidak valid.');
    }
    return Math.trunc(n);
}

function generateCode() {
    const names = getPlayerNames();
    const compactRounds = getRounds().map(row =>
        players.map(p => (row[p] === '' || row[p] === undefined || row[p] === null ? '' : Number(row[p])))
    );
    const payload = {
        v: CODE_FORMAT_VERSION,
        n: players.map(p => names[p] || p.toUpperCase()),
        r: compactRounds,
        t: getMatchStartTime() || null,
    };
    return toBase64(JSON.stringify(payload));
}

function parseCode(code) {
    let raw;
    try {
        raw = JSON.parse(fromBase64(code.trim()));
    } catch (err) {
        throw new Error('Format kode tidak valid.');
    }

    if (!raw || typeof raw !== 'object') {
        throw new Error('Format kode tidak valid.');
    }

    // Format v2 (compact)
    if (raw.v === 2 && Array.isArray(raw.r) && Array.isArray(raw.n)) {
        if (raw.r.length > MAX_SYNC_ROUNDS) {
            throw new Error('Jumlah ronde melebihi batas maksimum.');
        }
        const playerNames = {
            p1: typeof raw.n[0] === 'string' && raw.n[0].trim() ? raw.n[0].trim().slice(0, 16) : 'P1',
            p2: typeof raw.n[1] === 'string' && raw.n[1].trim() ? raw.n[1].trim().slice(0, 16) : 'P2',
            p3: typeof raw.n[2] === 'string' && raw.n[2].trim() ? raw.n[2].trim().slice(0, 16) : 'P3',
            p4: typeof raw.n[3] === 'string' && raw.n[3].trim() ? raw.n[3].trim().slice(0, 16) : 'P4',
        };
        const rounds = raw.r.map(tuple => {
            if (!Array.isArray(tuple) || tuple.length < 4) {
                throw new Error('Data ronde pada kode rusak.');
            }
            return {
                p1: sanitizeScoreCell(tuple[0]),
                p2: sanitizeScoreCell(tuple[1]),
                p3: sanitizeScoreCell(tuple[2]),
                p4: sanitizeScoreCell(tuple[3]),
            };
        });
        const matchStartTime = Number.isFinite(raw.t) ? raw.t : null;
        return { rounds, playerNames, matchStartTime };
    }

    // Format v1 (legacy)
    if (Array.isArray(raw.rounds) && raw.playerNames && typeof raw.playerNames === 'object') {
        if (raw.rounds.length > MAX_SYNC_ROUNDS) {
            throw new Error('Jumlah ronde melebihi batas maksimum.');
        }
        const playerNames = {
            p1: typeof raw.playerNames.p1 === 'string' && raw.playerNames.p1.trim() ? raw.playerNames.p1.trim().slice(0, 16) : 'P1',
            p2: typeof raw.playerNames.p2 === 'string' && raw.playerNames.p2.trim() ? raw.playerNames.p2.trim().slice(0, 16) : 'P2',
            p3: typeof raw.playerNames.p3 === 'string' && raw.playerNames.p3.trim() ? raw.playerNames.p3.trim().slice(0, 16) : 'P3',
            p4: typeof raw.playerNames.p4 === 'string' && raw.playerNames.p4.trim() ? raw.playerNames.p4.trim().slice(0, 16) : 'P4',
        };
        const rounds = raw.rounds.map(row => {
            if (!row || typeof row !== 'object') throw new Error('Data ronde tidak valid.');
            return {
                p1: sanitizeScoreCell(row.p1),
                p2: sanitizeScoreCell(row.p2),
                p3: sanitizeScoreCell(row.p3),
                p4: sanitizeScoreCell(row.p4),
            };
        });
        const matchStartTime = Number.isFinite(raw.matchStartTime) ? raw.matchStartTime : null;
        return { rounds, playerNames, matchStartTime };
    }

    throw new Error('Format kode tidak dikenali.');
}

function applyPayload(payload) {
    setRounds(payload.rounds);
    setAllPlayerNames(payload.playerNames);
    refreshNameInputs();
    resetUndoStack();
    resetBurnAnnouncer();
    resetGameOverDismissed();
    clearActiveInput();

    if (payload.rounds.length === 0) {
        clearMatchTiming();
        stopMatchTimer();
        updateTimerDisplay();
    } else {
        const { totals } = calculateTotals(payload.rounds);
        const lastRow = payload.rounds[payload.rounds.length - 1];
        const isFinished = players.every(p => lastRow[p] !== '') && players.some(p => totals[p] >= WIN_SCORE);
        const startTs = payload.matchStartTime || Date.now();
        if (isFinished) {
            setMatchTiming(startTs, Date.now());
            stopMatchTimer();
            updateTimerDisplay();
        } else {
            setMatchTiming(startTs, null);
            startMatchTimer();
        }
    }

    renderTable();
    renderFooter();
}

function syncFromCode(raw) {
    if (!raw || !raw.trim()) {
        showAppToast('Kodenya belum diisi.', 'info');
        return;
    }

    let payload;
    try {
        payload = parseCode(raw);
    } catch (err) {
        showAppToast(err.message, 'error');
        return;
    }

    showConfirmModal('Data ini akan menimpa progress yang sedang berjalan di HP ini. Lanjut?', () => {
        applyPayload(payload);
        closeSyncModal();
        showAppToast('Progress berhasil disinkronkan!', 'success');
    });
}

function startScanner() {
    if (typeof Html5Qrcode === 'undefined') {
        showAppToast('Library scanner QR tidak tersedia saat offline. Tempel kode manual saja.', 'info');
        return;
    }
    qrScannerBox.classList.remove('hidden');
    html5QrCode = new Html5Qrcode('qr-reader');

    const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxSize = Math.max(180, Math.floor(minEdge * 0.8));
        return { width: boxSize, height: boxSize };
    };

    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: qrboxFunction },
        (decodedText) => {
            stopScanner();
            syncFromCode(decodedText);
        },
        () => {}
    ).catch(() => {
        qrScannerBox.classList.add('hidden');
        showAppToast('Gagal membuka kamera. Pastikan izin kamera aktif atau tempel kode manual.', 'error');
    });
}

function stopScanner() {
    qrScannerBox.classList.add('hidden');
    if (html5QrCode) {
        html5QrCode.stop().catch(() => {}).finally(() => {
            try { html5QrCode.clear(); } catch (e) {}
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
    stopScanner();
}

if (btnOpenSync) btnOpenSync.addEventListener('click', openSyncModal);
if (btnCloseSync) btnCloseSync.addEventListener('click', closeSyncModal);
if (syncModal) {
    syncModal.addEventListener('click', (e) => {
        if (e.target === syncModal) closeSyncModal();
    });
}

if (btnGenerateCode) {
    btnGenerateCode.addEventListener('click', () => {
        if (getRounds().length === 0) {
            showAppToast('Belum ada progress untuk di-generate.', 'info');
            return;
        }
        const code = generateCode();
        generatedCodeText.value = code;
        generatedCodeBox.classList.remove('hidden');
        qrCodeCanvas.innerHTML = '';

        if (typeof QRCode === 'undefined') {
            if (qrFrameBox) qrFrameBox.classList.add('hidden');
            showAppToast('QR offline tidak tersedia — salin atau bagikan kode teks di bawah.', 'info');
            return;
        }

        if (qrFrameBox) qrFrameBox.classList.remove('hidden');
        const modalCard = syncModal.querySelector('.modal-card');
        const cardWidth = modalCard ? modalCard.clientWidth : window.innerWidth;
        const qrSize = Math.min(260, Math.max(200, cardWidth - 76));

        try {
            new QRCode(qrCodeCanvas, {
                text: code,
                width: qrSize,
                height: qrSize,
                correctLevel: QRCode.CorrectLevel.L,
            });
            if (qrHintText) qrHintText.textContent = 'Arahkan kamera HP pengganti ke QR ini';
        } catch (err) {
            qrCodeCanvas.innerHTML = '';
            if (qrHintText) qrHintText.textContent = 'Match terlalu panjang untuk QR. Salin & kirim kode teks di bawah.';
            showAppToast('Data terlalu besar untuk QR. Gunakan tombol Salin/Bagikan kode teks.', 'info');
        }
    });
}

if (btnCopyCode) {
    btnCopyCode.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(generatedCodeText.value);
            showAppToast('Kode berhasil disalin!', 'success');
        } catch (err) {
            generatedCodeText.select();
            showAppToast('Gagal menyalin otomatis, silakan copy manual.', 'error');
        }
    });
}

if (btnShareCode) {
    btnShareCode.addEventListener('click', async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Kode Progress Ceki', text: generatedCodeText.value });
            } catch (err) {}
        } else {
            btnCopyCode.click();
        }
    });
}

if (btnOpenScanner) btnOpenScanner.addEventListener('click', startScanner);
if (btnCancelScan) btnCancelScan.addEventListener('click', stopScanner);
if (btnImportCode) {
    btnImportCode.addEventListener('click', () => {
        syncFromCode(importCodeInput.value.trim());
    });
}
