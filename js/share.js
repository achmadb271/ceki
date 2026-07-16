/**
 * share.js
 * ========
 * Share hasil pertandingan sebagai gambar PNG.
 *
 * DIGANTI dari html2canvas ke html-to-image. html2canvas MEREKONSTRUKSI
 * tampilan dari nol pakai perintah gambar canvas manual - itu sebabnya font
 * suka salah render (huruf/angka jadi karakter aneh kayak yang dilaporin).
 * html-to-image kerja beda: DOM aslinya dibungkus ke SVG <foreignObject>,
 * terus BROWSER SENDIRI yang gambar - jadi hasilnya beneran akurat kayak
 * screenshot asli, bukan reka ulang tampilan.
 *
 * Capture-nya sekarang ambil LANGSUNG element popup asli (#win-modal-content),
 * bukan bikin kartu duplikat kayak sebelumnya. Jadi gambar hasil share
 * OTOMATIS 100% sama kayak popup - gak ada risiko dua desain kebeda-bedaan
 * lagi. Tombol "Simpan" & "Share" disembunyiin sesaat pas proses capture,
 * abis itu balik ditampilin lagi.
 */

import { showAppToast } from './toast.js';

export async function shareResultAsImage() {
    const shareBtn = document.getElementById('btn-share-image');
    const saveBtn = document.getElementById('btn-save-history');
    const captureTarget = document.getElementById('win-modal-content');
    const originalLabel = shareBtn.textContent;

    shareBtn.disabled = true;
    shareBtn.textContent = 'Menyiapkan gambar...';
    const prevShareDisplay = shareBtn.style.display;
    const prevSaveDisplay = saveBtn.style.display;
    shareBtn.style.display = 'none';
    saveBtn.style.display = 'none';

    try {
        const blob = await htmlToImage.toBlob(captureTarget, { pixelRatio: 2 });
        if (!blob) throw new Error('Gagal generate blob gambar');

        const file = new File([blob], 'hasil-ceki.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Hasil Ceki', text: 'Hasil pertandingan Ceki' });
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
        shareBtn.disabled = false;
        shareBtn.textContent = originalLabel;
        shareBtn.style.display = prevShareDisplay;
        saveBtn.style.display = prevSaveDisplay;
    }
}

function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hasil-ceki.png';
    a.click();
    URL.revokeObjectURL(url);
}
