# Website Informasi Desa 🏡

Website informasi desa berbasis **HTML/CSS/JS statis** dengan backend **Supabase**.
Tampilan awal berupa **grid menu bergambar** (gaya aplikasi top-up). Pengunjung
memindai **QR di gapura desa** → membuka website → memilih menu (Profil, Perangkat
Desa, UMKM, Berita, Kontak) → melihat isi desa sebelum masuk.

Admin mengelola semua data lewat **panel admin** (`admin.html`) — perubahan langsung
muncul untuk semua pengunjung.

---

## 📁 Struktur

```
WebInformasiDesa/
├── index.html           # Site publik (menu + section + modal)
├── admin.html           # Panel admin (login + CRUD + upload foto)
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js    # ISI URL/KEY SUPABASE DI SINI + daftar menu
│       ├── public.js    # Render site publik (detail + modal + galeri)
│       └── admin.js     # Auth + CRUD admin
├── supabase/
│   ├── schema.sql       # Skema lengkap (untuk project BARU)
│   └── migration_v2.sql # Upgrade project yang SUDAH ada (jalankan sekali)
└── README.md
```

---

## 🚀 Setup (langkah demi langkah)

### 1. Buat project Supabase (gratis)
1. Buka https://supabase.com → **Start your project** → login.
2. Klik **New Project**, beri nama (mis. `desa-makmur`), tunggu proses selesai.
3. Buka **SQL Editor** → **New query** → copy seluruh isi `supabase/schema.sql`
   → paste → klik **Run**. Ini membuat tabel, aturan akses (RLS), bucket foto,
   dan **data contoh** (Desa Makmur).

### 1b. Upgrade project yang SUDAH ada (opsional jika sudah pernah setup)
1. Jalankan `supabase/schema.sql` → lalu `supabase/migration_v2.sql`
   (yang v2 berisi kolom baru **visi/misi, tahun berdiri, galeri foto**, dll).
2. Aman dijalankan ulang — semua perintah memakai `IF NOT EXISTS` / `on conflict`.

### 2. Ambil kredensial & isi config.js
1. Di Supabase: **Project Settings → API**.
2. Salin **Project URL** dan **anon public key**.
3. Buka `assets/js/config.js`, ganti:
   ```js
   const SUPABASE_URL = "https://XXXX.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGci...";
   ```

### 3. Buat akun admin
1. Buka `admin.html` di browser (lihat cara jalankan di bawah).
2. Klik **"Daftar admin"**, isi email & password → klik Daftar.
3. Cek email verifikasi (klik link di email).
4. Login dengan email & password tadi.
5. Isi **Profil Desa**, lalu tambah **Perangkat**, **UMKM**, **Berita**.

> Catatan: verifikasi email bisa dimatikan di Supabase →
> **Authentication → Providers → Email** (toggle "Confirm email").

---

## 💻 Cara menjalankan (lokal)

Buka folder lewat server statis sederhana (karena memakai `fetch`/module):

**Dengan Python:**
```bash
cd WebInformasiDesa
python -m http.server 8000
# buka http://localhost:8000  (site publik)
# buka http://localhost:8000/admin.html  (admin)
```

**Dengan Node:**
```bash
npx serve WebInformasiDesa
```

Atau cukup buka `index.html` langsung di browser (beberapa fitur mungkin terbatas
tanpa server, tapi Supabase tetap bisa diakses lewat CDN).

---

## 🌐 Hosting (biar bisa di-scan QR)

Folder ini murni file statis — bisa di-host di mana saja:

- **Netlify Drop**: buka https://app.netlify.com/drop, seret folder `WebInformasiDesa`.
- **GitHub Pages**: push folder ke repo, aktifkan Pages di Settings.
- **Vercel / Cloudflare Pages**: import folder, output = root.

Setelah live, Anda dapat URL (mis. `https://desamakmur.netlify.app`).

---

## 📱 Buat QR Gapura

1. Masuk ke generator QR gratis, mis. https://api.qrserver.com atau
   https://www.qr-code-generator.com.
2. Masukkan URL website publik Anda (`index.html`).
3. Download PNG → cetak → pasang di gapura desa.

Pengunjung scan → otomatis ke website → lihat info desa.

---

## ⚙️ Kustomisasi

- **Tambah/kurangi menu**: edit array `MENU_ITEMS` di `assets/js/config.js`.
  `section` harus cocok dengan `id` section di `index.html` (mis. `section-umkm`).
- **Galeri foto**: kelola lewat admin tab **Galeri** — foto kegiatan/wisata desa muncul
  di menu **Galeri Foto** pada situs publik (klik foto untuk lightbox).
- **Warna & nama desa**: diubah lewat admin tab **Profil Desa** (field "Warna Aksen").
- **Foto**: diupload ke Supabase Storage bucket `images` otomatis dari admin.

---

## 🔒 Keamanan

- Pengunjung (anon) **hanya bisa membaca** (SELECT) — diatur via RLS.
- Hanya user yang **login (admin)** yang bisa menulis/mengubah data.
- Jangan sebarkan password admin; ganti secara berkala.

## 📝 Catatan

- Data contoh (Desa Makmur, perangkat, UMKM, berita) otomatis muncul setelah
  menjalankan `schema.sql` — silakan diedit/dihapus lewat admin.
- Semua teks menggunakan Bahasa Indonesia.
