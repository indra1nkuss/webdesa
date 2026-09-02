-- =====================================================================
-- Website Informasi Desa - Migrasi Skema Database v3
-- Menambahkan tabel Dokumen Surat, Pengaduan Aspirasi Warga, dan Agenda Desa
-- Jalankan script ini di: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- 1. TABEL DOKUMEN & SURAT DESA
create table if not exists public.dokumen (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null,
  kategori    text default 'Surat / Form',
  deskripsi   text,
  file_url    text not null,
  ukuran      text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- 2. TABEL PENGADUAN & ASPIRASI WARGA
create table if not exists public.pengaduan (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  kontak      text,
  subjek      text not null,
  isi         text not null,
  status      text default 'Pending', -- Pending / Diproses / Selesai
  tanggapan   text,
  created_at  timestamptz default now()
);

-- 3. TABEL AGENDA KEGIATAN DESA
create table if not exists public.agenda (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null,
  tanggal     date not null,
  waktu       text,
  lokasi      text,
  deskripsi   text,
  kategori    text default 'Kegiatan',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------

alter table public.dokumen   enable row level security;
alter table public.pengaduan enable row level security;
alter table public.agenda    enable row level security;

-- Policies Dokumen
create policy "public_read_dokumen" on public.dokumen for select using (true);
create policy "admin_write_dokumen" on public.dokumen for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Policies Pengaduan (Anon/Publik bisa Insert, Hanya Admin yang bisa Select/Update/Delete)
create policy "public_insert_pengaduan" on public.pengaduan for insert with check (true);
create policy "admin_manage_pengaduan" on public.pengaduan for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Policies Agenda
create policy "public_read_agenda" on public.agenda for select using (true);
create policy "admin_write_agenda" on public.agenda for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- SEED DATA AWAL
-- ---------------------------------------------------------------------

insert into public.dokumen (judul, kategori, deskripsi, file_url, ukuran) values
  ('Formulir Permohonan KTP', 'Formulir', 'Formulir pengajuan KTP baru atau penggantian kerusakan.', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '150 KB'),
  ('Surat Keterangan Usaha (SKU)', 'Surat Keterangan', 'Syarat dan formulir pengantar SKU untuk UMKM desa.', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '120 KB'),
  ('Laporan Transparansi APBDES 2026', 'Laporan', 'Dokumen laporan realisasi anggaran pendapatan dan belanja desa.', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '450 KB')
on conflict do nothing;

insert into public.agenda (judul, tanggal, waktu, lokasi, deskripsi, kategori) values
  ('Musrenbangdesa 2026', '2026-08-25', '09.00 - 12.00 WIB', 'Balai Desa Makmur', 'Musyawarah perencanaan pembangunan desa tahun anggaran mendatang.', 'Musyawarah'),
  ('Jalan Sehat & Festival UMKM', '2026-08-30', '06.30 WIB - Selesai', 'Lapangan Utama Desa', 'Kegiatan olahraga bersama dan bazar produk lokal warga.', 'Festival'),
  ('Posyandu Balita & Lansia', '2026-09-05', '08.00 - 11.00 WIB', 'Poskesdes Krajan', 'Pemeriksaan kesehatan gratis dan pembagian makanan tambahan.', 'Kesehatan')
on conflict do nothing;
