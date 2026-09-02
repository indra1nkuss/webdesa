// =====================================================================
// chatbot.js - Widget "Tanya Desa" 🤖 (tombol melayang + panel chat)
// ---------------------------------------------------------------------
// Butuh config.js (SUPABASE_URL) sudah ter-load sebelum file ini.
// Endpoint: <SUPABASE_URL>/functions/v1/chatbot (Supabase Edge Function)
// Key Groq TIDAK ada di sini — tersimpan sebagai secret di Supabase.
// =====================================================================

(function () {
  "use strict";

  const ENDPOINT = SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/chatbot";
  const ANON_KEY = SUPABASE_ANON_KEY;

  // Batas pemakaian (lindungi kuota free Groq)
  const MIN_GAP_MS = 2000;        // jeda minimal antar kirim
  const DAILY_LIMIT = 30;         // pesan per hari per browser
  const MAX_HISTORY = 10;         // pesan yang dikirim ke server

  let history = [];               // [{role, content}]
  let lastSend = 0;
  let busy = false;

  // ---------------------------------------------------------------------
  // Util
  // ---------------------------------------------------------------------
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function dailyCount() {
    try {
      const raw = JSON.parse(localStorage.getItem("cb_usage") || "{}");
      if (raw.date !== new Date().toDateString()) return 0; // hari baru → reset
      return raw.n || 0;
    } catch { return 0; }
  }
  function bumpDaily() {
    try {
      localStorage.setItem("cb_usage", JSON.stringify({ date: new Date().toDateString(), n: dailyCount() + 1 }));
    } catch { /* abaikan bila storage diblokir */ }
  }

  // ---------------------------------------------------------------------
  // Bangun DOM widget
  // ---------------------------------------------------------------------
  const root = document.getElementById("chatbot-root");
  if (!root) return;

  root.innerHTML = `
    <button class="cb-fab" id="cb-fab" aria-label="Buka Tanya Desa">
      <span class="cb-fab-ic">🤖</span>
      <span class="cb-fab-label">Tanya Desa</span>
    </button>

    <div class="cb-panel" id="cb-panel" role="dialog" aria-label="Tanya Desa" aria-hidden="true">
      <div class="cb-head">
        <span class="cb-head-ic">🤖</span>
        <div class="cb-head-txt">
          <strong>Tanya Desa</strong>
          <small><span class="cb-online"></span> Asisten AI informasi desa</small>
        </div>
        <button class="cb-close" id="cb-close" aria-label="Tutup">×</button>
      </div>

      <div class="cb-msgs" id="cb-msgs"></div>

      <div class="cb-chips" id="cb-chips">
        <button data-q="Profil desa ini seperti apa?">🏡 Profil desa</button>
        <button data-q="UMKM apa saja yang ada di desa?">🛍️ UMKM desa</button>
        <button data-q="Apa agenda kegiatan desa berikutnya?">📅 Agenda</button>
        <button data-q="Bagaimana cara mengurus KTP dan surat-surat?">📄 Urusan surat</button>
      </div>

      <form class="cb-inputrow" id="cb-form">
        <input type="text" id="cb-input" placeholder="Tulis pertanyaan tentang desa…" autocomplete="off" maxlength="500" />
        <button type="submit" id="cb-send" aria-label="Kirim">➤</button>
      </form>
    </div>
  `;

  const fab = document.getElementById("cb-fab");
  const panel = document.getElementById("cb-panel");
  const msgs = document.getElementById("cb-msgs");
  const chips = document.getElementById("cb-chips");
  const form = document.getElementById("cb-form");
  const input = document.getElementById("cb-input");
  const sendBtn = document.getElementById("cb-send");

  // ---------------------------------------------------------------------
  // Notice halus (tanpa mengganggu): titik merah + denyut + teaser bubble.
  // Hilang permanen setelah pengunjung pernah membuka chat (localStorage),
  // jadi hanya menarik perhatian pengunjung BARU.
  // ---------------------------------------------------------------------
  const LS_SEEN = "cb_seen";
  let seen = false;
  try { seen = localStorage.getItem(LS_SEEN) === "1"; } catch { /* abaikan */ }

  function addNotice() {
    if (seen) return;
    fab.classList.add("pulse");
    const dot = document.createElement("span");
    dot.className = "cb-fab-dot";
    fab.appendChild(dot);

    // Teaser muncul setelah jeda singkat, hilang otomatis ±8 detik
    setTimeout(() => {
      if (panel.classList.contains("show") || seen) return;
      const t = document.createElement("div");
      t.className = "cb-teaser";
      t.innerHTML =
        '<button class="cb-teaser-close" aria-label="Tutup notifikasi">×</button>' +
        "<strong>Tanya Desa 🤖</strong><br>Coba tanya apa saja tentang desa ini — saya jawab instan!";
      const dismiss = () => { try { localStorage.setItem(LS_SEEN, "1"); } catch {} t.remove(); };
      t.querySelector(".cb-teaser-close").addEventListener("click", (e) => { e.stopPropagation(); dismiss(); });
      t.addEventListener("click", () => openPanel());
      root.appendChild(t);
      setTimeout(() => { if (t.isConnected) dismiss(); }, 8000);
    }, 3500);
  }

  function markSeen() {
    if (seen) return;
    seen = true;
    try { localStorage.setItem(LS_SEEN, "1"); } catch { /* abaikan */ }
    fab.classList.remove("pulse");
    const d = fab.querySelector(".cb-fab-dot");
    if (d) d.remove();
    const t = root.querySelector(".cb-teaser");
    if (t) t.remove();
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = "cb-bubble " + (role === "user" ? "cb-me" : "cb-bot");
    div.innerHTML = esc(text).replace(/\n/g, "<br>");
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function typing(on) {
    let t = document.getElementById("cb-typing");
    if (on && !t) {
      t = document.createElement("div");
      t.id = "cb-typing";
      t.className = "cb-bubble cb-bot cb-typing";
      t.innerHTML = "<span></span><span></span><span></span>";
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (!on && t) t.remove();
  }

  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }

  // ---------------------------------------------------------------------
  // Buka / tutup panel
  // ---------------------------------------------------------------------
  function openPanel() {
    markSeen();
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    fab.classList.add("hidden");
    const t = root.querySelector(".cb-teaser");
    if (t) t.remove();
    if (msgs.children.length === 0) addBubble("assistant",
      "Halo! 👋 Saya Tanya Desa, asisten AI website desa ini. Tanyakan apa saja seputar profil, perangkat desa, UMKM, berita, agenda, atau urusan surat — saya siap membantu!");
    setTimeout(() => input.focus(), 250);
    if (typeof window.gsap !== "undefined") {
      gsap.fromTo(panel, { opacity: 0, y: 30, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.3)", clearProps: "opacity,transform" });
    }
  }
  function closePanel() {
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    fab.classList.remove("hidden");
  }

  fab.addEventListener("click", openPanel);
  document.getElementById("cb-close").addEventListener("click", closePanel);
  addNotice();

  chips.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn || busy) return;
    input.value = btn.dataset.q;
    form.dispatchEvent(new Event("submit"));
  });

  // ---------------------------------------------------------------------
  // Kirim pertanyaan
  // ---------------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const q = input.value.trim();
    if (!q) return;

    const now = Date.now();
    if (now - lastSend < MIN_GAP_MS) { addBubble("assistant", "Sabar sedikit ya 😊 — jeda sebentar antar pertanyaan."); return; }
    if (dailyCount() >= DAILY_LIMIT) {
      addBubble("assistant", "Kuota tanya-jawab harian sudah habis (maks " + DAILY_LIMIT + "/hari). Silakan coba lagi besok ya 🙏");
      return;
    }

    input.value = "";
    addBubble("user", q);
    history.push({ role: "user", content: q });
    setBusy(true);
    typing(true);
    lastSend = now;

    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      });
      const data = await r.json().catch(() => ({}));

      typing(false);
      if (!r.ok || !data.reply) {
        addBubble("assistant", data.error || "Maaf, terjadi gangguan saat memproses pertanyaan. Coba lagi beberapa saat ya 🙏");
      } else {
        addBubble("assistant", data.reply);
        history.push({ role: "assistant", content: data.reply });
        bumpDaily();
      }
    } catch {
      typing(false);
      addBubble("assistant", "Koneksi bermasalah 😔 Pastikan internet aktif lalu coba lagi.");
    } finally {
      setBusy(false);
      input.focus();
    }
  });
})();
