-- =====================================================================
-- Website Informasi Desa - Skema Database Supabase
-- Jalankan script ini di: Supabase Dashboard > SQL Editor > New query
-- Catatan: project yang SUDAH ada cukup jalankan supabase/migration_v2.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- Konfigurasi umum desa (hanya 1 baris, id = 1)
create table if not exists public.site_config (
  id                    integer primary key default 1,
  village_name          text default 'Desa Contoh',
  logo_url              text,
  motto                 text,
  sejarah               text,
  tahun_berdiri         text,
  visi                  text,
  misi                  text,
  luas_wilayah          text,
  jumlah_penduduk       text,
  jumlah_kepala_keluarga text,
  potensi               text,
  foto_desa             text,
  alamat_kantor         text,
  telepon               text,
  email                 text,
  jam_layanan           text,
  maps_url              text,
  facebook              text,
  instagram             text,
  accent_color          text default '#1f7a4d',
  updated_at            timestamptz default now()
);

-- Struktur perangkat desa
create table if not exists public.perangkat_desa (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  jabatan     text not null,
  foto_url    text,
  periode     text,
  tugas       text,
  is_kades    boolean default false,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- UMKM desa
create table if not exists public.umkm (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  pemilik     text,
  kategori    text,
  deskripsi   text,
  foto_url    text,
  kontak      text,
  alamat      text,
  jam_buka    text,
  maps_url    text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- Berita & pengumuman
create table if not exists public.berita (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null,
  isi         text,
  kategori    text,
  foto_url    text,
  tanggal     date default current_date,
  sumber      text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- Galeri foto desa
create table if not exists public.galeri (
  id          uuid primary key default gen_random_uuid(),
  judul       text,
  kategori    text,
  foto_url    text,
  deskripsi   text,
  tanggal     date default current_date,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    - anon (pengunjung via QR): hanya bisa SELECT (baca)
--    - authenticated (admin login): bisa INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------

alter table public.site_config    enable row level security;
alter table public.perangkat_desa enable row level security;
alter table public.umkm           enable row level security;
alter table public.berita         enable row level security;
alter table public.galeri         enable row level security;

-- Baca untuk semua orang (anon + authenticated)
create policy "public_read_site_config" on public.site_config
  for select using (true);

create policy "public_read_perangkat" on public.perangkat_desa
  for select using (true);

create policy "public_read_umkm" on public.umkm
  for select using (true);

create policy "public_read_berita" on public.berita
  for select using (true);

create policy "public_read_galeri" on public.galeri
  for select using (true);

-- Tulis hanya untuk user yang sudah login (admin)
create policy "admin_write_site_config" on public.site_config
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_perangkat" on public.perangkat_desa
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_umkm" on public.umkm
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_berita" on public.berita
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin_write_galeri" on public.galeri
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 3. STORAGE BUCKET UNTUK FOTO
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Baca foto: semua orang
create policy "public_read_images" on storage.objects
  for select using (bucket_id = 'images');

-- Upload/edit/hapus foto: hanya admin
create policy "admin_write_images" on storage.objects
  for all using (bucket_id = 'images' and auth.role() = 'authenticated')
  with check (bucket_id = 'images' and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 4. SEED DATA CONTOH
-- ---------------------------------------------------------------------

insert into public.site_config (id, village_name, motto, sejarah, tahun_berdiri, visi, misi, luas_wilayah, jumlah_penduduk, jumlah_kepala_keluarga, potensi, alamat_kantor, telepon, email, jam_layanan)
values (
  1,
  'Desa Makmur',
  'Desa yang sejahtera, mandiri, dan berbudaya',
  'Desa Makmur merupakan desa yang terletak di lereng pegunungan dengan kekayaan alam yang melimpah. Masyarakatnya dikenal ramah dan gotong royong. Sejak tahun 1980 desa ini mulai berkembang pesat di bidang pertanian dan pariwisata.',
  '1980',
  'Menjadi desa yang sejahtera, mandiri, dan berbudaya dengan tata kelola pemerintahan yang baik dan bersih.',
  '1. Meningkatkan kesejahteraan masyarakat melalui pengembangan ekonomi kerakyatan.
2. Menyelenggarakan pemerintahan desa yang transparan dan akuntabel.
3. Meningkatkan kualitas pendidikan, kesehatan, dan pelayanan publik.
4. Melestarikan budaya lokal dan menjaga kelestarian lingkungan.',
  '2,5 km persegi',
  '3.245 jiwa',
  '850 KK',
  'Pertanian, pariwisata alam, kerajinan tangan',
  'Jl. Raya Desa No. 1, Kec. Bahagia',
  '08123456789',
  'desamakmur@example.com',
  'Senin - Jumat, 08.00 - 16.00 WIB'
)
on conflict (id) do nothing;

insert into public.perangkat_desa (nama, jabatan, periode, tugas, is_kades, sort_order) values
  ('Bpk. Slamet Riyadi',   'Kepala Desa',          '2021 - 2027', 'Memimpin penyelenggaraan pemerintahan desa, membina kehidupan masyarakat, dan bertanggung jawab kepada BPD atas penyelenggaraan pemerintahan desa.', true, 1),
  ('Ibu. Siti Aminah',     'Sekretaris Desa',      '2021 - 2027', 'Mengelola administrasi surat-menyurat, kearsipan, dan keuangan desa; menyusun laporan kegiatan pemerintahan desa.', false, 2),
  ('Bpk. Joko Susilo',     'Kaur Pemerintahan',    '2021 - 2027', 'Mengelola urusan pemerintahan, kependudukan, dan perizinan di lingkungan desa.', false, 3),
  ('Ibu. Dewi Lestari',    'Kaur Kesra',           '2021 - 2027', 'Mengelola urusan kesejahteraan sosial, kesehatan, pendidikan, dan pemberdayaan masyarakat.', false, 4),
  ('Bpk. Ahmad Fauzi',     'Kepala Dusun I',       '2021 - 2027', 'Membantu kepala desa dalam mengkoordinasikan pelayanan dan pembangunan di wilayah dusun.', false, 5)
on conflict do nothing;

insert into public.umkm (nama, pemilik, kategori, deskripsi, kontak, alamat, jam_buka, sort_order) values
  ('Batik Tulis Makmur',   'Ibu Sari',  'Kerajinan', 'Batik tulis khas desa dengan motif alam.', '08123456780', 'Dusun Krajan RT 01, Desa Makmur', 'Setiap hari, 08.00 - 20.00', 1),
  ('Kopi Desa Asli',       'Bpk. Budi', 'Makanan & Minuman', 'Kopi arabika bubuk dari kebun lokal.', '08123456781', 'Dusun Pasar RT 02, Desa Makmur', 'Senin - Minggu, 06.00 - 18.00', 2),
  ('Oleh-oleh Sari Rasa',  'Ibu Rina',  'Makanan', 'Camilan tradisional dan oleh-oleh khas.', '08123456782', 'Jl. Raya Desa No. 12, Desa Makmur', 'Setiap hari, 09.00 - 21.00', 3)
on conflict do nothing;

insert into public.berita (judul, isi, kategori, tanggal, sumber, sort_order) values
  ('Gotong Royong Perbaikan Jalan', 'Warga bergotong royong memperbaiki jalan utama desa pada Minggu pagi. Kegiatan ini dihadiri oleh seluruh lapisan masyarakat dan berjalan lancar hingga selesai.', 'Kegiatan', '2026-08-01', 'Pemerintah Desa Makmur', 1),
  ('Pengumuman Vaksinasi Gratis', 'Diberitahukan kepada seluruh warga untuk mengikuti vaksinasi di balai desa. Vaksinasi dilaksanakan secara gratis dan terbuka untuk umum.', 'Pengumuman', '2026-07-20', 'Puskesmas Bahagia', 2)
on conflict do nothing;

insert into public.galeri (judul, kategori, deskripsi, tanggal, sort_order) values
  ('Gotong Royong Perbaikan Jalan',  'Kegiatan', 'Warga bersama-sama memperbaiki jalan utama desa.', '2026-08-01', 1),
  ('Panen Raya Pertanian',           'Wisata',   'Suasana panen raya di sawah Desa Makmur.',         '2026-07-15', 2),
  ('Senam Pagi Warga',               'Kegiatan', 'Senam pagi rutin setiap Minggu di lapangan desa.', '2026-07-10', 3)
on conflict do nothing;
