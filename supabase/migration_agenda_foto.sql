-- Migration: Tambah kolom foto_url ke tabel agenda
-- Jalankan di Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS foto_url text;
