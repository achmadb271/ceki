/**
 * share.js
 * ========
 * Share hasil pertandingan sebagai gambar PNG (html2canvas).
 *
 * Layout kartu ini SENGAJA disamain sama popup menang (win-modal.js) -
 * judul + pill "Skor Terendah" + grid 2 kolom per pemain - biar orang yang
 * udah lihat popupnya gak kaget pas share gambarnya beda desain.
 *
 * Bedanya cuma satu: popup boleh pakai emoji beneran (trophy) karena itu DOM
 * hidup di browser. Kartu di sini di-capture html2canvas, dan emoji suka
 * gagal render ("tofu"/kotak putih) tergantung device - makanya semua ikon
 * di kartu ini pakai inline SVG / teks polos, bukan emoji.
 */

import { players, getPlayerNames } from './store.js';
import { showAppToast } from './toast.js';

const TROPHY_SVG = `
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-6px; margin-right:6px;">
  <path d="M6 3H18V6C18 9.31371 15.3137 12 12 12C8.68629 12 6 9.31371 6 6V3Z" fill="#4ade80"/>
  <path d="M6 4H3V6C3 7.65685 4.34315 9 6 9" stroke="#4ade80" stroke-width="1.6" fill="none"/>
  <path d="M18 4H21V6C21 7.65685 19.6569 9 18 9" stroke="#4ade80" stroke-width="1.6" fill="none"/>
  <rect x="10.5" y="12" width="3" height="4" fill="#4ade80"/>
  <path d="M8 20H16L15 16H9L8 20Z" fill="#4ade80"/>
</svg>`;

function playerCard(p, { playerNames, winners, losers, totals, burnCounts }) {
    const isWinner = winners.includes(p);
    const isLoser = losers.includes(p);
    const scoreColor = isWinner ? '#4ade80' : (isLoser ? '#f87171' : '#e2e8f0');
    const burnCount = burnCounts[p] || 0;

    return `
    <div style="background:rgba(15,23,42,0.5); border:1px solid #334155; border-radius:12px; padding:12px; text-align:center;">
      <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${playerNames[p]}</div>
      <div style="font-size:22px; font-weight:800; color:${scoreColor};">${totals[p]}</div>
      ${burnCount > 0 ? `<div style="font-size:10px; color:#fb923c; font-weight:700; margin-top:3px;">Kebakar ${burnCount}&times;</div>` : ''}
    </div>
  `;
}

export async function shareResultAsImage(result) {
    const shareBtn = document.getElementById('btn-share-image');
    const originalLabel = shareBtn ? shareBtn.textContent : '';
    if (shareBtn) {
        shareBtn.disabled = true;
        shareBtn.textContent = 'Menyiapkan gambar...';
    }

    const playerNames = getPlayerNames();
    const { winners, losers, minScore, totals, durationText, burnCounts } = result;
    const winnerDisplay = winners.map(w => playerNames[w]).join(' & ');
    const loserDisplay = losers.map(l => playerNames[l]).join(' & ');

    const card = document.createElement('div');
    card.style.cssText = 'position:fixed; left:-9999px; top:0; width:380px; padding:28px; background:linear-gradient(135deg,#0f172a,#1e293b); font-family: sans-serif; color:white; border-radius:20px;';
    card.innerHTML = `
    <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:14px;">${new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    <div style="text-align:center; font-size:26px; font-weight:900; color:#4ade80; margin-bottom:10px;">${TROPHY_SVG}${winnerDisplay} Menang!</div>
    <div style="text-align:center; margin-bottom:10px;">
      <span style="display:inline-block; font-size:13px; background:rgba(21,128,61,0.4); color:#fff; padding:6px 16px; border-radius:999px; border:1px solid #16a34a;">
        Skor Terendah: <span style="color:#fca5a5; font-weight:700;">${loserDisplay} (${minScore})</span>
      </span>
    </div>
    <div style="text-align:center; font-size:11px; color:#64748b; font-family: monospace; margin-bottom:20px;">Durasi Pertandingan: ${durationText}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      ${players.map(p => playerCard(p, { playerNames, winners, losers, totals, burnCounts })).join('')}
    </div>
    <div style="text-align:center; margin-top:18px; font-size:11px; color:#475569;">Score Tracker 1000</div>
  `;
    document.body.appendChild(card);

    try {
        const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 });
        await new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
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
                resolve();
            });
        });
    } catch (err) {
        showAppToast('⚠️ Gagal bikin gambar. Coba lagi ya.', 'error');
    } finally {
        card.remove();
        if (shareBtn) {
            shareBtn.disabled = false;
            shareBtn.textContent = originalLabel;
        }
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
