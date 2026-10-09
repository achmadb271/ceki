# Panduan File Audio & Meme Ceki

Taruh file audio kamu di folder ini (`audio/`):

### 1. Suara Kebakar / Meme:

- `burn.mp3` (suara kebakar aktif saat ini)
- `burn2.mp3`, `burn3.mp3`, dst. (opsional jika ingin tambah variasi acak di masa depan)
  _(Bisa kamu isi suara meme kocak, misal: "Emotional Damage", "Wasted", efek tawa, ledakan, dsb)._

### 2. Suara Peringatan Mau Nyalip / Terancam:

- `warn.mp3` -> otomatis dimainkan saat ronde yang sedang diketik mendeteksi pemain mau kesalip / selisih poin genting.

### 3. Suara Kemenangan (Diacak Otomatis):

- `win.mp3` (file kemenangan utama)
- `win1.mp3`
- `win2.mp3`
- `win3.mp3`

---

> **Catatan:**
> Jika file `.mp3` belum dimasukkan atau file belum lengkap, aplikasi **tidak akan crash**, melainkan otomatis memainkan efek suara synthesizer retro bawaan (Web Audio API). Suara juga bisa dimatikan/dinyalakan kapan saja lewat tombol 🔊/🔇 di atas layar.
