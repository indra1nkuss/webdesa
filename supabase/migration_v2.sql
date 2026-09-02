-- =====================================================================
-- Website Informasi Desa - MIGRASI v2 (upgrade tampilan & detail)
-- =====================================================================
-- CARA PAKAI:
--   1. Buka Supabase Dashboard > SQL Editor > New query
--   2. Paste seluruh isi file ini > klik RUN
--
-- Aman dijalankan ulang (pakai IF NOT EXISTS / on conflict).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KOLOM BARU DI TABEL YANG SUDAH ADA
-- ---------------------------------------------------------------------

-- site_config: detail profil desa
alter table public.site_config
  add column if not exists tahun_berdiri          text,
  add column if not exists visi                   text,
  add column if not exists misi                   text,
  add column if not exists jumlah_kepala_keluarga text,
  add column if not exists foto_desa              text,  -- foto latar hero
  add column if not exists jam_layanan            text;

-- perangkat_desa: tugas pokok & tanda kepala desa
alter table public.perangkat_desa
  add column if not exists tugas    text,
  add column if not exists is_kades boolean default false;

-- umkm: detail alamat & jam buka
alter table public.umkm
  add column if not exists alamat   text,
  add column if not exists jam_buka text;

-- berita: sumber berita
alter table public.berita
  add column if not exists sumber text;

-- ---------------------------------------------------------------------
-- 2. TABEL BARU: GALERI FOTO DESA
-- ---------------------------------------------------------------------

create table if not exists public.galeri (
  id          uuid primary key default gen_random_uuid(),
  judul       text,
  kategori    text,             -- Kegiatan / Wisata / Pembangunan, dst
  foto_url    text,             -- path storage atau URL langsung
  deskripsi   text,
  tanggal     date default current_date,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY UNTUK GALERI
--    (sama pola dengan tabel lain: publik baca, admin tulis)
-- ---------------------------------------------------------------------

alter table public.galeri enable row level security;

create policy "public_read_galeri" on public.galeri
  for select using (true);

create policy "admin_write_galeri" on public.galeri
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 4. SEED / UPDATE DATA CONTOH untuk kolom baru
--    (diupdate jika baris seed sudah ada dari schema.sql v1)
-- ---------------------------------------------------------------------

-- Profil desa: tambah detail
update public.site_config
set tahun_berdiri          = '1980',
    jumlah_kepala_keluarga = '850 KK',
    jam_layanan            = 'Senin - Jumat, 08.00 - 16.00 WIB',
    visi                   = 'Menjadi desa yang sejahtera, mandiri, dan berbudaya dengan tata kelola pemerintahan yang baik dan bersih.',
    misi                   = E'1. Meningkatkan kesejahteraan masyarakat melalui pengembangan ekonomi kerakyatan.\n2. Menyelenggarakan pemerintahan desa yang transparan dan akuntabel.\n3. Meningkatkan kualitas pendidikan, kesehatan, dan pelayanan publik.\n4. Melestarikan budaya lokal dan menjaga kelestarian lingkungan.',
    foto_desa              = null
where id = 1;

-- Perangkat: tugas & tandai Kepala Desa
update public.perangkat_desa
set is_kades = true,
    tugas = 'Memimpin penyelenggaraan pemerintahan desa, membina kehidupan masyarakat, dan bertanggung jawab kepada BPD atas penyelenggaraan pemerintahan desa.'
where jabatan ilike '%kepala desa%';

update public.perangkat_desa
set tugas = 'Mengelola administrasi surat-menyurat, kearsipan, dan keuangan desa; menyusun laporan kegiatan pemerintahan desa.'
where jabatan ilike '%sekretaris%';

update public.perangkat_desa
set tugas = 'Mengelola urusan pemerintahan, kependudukan, dan perizinan di lingkungan desa.'
where jabatan ilike '%pemerintahan%';

update public.perangkat_desa
set tugas = 'Mengelola urusan kesejahteraan sosial, kesehatan, pendidikan, dan pemberdayaan masyarakat.'
where jabatan ilike '%kesra%';

update public.perangkat_desa
set tugas = 'Membantu kepala desa dalam mengkoordinasikan pelayanan dan pembangunan di wilayah dusun.'
where jabatan ilike '%dusun%';

-- UMKM: alamat & jam buka
update public.umkm set alamat = 'Dusun Krajan RT 01, Desa Makmur', jam_buka = 'Setiap hari, 08.00 - 20.00' where nama = 'Batik Tulis Makmur';
update public.umkm set alamat = 'Dusun Pasar RT 02, Desa Makmur',    jam_buka = 'Senin - Minggu, 06.00 - 18.00' where nama = 'Kopi Desa Asli';
update public.umkm set alamat = 'Jl. Raya Desa No. 12, Desa Makmur', jam_buka = 'Setiap hari, 09.00 - 21.00' where nama = 'Oleh-oleh Sari Rasa';

-- Berita: sumber
update public.berita set sumber = 'Pemerintah Desa Makmur' where judul = 'Gotong Royong Perbaikan Jalan';
update public.berita set sumber = 'Puskesmas Bahagia' where judul = 'Pengumuman Vaksinasi Gratis';

-- Galeri: contoh (foto dapat diupload lewat admin; nilai null aman)
insert into public.galeri (judul, kategori, deskripsi, tanggal, sort_order) values
  ('Gotong Royong Perbaikan Jalan',  'Kegiatan',     'Warga bersama-sama memperbaiki jalan utama desa.', '2026-08-01', 1),
  ('Panen Raya Pertanian',           'Wisata',       'Suasana panen raya di sawah Desa Makmur.',         '2026-07-15', 2),
  ('Senam Pagi Warga',               'Kegiatan',     'Senam pagi rutin setiap Minggu di lapangan desa.', '2026-07-10', 3)
on conflict do nothing;
