// =====================================================================
// KONFIGURASI WEBSITE INFORMASI DESA
// Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan data dari
// Supabase Dashboard > Project Settings > API
// =====================================================================

const SUPABASE_URL = "https://jzsqeytseilmmbcvvevf.supabase.co"; // ganti dengan URL project Anda
const SUPABASE_ANON_KEY = "sb_publishable_OC38zElZzu-Sp2bxj6MhoA_xmjCQIJc"; // publishable key (anon)

// Nama bucket storage untuk foto (harus sama dengan schema.sql)
const STORAGE_BUCKET = "images";

// ---------------------------------------------------------------------
// DAFTAR MENU (gaya aplikasi top-up)
// Untuk menambah/mengurangi menu, cukup edit array di bawah ini.
// "section" merujuk ke id section yang dirender di index.html.
// "icon" menggunakan emoji agar ringan (tanpa file gambar).
// "tint" = dua warna gradient khas per menu (tile ikon + wash kartu).
// "blurb" = deskripsi singkat di kartu launcher.
// ---------------------------------------------------------------------
const MENU_ITEMS = [
  { id: "profil",    label: "Profil Desa",          icon: "🏡", section: "section-profil",
    tint: ["#1f7a4d", "#34c6a0"], blurb: "Sejarah & data desa" },
  { id: "perangkat", label: "Perangkat Desa",       icon: "👥", section: "section-perangkat",
    tint: ["#0e7490", "#34d3c3"], blurb: "Aparatur & tugasnya" },
  { id: "umkm",      label: "UMKM Desa",            icon: "🛍️", section: "section-umkm",
    tint: ["#b45309", "#e9c46a"], blurb: "Usaha warga desa" },
  { id: "berita",    label: "Berita & Pengumuman",  icon: "📰", section: "section-berita",
    tint: ["#0f766e", "#5eead4"], blurb: "Kabar & pengumuman" },
  { id: "agenda",    label: "Agenda Desa",          icon: "📅", section: "section-agenda",
    tint: ["#6b21a8", "#c084fc"], blurb: "Kegiatan mendatang" },
  { id: "dokumen",   label: "Dokumen & Surat",      icon: "📄", section: "section-dokumen",
    tint: ["#1e40af", "#60a5fa"], blurb: "Unduh form & perdes" },
  { id: "pengaduan", label: "Pengaduan Warga",      icon: "💬", section: "section-pengaduan",
    tint: ["#c2410c", "#fb923c"], blurb: "Aspirasi & masukan" },
  { id: "galeri",    label: "Galeri Foto",          icon: "🖼️", section: "section-galeri",
    tint: ["#9f1239", "#fb7185"], blurb: "Dokumentasi desa" },
  { id: "kontak",    label: "Kontak & Lokasi",      icon: "📍", section: "section-kontak",
    tint: ["#1d4ed8", "#93c5fd"], blurb: "Alamat & peta" }
];
