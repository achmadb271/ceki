# 🎴 Score Tracker 1000 - Ceki

Aplikasi web pencatat skor modern untuk permainan kartu **Ceki (4 pemain)** berbasis **Progressive Web App (PWA)** yang ringan, 100% offline-ready, dan dioptimalkan khusus untuk kenyamanan layar ponsel pintar (mobile-first).

---

## 📜 Aturan Main & Sistem Scoring Ceki

Aplikasi ini mengadopsi aturan standar permainan Ceki tongkrongan dengan perhitungan otomatis dan transparan:

### 1. Target Kemenangan

- Pertandingan berakhir jika salah satu atau beberapa pemain berhasil mencapai total skor **$\ge 1000$ poin** di ronde yang telah selesai dihitung.

### 2. Sistem Kebakar (Gosong)

- **Ambang Kebakar**: Pemain baru bisa terbakar jika total skornya sebelum ronde tersebut sudah mencapai minimal **100 poin** (`BURN_THRESHOLD = 100`). Di bawah 100 poin, posisi masih aman/wajar disalip.
- **Syarat Menyalip yang Sah**:
  1. Penantang sebelumnya berada di bawah skor korban.
  2. Total akhir penantang setelah ronde tersebut lebih tinggi ($>$) dari skor korban (seri tidak membakar).
  3. Poin yang didapat penantang pada ronde tersebut harus **positif ($> 0$)** — jika penantang $+0$ dan lawan turun karena minus sendiri (_jatuh sendiri_), lawan **tidak kebakar**.
- **Safezone ($0 \le \text{skor} < 100$)**:
  - Pemain dengan skor $\ge 100$ yang mengalami penurunan ke zona aman ($0$ s.d. $99$) terlindungi dari kebakar, selama tidak ada lawan yang melampaui skor lama pemain tersebut.
- **Hukuman Kebakar (Penalti Minus Tetap Masuk)**:
  - Skor lama yang hangus direset ke **$0$**.
  - Jika pada ronde saat terbakar pemain tersebut terkena penalti minus, **poin minusnya tetap masuk penuh** ($\text{Skor} = 0 + \text{poin\_ronde}$).
  - _Contoh_: Punya 600 poin lalu disalip lawan dan terkena $-300$, skor akhir menjadi $\mathbf{-300}$ (bukan diputihkan jadi 0).
- **Penantang Terkuat (Highest Burner Priority)**:
  - Jika ada beberapa pemain yang menyalip seorang korban sekaligus, kredit **⚔️ membakar** diberikan kepada pemain dengan total skor tertinggi di ronde tersebut.

### 3. Penentuan Juara 1 (Tie-Breaker Seri $\ge 1000$)

Jika ada dua pemain atau lebih mencapai skor tertinggi yang sama saat game over:

1. Pemain yang **paling sering membakar lawan** keluar sebagai juara.
2. Jika masih sama, pemain yang **paling jarang kena bakar**.
3. Jika masih sama persis, dinyatakan juara bersama.

---

## ⚡ Fitur Unggulan

- 📱 **Keypad Virtual Ergonomis (Bottom Sheet)**:
  - Keyboard bawaan HP dinonaktifkan agar layar tidak sempit. Numpad kustom muncul dari bawah dengan jangkauan jempol yang pas.
  - Dilengkapi fitur **Auto-Lanjut** (P1 $\rightarrow$ P2 $\rightarrow$ P3 $\rightarrow$ P4) dan auto-scroll cerdas agar cell tidak pernah tertutup keypad.
- ⚡ **Tombol Shortcut Ceki**:
  - **Gope (+500)**: Otomatis mengisi +500 ke pemain aktif, pemain lain di ronde itu diisi 0, lalu langsung commit ronde.
  - **Triss (+300)** & **Nutup (+250)**: Shortcut otomatis untuk menutup ronde dengan cepat.
- 🔊 **Audio Meme & Sound FX Cerdas**:
  - Mendukung pemutaran audio meme acak saat ada yang kebakar (`audio/burn1.mp3`, `burn2.mp3`, dst.).
  - Peringatan suara otomatis (`audio/warn.mp3`) saat situasi genting terdeteksi (ada yang mau nyalip / terancam).
  - Feedback audio klik retro di tombol keypad.
  - Fallback otomatis ke Web Audio API Synthesizer jika file audio eksternal belum ada.
