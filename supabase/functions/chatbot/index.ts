// =====================================================================
// Edge Function: chatbot — Proxy Groq API untuk widget "Tanya Desa"
// ---------------------------------------------------------------------
// Cara kerja:
//   1. Menerima POST { messages: [{role, content}] } dari situs publik.
//   2. Mengambil data TERKINI dari tabel database (site_config,
//      perangkat_desa, umkm, berita, agenda, dokumen) via REST.
//   3. Menyuntikkan data tersebut ke system prompt → jawaban selalu
//      sinkron dengan konten terbaru yang dikelola admin.
//   4. Meneruskan percakapan ke Groq API (key disimpan sebagai secret).
//
// Deploy:
//   - Dashboard: Edge Functions > Create a new function > chatbot
//   - Atau CLI : npx supabase@latest functions deploy chatbot
//
// Secret wajib:
//   GROQ_API_KEY  -> Dashboard > Edge Functions > Secrets
//   (SUPABASE_URL & SUPABASE_ANON_KEY otomatis tersedia di runtime)
// =====================================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // primary (2026 model)
const MODEL_FALLBACK = "openai/gpt-oss-20b"; // cadangan bila model utama sibuk

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Batas proteksi kuota free Groq
const MAX_HISTORY = 10;        // pesan terakhir yang diteruskan ke model
const MAX_CONTENT_LEN = 800;   // panjang maks per pesan
const RATE_LIMIT = 15;         // permintaan
const RATE_WINDOW_MS = 60_000; // per menit per IP

// Rate limit in-memory (best-effort — instance bisa restart; pelindung
// utama tetap throttle + kuota harian di sisi client chatbot.js)
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Metode harus POST." }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "Terlalu banyak pertanyaan. Coba lagi sebentar lagi ya." }, 429);

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) return json({ error: "Secret GROQ_API_KEY belum diatur di Supabase." }, 500);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ---- Validasi input -------------------------------------------------
  let messages: { role: string; content: string }[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json({ error: "Body bukan JSON valid." }, 400);
  }

  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_CONTENT_LEN) }));

  if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
    return json({ error: "Tidak ada pertanyaan untuk diproses." }, 400);
  }

  // ---- Ambil data live dari database ----------------------------------
  const rest = (path: string) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    }).then((r) => (r.ok ? r.json() : []));

  const [config, perangkat, umkm, berita, agenda, dokumen] = await Promise.all([
    rest("site_config?select=village_name,motto,sejarah,tahun_berdiri,visi,misi,luas_wilayah,jumlah_penduduk,jumlah_kepala_keluarga,potensi,alamat_kantor,telepon,email,jam_layanan,facebook,instagram&id=eq.1"),
    rest("perangkat_desa?select=nama,jabatan,periode,tugas&order=sort_order.asc&limit=30"),
    rest("umkm?select=nama,pemilik,kategori,deskripsi,alamat,jam_buka,kontak&order=sort_order.asc&limit=40"),
    rest("berita?select=judul,kategori,tanggal,sumber&order=tanggal.desc&limit=10"),
    rest("agenda?select=judul,tanggal,waktu,lokasi,kategori&order=tanggal.asc&limit=10"),
    rest("dokumen?select=judul,kategori,ukuran&order=sort_order.asc&limit=30"),
  ]);

  // ---- Susun system prompt --------------------------------------------
  const sys = `Kamu adalah "Tanya Desa", asisten AI resmi di website desa. Jawab SELALU dalam Bahasa Indonesia yang ramah, singkat, dan mudah dipahami warga.

DATA DESA SAAT INI (sumber utama jawaban):
${JSON.stringify(config[0] ?? {}, null, 1)}
PERANGKAT DESA:
${JSON.stringify(perangkat)}
UMKM DESA:
${JSON.stringify(umkm)}
BERITA & PENGUMUMAN TERBARU:
${JSON.stringify(berita)}
AGENDA KEGIATAN:
${JSON.stringify(agenda)}
DOKUMEN/SURAT YANG BISA DIUNDUH:
${JSON.stringify(dokumen)}

ATURAN WAJIB:
1. HANYA menjawab seputar isi website & informasi desa di atas: profil/sejarah/visi-misi, perangkat desa, UMKM, berita, agenda, dokumen/surat, kontak/lokasi, cara menggunakan website.
2. Jika informasi tidak ada dalam data, katakan jujur belum tersedia lalu sarankan menghubungi kantor desa atau membuka menu terkait di website. JANGAN mengarang data.
3. Pertanyaan di luar topik desa (mis. resep, berita nasional, coding) → tolak sopan satu kalimat dan arahkan kembali ke info desa.
4. Untuk urusan administrasi (KTP, surat menyurat), arahkan ke menu "Dokumen & Surat" dan form "Pengaduan" di website ini.
5. Jangan pernah menyinggung isi pengaduan pribadi warga (data itu memang tidak diberikan kepadamu).`;

  // ---- Panggil Groq ----------------------------------------------------
  async function callGroq(model: string) {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: "system", content: sys }, ...clean],
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`groq ${r.status}: ${errText}`);
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content;
    if (!text) throw new Error("jawaban kosong");
    return text;
  }

  try {
    let reply: string;
    try {
      reply = await callGroq(MODEL);
    } catch (err1) {
      console.error("Primary model error:", err1);
      reply = await callGroq(MODEL_FALLBACK); // fallback bila model utama error/rate-limited
    }
    return json({ reply });
  } catch (e: any) {
    console.error(e);
    return json({ error: `Error dari sistem AI: ${e.message}` }, 502);
  }
});
