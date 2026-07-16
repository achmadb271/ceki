/**
 * backup.js
 * =========
 * Export & import data (ronde aktif, nama pemain, riwayat) sebagai file JSON.
 */

import { exportSnapshot, isValidBackup, importSnapshot, getMatchStartTime, getMatchEndTime } from './store.js';
import { showAppToast, showConfirmModal } from './toast.js';
import { renderTable, renderFooter } from './render.js';
import { refreshNameInputs } from './player-names.js';
import { resetUndoStack } from './undo.js';
import { resetBurnAnnouncer } from './burn-announcer.js';
import { startMatchTimer, stopMatchTimer, updateTimerDisplay } from './timer.js';
import { closeHistoryModal } from './history-modal.js';

const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file-input');

function exportData() {
    const backup = exportSnapshot();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `ceki-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            showAppToast('⚠️ Gagal import: file bukan JSON yang valid.', 'error');
            return;
        }
        if (!isValidBackup(data)) {
            showAppToast('⚠️ Gagal import: format file tidak sesuai backup Score Tracker 1000.', 'error');
            return;
        }

        showConfirmModal('Import akan MENIMPA data ronde, nama pemain, dan riwayat yang ada sekarang. Lanjut?', () => {
            importSnapshot(data);
            refreshNameInputs();
            resetUndoStack();
            resetBurnAnnouncer();

            if (getMatchEndTime()) {
                stopMatchTimer();
                updateTimerDisplay();
            } else if (getMatchStartTime()) {
                startMatchTimer();
            } else {
                updateTimerDisplay();
            }

            renderTable();
            renderFooter();
            closeHistoryModal();
            showAppToast('✅ Data berhasil di-import!', 'success');
        });
    };
    reader.readAsText(file);
}

btnExportData.addEventListener('click', exportData);
btnImportData.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importDataFromFile(file);
    importFileInput.value = '';
});