- ✨ **Animasi & Visual Interaktif**:
  - 🟡 **Radar Alert (Kuning)**: Peringatan visual saat skor terancam kesalip atau selisih tipis ($\le 50$ poin).
  - 🟢 **Neon Nitro (Hijau)**: Efek pendaran neon saat pemain sedang melaju mengejar/menyalip lawan.
  - 🔴 **Explosive Burn (Merah)**: Guncangan ledakan dan kilatan api pada cell yang terbakar.
  - 🎊 **Victory Confetti**: Hujan konfeti kanvas meriah saat ada pemain yang memenangkan pertandingan.
- 🔗 **Pindah Progress Antar-HP (Sync Kode & QR)**:
  - Lanjutkan match di HP teman tanpa server/database! Cukup generate kode atau QR code di HP asal, lalu scan atau tempel di HP pengganti.
- 📸 **Share Gambar PNG**:
  - Ekspor hasil akhir kemenangan atau klasemen sementara menjadi gambar PNG jernih siap bagikan ke WhatsApp atau media sosial via Web Share API.
- 💡 **Screen Wake Lock**:
  - Layar HP tetap menyala selama pertandingan berlangsung tanpa perlu repot membuka kunci layar berulang kali.
- 📶 **PWA & 100% Offline-Ready**:
  - Dapat diinstall langsung ke layar utama HP (_Add to Home Screen_) dan bekerja penuh tanpa koneksi internet.

---

## 📂 Struktur Project

```text
ceki-main/
├── audio/               # Aset suara (burn1.mp3, burn2.mp3, warn.mp3, dll)
│   └── README.md        # Panduan penamaan file audio & meme
├── icons/               # Ikon PWA (180px, 192px, 512px)
├── js/
│   ├── burn-announcer.js# Pengatur notifikasi & suara kebakar (anti-dobel)
│   ├── haptics.js       # Efek getar HP (Vibration API)
│   ├── history-modal.js # Modal riwayat pertandingan
│   ├── keypad.js        # Logika virtual numpad & ergonomi bottom sheet
│   ├── main.js          # Entry point & inisialisasi modul
│   ├── player-names.js  # Manajemen nama pemain
│   ├── progress-modal.js# Modal skor sementara (sebelum kelar)
│   ├── pwa.js           # Registrasi Service Worker & prompt install
│   ├── render.js        # Rendering tabel skor & visual status permainan
│   ├── scoring.js       # Logika murni perhitungan skor & aturan Ceki
│   ├── share.js         # Generator gambar hasil pertandingan (html-to-image)
│   ├── sound.js         # Controller audio, meme acak, & Web Audio synth
│   ├── store.js         # Single-source-of-truth state & localStorage
│   ├── sync-code.js     # Transfer progress game via Kode Base64 & QR Code
│   ├── timer.js         # Stopwatch durasi pertandingan
│   ├── toast.js         # Notifikasi toast & modal konfirmasi custom
│   ├── undo.js          # Riwayat langkah mundur (Undo stack)
│   ├── wakelock.js      # Penjaga layar HP agar tetap menyala
│   └── win-modal.js     # Modal kemenangan & efek hujan confetti
├── index.html           # Struktur layout utama
├── manifest.json        # Konfigurasi PWA Web App Manifest
├── style.css            # Custom animasi & styling tema gelap
└── sw.js                # Service Worker untuk caching aset offline
```

---

## 🚀 Cara Menjalankan

Karena project ini menggunakan JavaScript ES Modules (`import`/`export`), aplikasi perlu dijalankan melalui local web server:

1. **Menggunakan VS Code Live Server**:
   - Klik kanan `index.html` $\rightarrow$ pilih **"Open with Live Server"**.
2. **Menggunakan Node.js / npx**:
   ```bash
   npx serve .
   ```
3. Buka browser di URL yang tertera (misal: `http://localhost:3000` atau `http://localhost:5500`).
4. Buka di browser HP dalam satu jaringan Wi-Fi yang sama untuk langsung mencoba pengalaman mobile dan menginstalnya ke layar utama ponsel.
