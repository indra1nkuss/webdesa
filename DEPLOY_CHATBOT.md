# 🤖 Panduan Deploy Chatbot "Tanya Desa"

Fitur chatbot AI sudah selesai dibuat dan teruji secara lokal. Yang tersisa hanyalah
**2 langkah di Supabase Dashboard** agar bot hidup (karena API key Groq tidak boleh ada
di sisi client).

---

## Langkah 1 — Simpan Secret `GROQ_API_KEY`

1. Buka https://supabase.com/dashboard → project **jzsqeytseilmmbcvvevf**
2. Menu kiri → **Edge Functions** → tab **Secrets**
3. Klik **Add new secret** / **Create secret**
   - Name : `GROQ_API_KEY`
   - Value: API key Groq kamu (format `gsk_...`, ambil dari https://console.groq.com/keys)
4. Save.

> Key ini hanya bisa dibaca oleh Edge Function di server — tidak pernah dikirim ke browser.

## Langkah 2 — Deploy Function `chatbot`

1. Masih di **Edge Functions** → klik **Create a new function** (atau tombol **Deploy a new function**)
2. Pilih **Create via Editor** / tulis langsung di dashboard
3. Nama function: **`chatbot`**  ← harus persis seperti ini
4. Hapus isi template, lalu **paste seluruh isi file**
   [`supabase/functions/chatbot/index.ts`](supabase/functions/chatbot/index.ts)
5. Klik **Deploy**. Tunggu sampai status **Active**.

> Alternatif via CLI (opsional):
> ```
> npx supabase@latest login
> npx supabase@latest functions deploy chatbot --project-ref jzsqeytseilmmbcvvevf
> ```

## Langkah 3 — Test Cepat

Dari terminal (PowerShell/CMD):

```
curl -X POST "https://jzsqeytseilmmbcvvevf.supabase.co/functions/v1/chatbot" -H "Authorization: Bearer sb_publishable_OC38zElZzu-Sp2bxj6MhoA_xmjCQIJc" -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Siapa kepala desanya?\"}]}"
```

✅ Berhasil = balasan JSON berisi `"reply"` dengan nama Kepala Desa sesuai data admin.
❌ `"error":"Secret GROQ_API_KEY belum diatur"` = ulangi Langkah 1.

Setelah itu buka website → klik tombol **🤖 Tanya Desa** kanan-bawah.

---

## Cara Kerja Singkat

| Komponen | File | Peran |
|---|---|---|
| Edge Function | `supabase/functions/chatbot/index.ts` | Proxy ke Groq; key tersimpan aman sebagai secret |
| Widget | `assets/js/chatbot.js` | Tombol melayang + panel chat di index.html |
| Style | `assets/css/style.css` (section `.cb-*`) | Tampilan panel/bubble/chips |

- **Data selalu segar**: setiap pertanyaan, function mengambil data TERKINI dari tabel
  `site_config`, `perangkat_desa`, `umkm`, `berita`, `agenda`, `dokumen` lalu menyuntikkannya
  ke prompt AI → jawaban otomatis sinkron dengan edit admin (tanpa training ulang).
- **Privasi**: isi tabel `pengaduan` sengaja TIDAK diberikan ke AI.
- **Cakupan**: bot menolak sopan pertanyaan di luar topik desa.

## Proteksi Kuota Groq Free

- Client: jeda minimal 2 detik antar pesan + maks **30 pesan/hari per browser**.
- Server: maks **15 permintaan/menit per IP**.
- Model utama `llama-3.3-70b-versatile`, otomatis fallback ke `llama-3.1-8b-instant` bila sibuk.
