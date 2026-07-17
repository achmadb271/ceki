# Taruh file audio kamu di sini

Nama file HARUS persis seperti ini (case-sensitive):

- `burn.mp3` -> dimainin pas ada pemain yang kebakar
- `win.mp3`  -> dimainin pas ada yang menang

Format lain (`.wav`, `.ogg`) juga bisa dipakai, tinggal ganti nama file di
`js/sound.js` (cari baris `new Audio('audio/burn.mp3')` dan
`new Audio('audio/win.mp3')`, ganti ekstensinya).

Kalau file belum ada / namanya salah, app tetap jalan normal - cuma gak ada
suara yang keluar (gak bikin error/crash).
