# VCGamers Auto Promo

Userscript untuk membantu mengisi otomatis alur top up promo di VCGamers: refresh pada jam tertentu, pilih produk, pasang kode promo, isi ID akun, pilih QRIS, lalu bayar sampai QRIS terbentuk.

> Tidak berafiliasi dengan VCGamers, Garena, atau Moonton. Gunakan dengan risiko sendiri.

## Fitur

- Refresh otomatis pada jam yang diatur (default `14:59:59`) berdasarkan jam perangkat.
- Mendukung dua produk: **Free Fire** (`FFSERIBUAN`) dan **Mobile Legends** (`WDPSERIBUAN`).
- Menyimpan banyak akun (ID dan server) di browser, dipilih lewat panel.
- Pil status transparan: hitung mundur, langkah berjalan (1/5 sampai 5/5), dan status berhasil atau berhenti.
- Mode tes (`DRY_RUN`): berhenti sebelum klik **Bayar**, jadi tidak membuat pesanan.

## File

| File | Kegunaan |
| --- | --- |
| `vcgamers-auto.user.js` | Versi asli: refresh pada jam target, lalu klik Bayar |
| `vcgamers-auto-test.user.js` | Versi tes: refresh 10 detik setelah halaman dibuka, tidak klik Bayar |

Pasang salah satu saja. Matikan yang lain di Tampermonkey agar tidak bentrok.

## Instalasi

1. Pasang manajer userscript:
   - Android: Kiwi Browser atau Firefox dengan Tampermonkey/Violentmonkey (Chrome Android biasa tidak mendukung userscript).
   - PC: Tampermonkey di Chrome atau Firefox.
2. Buka file `.user.js` (tombol **Raw** di GitHub), lalu pasang lewat manajer userscript.
3. Aktifkan waktu otomatis (jam jaringan) di perangkat.

## Cara pakai

1. Buka halaman produk di VCGamers sebelum jam target.
2. Tap pil status di atas layar untuk membuka panel.
3. Pilih produk (Free Fire atau Mobile Legends), lalu tambah dan pilih akun.
4. Biarkan halaman terbuka. Pada jam target halaman refresh dan script berjalan sendiri.

## Pengaturan

Ada di bagian `CFG` pada awal file:

| Opsi | Keterangan |
| --- | --- |
| `REFRESH_AT` | Jam refresh, format `HH:MM:SS.mmm` |
| `TEST_DELAY_SEC` | Lebih dari 0 berarti mode tes: refresh N detik setelah halaman dibuka |
| `DRY_RUN` | `true` berarti berhenti sebelum klik Bayar |
| `PAYMENT` | Teks metode bayar yang dicari (default `qris`) |
| `MAX_PROMO_RETRY` | Berapa kali mencoba memasang promo |
| `BADGE_ALPHA` | Keburaman latar pil: `0.25` kaca 75%, `0.5` sedang |
| `BADGE_TOP` | Jarak pil dari atas layar |

Kartu nominal dicari lewat judul yang memuat kode promo atau lewat kata kunci `card` di `PROFILES`.

## Privasi

- Tidak ada ID akun di dalam file. Akun disimpan di `localStorage` browser masing-masing dan tidak dikirim ke mana pun.
- ID di panel ditampilkan disamarkan.

## Catatan

- Elemen halaman dicari dari teks tombol, jadi bisa berhenti bekerja kalau tampilan VCGamers berubah.
- Ada jeda load 1 sampai 2 detik setelah refresh. Kuota promo bisa habis lebih dulu.
- Penggunaan otomatisasi bisa melanggar ketentuan layanan situs. Tanggung jawab ada pada pengguna.
- Logo game di panel adalah milik masing-masing pemilik merek.
