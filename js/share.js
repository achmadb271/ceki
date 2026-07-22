/**
 * share.js
 * ========
 * Share hasil pertandingan sebagai gambar PNG - dipakai baik buat hasil
 * akhir (popup menang) maupun skor sementara (match yang belum kelar).
 *
 * Pakai html-to-image (bukan html2canvas). html2canvas MEREKONSTRUKSI
 * tampilan dari nol pakai perintah gambar canvas manual - itu sebabnya font
 * suka salah render (huruf/angka jadi karakter aneh kayak yang dilaporin).
 * html-to-image kerja beda: DOM aslinya dibungkus ke SVG <foreignObject>,
 * terus BROWSER SENDIRI yang gambar - jadi hasilnya beneran akurat kayak
 * screenshot asli, bukan reka ulang tampilan.
 *
 * `captureAndShare` generic - capture LANGSUNG element popup asli (bukan
 * bikin kartu duplikat), jadi gambar hasil share OTOMATIS 100% sama kayak
 * yang keliatan di layar. `hideElementIds[0]` dianggap tombol pemicu (dapet
 * perubahan label "Menyiapkan gambar..."), SEMUA id di situ disembunyiin
 * sesaat pas capture biar gak ikut kefoto, abis itu balik ditampilin lagi.
 */

import { showAppToast } from './toast.js';

export async function captureAndShare(captureTargetId, hideElementIds) {
    const captureTarget = document.getElementById(captureTargetId);
    const triggerBtn = document.getElementById(hideElementIds[0]);
    const originalLabel = triggerBtn ? triggerBtn.textContent : '';

    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'Menyiapkan gambar...';
    }

    const hideElements = hideElementIds.map(id => document.getElementById(id)).filter(Boolean);
    const prevDisplays = hideElements.map(el => el.style.display);
    hideElements.forEach(el => { el.style.display = 'none'; });

    try {
        const blob = await htmlToImage.toBlob(captureTarget, { pixelRatio: 2 });
        if (!blob) throw new Error('Gagal generate blob gambar');

        const file = new File([blob], 'hasil-ceki.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Hasil Ceki', text: 'No Ceki No Life' });
            } catch (err) {
                // user membatalkan share, gapapa
            }
        } else if (navigator.clipboard && window.ClipboardItem) {
            // Fallback desktop: coba salin ke clipboard dulu, biar bisa langsung di-paste ke chat
            try {
                await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                showAppToast('📋 Gambar disalin ke clipboard!', 'success');
            } catch (err) {
                downloadBlob(blob);
            }
        } else {
            downloadBlob(blob);
        }
    } catch (err) {
        showAppToast('⚠️ Gagal bikin gambar. Coba lagi ya.', 'error');
    } finally {
        hideElements.forEach((el, i) => { el.style.display = prevDisplays[i]; });
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.textContent = originalLabel;
        }
    }
}

export function shareResultAsImage() {
    return captureAndShare('win-modal-content', ['btn-share-image', 'btn-save-history']);
}

export function shareProgressAsImage() {
    return captureAndShare('progress-modal-content', ['btn-share-progress-image', 'btn-close-progress']);
}

function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hasil-ceki.png';
    a.click();
    URL.revokeObjectURL(url);
}
