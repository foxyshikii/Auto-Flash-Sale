# Auto Flash Sale Userscripts

Kumpulan userscript Tampermonkey untuk membantu **flash sale** top up game di dua situs:

- **[VCGamers](https://vcgamers.com)**: refresh otomatis, pilih kartu promo, isi kode promo dan ID, pilih QRIS, lalu bayar.
- **[TopUpNoLimit](https://topupnolimit.com)**: kamu isi data akun dan produk sendiri; script hanya mengerjakan **kode promo → Konfirmasi → Buy**.

> Proyek tidak resmi dan tidak berafiliasi dengan VCGamers maupun TopUpNoLimit. Pemakaian sepenuhnya tanggung jawab kamu. Cek syarat dan ketentuan masing-masing situs.

## Isi repo

| File | Situs | Fungsi |
|---|---|---|
| `vcgamers-auto_user.js` | VCGamers | Versi asli. Refresh terjadwal, alur penuh sampai bayar. |
| `vcgamers-auto-test_user.js` | VCGamers | Versi tes. Mulai beberapa detik setelah halaman dibuka dan menampilkan alasan kalau langkah promo gagal. |
| `topupnolimit-fs-ori_user.js` | TopUpNoLimit | Versi asli. Mulai di jam yang ditentukan, ada pengaman total. |
| `topupnolimit-fs-tes_user.js` | TopUpNoLimit | Versi tes. Mulai 5 detik setelah halaman dibuka, promo dicoba sekali. |

Setiap versi (asli dan tes) punya nama dan namespace berbeda sehingga bisa terpasang bersamaan, tetapi **aktifkan satu saja per situs** pada satu waktu supaya tidak bentrok.

## Cara pasang

1. Pasang ekstensi [Tampermonkey](https://www.tampermonkey.net/) di browser.
2. Buka Dashboard Tampermonkey → tombol **+** (script baru).
3. Hapus isi bawaan, tempel seluruh isi file `.js`, lalu simpan.

Alternatif: tab **Utilitas** → **Impor dari file**. Kalau file ditolak, ganti ekstensinya menjadi `.user.js`. Nama file tidak memengaruhi cara kerja script, yang dibaca adalah blok `// ==UserScript==` di bagian atas isi file.

### Pasang lewat link (opsional)

Kalau file sudah ada di GitHub, buka link **Raw**-nya di browser. Tampermonkey langsung menampilkan halaman pemasangan selama nama file berakhiran `.user.js`. Bentuk linknya:

```
https://raw.githubusercontent.com/<username>/<nama-repo>/main/topupnolimit-fs-ori_user.js
```

Ganti `<username>` dengan akun GitHub kamu dan `<nama-repo>` dengan nama repositorinya.

---

## VCGamers

### Yang dikerjakan script
1. Menunggu jam `REFRESH_AT` (default 14:59:59, jam perangkat), lalu me-refresh halaman.
2. Memilih kartu promo, mengisi kode promo, mengisi ID akun, memilih payment (QRIS).
3. Mengecek ID dan total bayar, lalu menekan **Bayar**.
4. Status ditampilkan di pil di atas layar. Ketuk pil untuk membuka menu akun dan pilihan produk.

Buka halaman produk sebelum jam refresh. Script menjadwalkan sendiri dan melanjutkan alurnya setelah refresh.

### Akun dan data
- Tidak ada ID di dalam file script. Akun disimpan di browser lewat menu pil, jadi jangan membagikan data browsermu.
- Untuk mengecek nickname, script mengirim ID ke API pihak ketiga (`api.isan.eu.org` dan `proceck-api.vercel.app`). Kalau kamu tidak mau ID dikirim ke sana, jangan pakai script ini.

### Produk dan kode promo
Dua profil bawaan ada di `PROFILES`:

| Profil | Produk | Kode promo bawaan |
|---|---|---|
| `FF` | Free Fire (kartu flash sale) | `FFSERIBUAN` |
| `WDP` | Mobile Legends Weekly Diamond Pass | `WDPSERIBUAN` |

Untuk mengganti kode promo atau kartu yang dipilih, ubah `code` dan `card` di profil terkait. `card` adalah kata kunci teks kartu, ditulis huruf kecil semua. Tulis angka tanpa titik (mis. `7290` untuk "7.290 Diamonds"), karena script membuang titik dan koma dari teks kartu sebelum mencocokkan. Pastikan kartu yang dipilih memang berlaku untuk promonya; kartu biasa tidak menampilkan bagian "Pakai Promo".

### Pengaturan (`CFG`)

| Opsi | Arti |
|---|---|
| `PRODUCT` | Produk awal, `FF` atau `WDP` (bisa diganti lewat menu pil). |
| `REFRESH_AT` | Jam refresh, format `HH:MM:SS.mmm`. |
| `TEST_DELAY_SEC` | Lebih dari 0 = mode tes, refresh N detik setelah halaman dibuka. |
| `DRY_RUN` | `true` = berhenti sebelum klik Bayar dan tidak membuat pesanan. |
| `PAYMENT` | Teks metode bayar (huruf kecil). |
| `CARD_FALLBACK_ANY` | `true` = kalau kartu promo tidak ketemu, klik kartu apa saja. **Biarkan `false`**, supaya script tidak salah pilih kartu. |
| `CARD_FIRST` | `true` = cari kartu lewat kata kunci `card` dulu, baru lewat judul kode promo. |
| `MAX_PROMO_RETRY` | Berapa kali mencoba ulang memasang promo. |
| `TIMEOUT_MS` | Batas waktu seluruh proses. |
| `BADGE_ALPHA`, `BADGE_TOP` | Tampilan pil status (transparansi dan jarak dari atas layar). |

### Versi tes VCGamers
- `DRY_RUN` aktif dan `TEST_DELAY_SEC` diisi, jadi script berhenti sebelum Bayar.
- Pil menampilkan **alasan** kalau langkah promo gagal (kolom promo tidak ketemu, error di kolom promo, atau promo lain yang terpasang), dan alasan yang sama dicatat di console dengan awalan `[VCAuto promo]`.

### Hal yang perlu diketahui
- Promo dianggap berhasil kalau kode muncul di bagian "Pakai Promo" atau kolom input menghilang setelah dikirim. Pesan error dicek hanya di sekitar kolom promo, bukan seluruh halaman, supaya kata seperti "habis" atau "kuota" di bagian lain halaman tidak dianggap gagal.
- Kalau promo lain sudah terpasang (mis. promo terbaik otomatis), script menekan **Reset Promo** dulu lalu mengisi kodenya.
- Tombol "Gunakan" pada kartu "Promo Terbaik" sengaja tidak ditekan script, supaya tidak memasang promo yang salah.

| Pesan di pil | Artinya |
|---|---|
| `kartu produk tidak ketemu` | Kata kunci `card` tidak cocok dengan kartu mana pun. Pesan ikut menampilkan kartu yang terbaca. |
| `promo gagal dipasang` | Promo tidak terpasang setelah `MAX_PROMO_RETRY` percobaan. |
| `produk terpilih bukan ...` | Kartu yang terpilih tidak sesuai produk. Cek halaman. |
| `timeout` | Proses melewati `TIMEOUT_MS`. |
| `DRY RUN sukses, tombol Bayar ketemu` | Semua langkah berhasil, Bayar sengaja tidak ditekan. |
| `SELESAI, QRIS siap, silakan bayar` | Pesanan dibuat, tinggal bayar QRIS. |

---

## TopUpNoLimit

### Persiapan (manual, sebelum jam mulai)
1. Buka halaman produk di topupnolimit.com.
2. Isi **User ID dan Server**, tekan Cek ID sampai muncul "Selamat datang".
3. Pilih **produk**, pilih **payment** (mis. QRIS), isi **email**.
4. Pastikan kode promo sudah benar (lihat bagian kode promo di bawah).
5. Biarkan layar menyala dan jangan pindah tab. Pastikan jam HP/PC sinkron otomatis.

### Yang dikerjakan script
1. Isi kode promo. Kalau muncul "Kode voucher salah", script mencoba ulang (default sampai 25 detik, karena kode bisa baru aktif tepat saat flash sale mulai).
2. Tekan **Konfirmasi** sampai muncul "Detail Pesanan".
3. Baca **Total Pembayaran**. Kalau melebihi `MAX_TOTAL`, Buy tidak ditekan. Selain itu script menekan **Buy**.
4. Setelah halaman "Menunggu Pembayaran" muncul, pil status menampilkan "SELESAI, QRIS siap, silakan bayar". **Pembayaran QRIS tetap kamu lakukan sendiri** lewat aplikasi bank atau e-wallet.

Script berjalan di halaman yang sedang terbuka, **tanpa refresh**.

### Kode promo
- **Lewat popup (disarankan).** Saat halaman dibuka muncul popup untuk mengisi kode. Untuk menggantinya, ketuk tulisan di pil status (bukan tombol STOP) sebelum hitungan mundur selesai. Kode tersimpan di browser dan dipakai kedua file.
- **Lewat file.** Isi `PROMO: 'KODE'` di `CFG`. Kalau terisi, nilai ini mengalahkan popup. Kosongkan lagi (`PROMO: ''`) untuk kembali memakai popup.

Cek tulisan `promo: ...` di pil status sebelum jam mulai. Kalau tertulis `KOSONG`, script berhenti dengan pesan "kode promo belum diisi".

### Pengaturan (`CFG`)

| Opsi | Arti |
|---|---|
| `START_AT` | Jam mulai (jam perangkat), format `HH:MM:SS`. |
| `TEST_DELAY_SEC` | Lebih dari 0 = abaikan `START_AT`, mulai N detik dari sekarang (untuk tes). `0` = pakai `START_AT`. |
| `DRY_RUN` | `true` = berhenti sebelum Buy dan tidak membuat pesanan. `false` = Buy ditekan. |
| `PROMO` | Kode promo. Kosong = tanya lewat popup. |
| `PROMO_REQUIRED` | `true` = berhenti kalau kode promo belum ada. |
| `PROMO_RETRY_SEC` | Lama mencoba ulang kode yang ditolak. `0` = coba sekali saja. |
| `PROMO_FAIL_CONTINUE` | `true` = kalau promo gagal tetap lanjut Konfirmasi dan Buy. |
| `MAX_TOTAL` | Buy tidak ditekan kalau Total Pembayaran lebih besar dari angka ini. `0` = pengaman mati. |
| `MAX_SEC` | Batas waktu seluruh proses setelah mulai. |

| Opsi | `ori` | `tes` |
|---|---|---|
| `TEST_DELAY_SEC` | `0` | `5` |
| `DRY_RUN` | `false` | `false` |
| `PROMO_RETRY_SEC` | `25` | `0` |
| `PROMO_FAIL_CONTINUE` | `false` | `true` |
| `MAX_TOTAL` | `5000` | `0` |

> **Perhatian:** di file `tes`, `DRY_RUN: false` dan `MAX_TOTAL: 0` berarti Buy tetap ditekan walau promo gagal, sehingga terbentuk pesanan dengan harga normal. Pesanan baru menjadi transaksi kalau QRIS dibayar. Untuk tes tanpa membuat pesanan, ubah `DRY_RUN` menjadi `true`.

### Pesan di pil status

| Pesan | Artinya |
|---|---|
| `Mulai ... lagi \| promo: ...` | Hitungan mundur. Cek kode promo yang tertulis. |
| `kode promo belum diisi` | Kode kosong dan `PROMO_REQUIRED` aktif. |
| `kode promo ditolak terus / kolom promo tidak ketemu` | Kode ditolak sampai batas waktu, atau kolom promo tidak terdeteksi. |
| `Detail Pesanan tidak muncul` | Setelah Konfirmasi tidak ada modal. Cek ID, produk, payment, dan email sudah terisi. |
| `total ... > batas ...` | Total di atas `MAX_TOTAL`, kemungkinan promo belum terpasang. Buy tidak ditekan. |
| `total pembayaran tidak terbaca` | Teks total tidak ditemukan. Set `MAX_TOTAL: 0` untuk mematikan pengaman. |
| `tombol Buy tidak ketemu` | Tombol Buy tidak terdeteksi di modal. |
| `DRY RUN sukses, Buy ketemu` | Semua langkah berhasil, Buy sengaja tidak ditekan. |
| `SELESAI, QRIS siap` | Pesanan dibuat, tinggal bayar QRIS. |

---

## Pengaman (kedua script)

- **Tombol STOP** di pil status menghentikan script kapan saja.
- **`DRY_RUN`** menjalankan seluruh alur tanpa menekan tombol akhir (Bayar atau Buy).
- Di TopUpNoLimit, **`MAX_TOTAL`** mencegah Buy ditekan saat promo belum terpasang. Naikkan nilainya kalau harga flash sale ditambah biaya layanan bisa melebihi Rp5.000.
- Script berhenti dengan pesan jelas kalau langkah penting gagal, tidak menebak atau mengklik sembarang elemen.

## Keterbatasan

- Script mencari tombol dan kolom berdasarkan teks yang tampil di halaman. Kalau situs mengubah tampilannya (mis. tulisan "Konfirmasi", "Buy", atau "Pakai Promo"), script perlu disesuaikan.
- Di TopUpNoLimit, tanda "kode promo diterima" belum diketahui pasti, sehingga script menganggap diterima kalau pesan "Kode voucher salah" tidak muncul lagi. Pengaman `MAX_TOTAL` ada untuk menutup celah ini.
- Browser dapat memperlambat timer di tab yang tidak aktif atau layar yang mati.
- Tidak ada jaminan berhasil mendapatkan kuota flash sale.

## Keamanan data

Jangan menyimpan data pribadi (User ID, email, kode promo yang masih rahasia) di dalam file yang kamu unggah ke repo publik. Script VCGamers menyimpan akun di browser, dan script TopUpNoLimit menyimpan kode promo di browser lewat popup, bukan di file.
