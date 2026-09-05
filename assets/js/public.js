// =====================================================================
// public.js - Site publik: fetch data dari Supabase & render ke halaman
// Upgrade v2: detail lengkap + modal popup + galeri foto
// =====================================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Escape HTML agar data aman dari injection
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Ambil URL publik foto dari storage
function imgUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Format tanggal Indonesia (aman: fallback ke nilai asli bila gagal)
function fmtTanggal(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Ubah teks multi-baris menjadi paragraf
function toParagraf(str) {
  return String(str || "").split(/\n+/).filter(Boolean).map(p =>
    `<p class="modal-par">${esc(p)}</p>`
  ).join("");
}

// Tampilkan view section tertentu, sembunyikan hero & menu
async function openSection(sectionId) {
  document.getElementById("hero").style.display = "none";
  document.querySelector(".section-title").style.display = "none";
  document.getElementById("menu-grid").style.display = "none";
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);

  // Update status tombol navigasi bawah seluler
  document.querySelectorAll(".mobile-bottom-nav .nav-btn").forEach(btn => {
    if (btn.dataset.navSection === sectionId) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  await ensureLoaded(sectionId);
  revealSection(target);
}

function backToMenu() {
  document.getElementById("hero").style.display = "block";
  document.querySelector(".section-title").style.display = "block";
  document.getElementById("menu-grid").style.display = "grid";
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  window.scrollTo(0, 0);

  // Reset highlight nav bawah ke Home
  document.querySelectorAll(".mobile-bottom-nav .nav-btn").forEach(btn => {
    if (btn.hasAttribute("data-back")) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

// ---------------------------------------------------------------------
// MODAL SYSTEM
// ---------------------------------------------------------------------
function openModal(html) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.querySelector(".modal-box");
  document.getElementById("modal-body").innerHTML = html;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (typeof window.gsap !== "undefined") {
    // clearProps: hapus inline style setelah animasi agar transisi CSS (opacity) tetap jalan saat ditutup
    gsap.fromTo(box, { opacity: 0, y: 26, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.4)", clearProps: "opacity,transform" });
    gsap.fromTo(overlay, { opacity: 0 },
      { opacity: 1, duration: 0.2, clearProps: "opacity" });
  }
  if (window.__onModalKeydown === undefined) {
    window.__onModalKeydown = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", window.__onModalKeydown);
  }
}

function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  const box = document.querySelector(".modal-box");
  const searchOverlay = document.getElementById("search-modal-overlay");
  
  if (overlay) {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.removeProperty("opacity");
  }
  if (box) { 
    box.style.removeProperty("opacity"); 
    box.style.removeProperty("transform"); 
  }

  // Jika search modal juga tidak aktif, kembalikan scroll body
  if (!searchOverlay || !searchOverlay.classList.contains("show")) {
    document.body.style.overflow = "";
  }
}

// Render modal (murni string) + bind tombol tutup & overlay
function bindModalHandlers() {
  const overlay = document.getElementById("modal-overlay");
  document.getElementById("modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
}

// ---------------------------------------------------------------------
// Render hero + grid menu
// ---------------------------------------------------------------------
function renderMenu() {
  const grid = document.getElementById("menu-grid");
  grid.innerHTML = MENU_ITEMS.map((m, i) => `
    <div class="menu-card tint-${i + 1}" data-section="${esc(m.section)}">
      <span class="menu-count" data-count-for="${esc(m.id)}" style="display:none"></span>
      <span class="menu-tile" aria-hidden="true"><span class="icon">${esc(m.icon)}</span></span>
      <span class="label">${esc(m.label)}</span>
      ${m.blurb ? `<span class="blurb">${esc(m.blurb)}</span>` : ""}
    </div>
  `).join("");

  grid.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("click", () => openSection(card.dataset.section));
  });
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", backToMenu));

  // Navbar web (tautan menu di atas)
  const navLinks = document.getElementById("nav-links");
  if (navLinks) {
    navLinks.innerHTML = MENU_ITEMS.map(m =>
      `<span class="nav-link" data-section="${esc(m.section)}">${esc(m.label)}</span>`
    ).join("");
    navLinks.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => openSection(link.dataset.section));
    });
  }

  loadMenuCounts();
}

// Hitung jumlah data untuk badge di kartu menu (aman bila gagal)
async function loadMenuCounts() {
  const counts = {};
  const targets = [
    { key: "perangkat", table: "perangkat_desa" },
    { key: "umkm",      table: "umkm" },
    { key: "berita",    table: "berita" },
    { key: "galeri",    table: "galeri" },
    { key: "agenda",    table: "agenda" },
    { key: "dokumen",   table: "dokumen" },
    { key: "pengaduan", table: "pengaduan" }
  ];
  await Promise.all(targets.map(async (t) => {
    try {
      const { count } = await sb.from(t.table).select("id", { count: "exact", head: true });
      if (typeof count === "number") counts[t.key] = count;
    } catch (_) { /* tabel belum ada (belum migrasi) — abaikan */ }
  }));
  document.querySelectorAll("[data-count-for]").forEach(el => {
    const n = counts[el.dataset.countFor];
    if (typeof n === "number" && n > 0) {
      el.textContent = n;
      el.style.display = "inline-flex";
    }
  });
}

// ---------------------------------------------------------------------
// STATUS OPERASIONAL KANTOR (Real-time)
// ---------------------------------------------------------------------
function updateOfficeStatus(jamLayananStr) {
  const badge = document.getElementById("office-status-badge");
  if (!badge) return;
  if (!jamLayananStr) {
    badge.className = "status-badge open";
    badge.textContent = "🟢 Layanan Buka";
    return;
  }
  const now = new Date();
  const day = now.getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  const hour = now.getHours();
  const minute = now.getMinutes();
  const nowMinutes = hour * 60 + minute;

  // Standar: Senin-Jumat (1-5), 08:00 (480) - 16:00 (960)
  const isWeekday = day >= 1 && day <= 5;
  const isOpenHours = nowMinutes >= 8 * 60 && nowMinutes < 16 * 60;

  if (isWeekday && isOpenHours) {
    badge.className = "status-badge open";
    badge.textContent = "🟢 Kantor Buka";
  } else {
    badge.className = "status-badge closed";
    badge.textContent = "🔴 Kantor Tutup";
  }
}

// ---------------------------------------------------------------------
// GLOBAL LIVE SEARCH SYSTEM
// ---------------------------------------------------------------------
function initSearchSystem() {
  const triggerBtn = document.getElementById("btn-search-trigger");
  const mobileBtn = document.getElementById("btn-search-mobile");
  const overlay = document.getElementById("search-modal-overlay");
  const closeBtn = document.getElementById("search-modal-close");
  const input = document.getElementById("global-search-input");
  const resultsContainer = document.getElementById("search-results-list");

  if (!overlay || !input) return;

  const openSearch = () => {
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => input.focus(), 100);
  };

  const closeSearch = () => {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    input.value = "";
    resultsContainer.innerHTML = `<div class="search-ph">Mulai mengetik untuk mencari berita, UMKM, perangkat, dokumen, atau agenda.</div>`;
    
    const detailOverlay = document.getElementById("modal-overlay");
    if (!detailOverlay || !detailOverlay.classList.contains("show")) {
      document.body.style.overflow = "";
    }
  };

  if (triggerBtn) triggerBtn.addEventListener("click", openSearch);
  if (mobileBtn) mobileBtn.addEventListener("click", openSearch);
  if (closeBtn) closeBtn.addEventListener("click", closeSearch);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSearch(); });

  let timer = null;
  input.addEventListener("input", (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultsContainer.innerHTML = `<div class="search-ph">Mulai mengetik untuk mencari berita, UMKM, perangkat, dokumen, atau agenda.</div>`;
      return;
    }
    timer = setTimeout(() => performGlobalSearch(q, resultsContainer, closeSearch), 250);
  });
}

async function performGlobalSearch(query, container, closeSearchCallback) {
  container.innerHTML = `<div class="spinner"></div>`;
  try {
    const [beritaRes, umkmRes, perRes, dokRes, agnRes] = await Promise.all([
      sb.from("berita").select("id, judul, kategori").ilike("judul", `%${query}%`).limit(4),
      sb.from("umkm").select("id, nama, kategori").ilike("nama", `%${query}%`).limit(4),
      sb.from("perangkat_desa").select("id, nama, jabatan").ilike("nama", `%${query}%`).limit(4),
      sb.from("dokumen").select("id, judul, file_url, kategori").ilike("judul", `%${query}%`).limit(4),
      sb.from("agenda").select("id, judul, tanggal, lokasi").ilike("judul", `%${query}%`).limit(4)
    ]);

    const items = [];
    (beritaRes.data || []).forEach(b => items.push({ type: "Berita", icon: "📰", title: b.judul, sub: b.kategori || "Berita Desa", action: () => { closeSearchCallback(); openSection("section-berita"); } }));
    (umkmRes.data || []).forEach(u => items.push({ type: "UMKM", icon: "🛍️", title: u.nama, sub: u.kategori || "UMKM", action: () => { closeSearchCallback(); openSection("section-umkm"); } }));
    (perRes.data || []).forEach(p => items.push({ type: "Perangkat", icon: "👤", title: p.nama, sub: p.jabatan, action: () => { closeSearchCallback(); openSection("section-perangkat"); } }));
    (dokRes.data || []).forEach(d => items.push({ type: "Dokumen", icon: "📄", title: d.judul, sub: d.kategori || "File", action: () => { window.open(d.file_url, "_blank"); } }));
    (agnRes.data || []).forEach(a => items.push({ type: "Agenda", icon: "📅", title: a.judul, sub: `${a.tanggal} · ${a.lokasi || "Balai Desa"}`, action: () => { closeSearchCallback(); openSection("section-agenda"); } }));

    if (items.length === 0) {
      container.innerHTML = `<div class="search-ph">Tidak ditemukan hasil untuk "${esc(query)}".</div>`;
      return;
    }

    container.innerHTML = items.map((item, idx) => `
      <div class="search-res-item" data-idx="${idx}">
        <div class="search-res-icon">${item.icon}</div>
        <div class="search-res-info">
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.type)} · ${esc(item.sub)}</p>
        </div>
        <span style="font-size:12px;color:var(--muted)">Buka →</span>
      </div>
    `).join("");

    container.querySelectorAll(".search-res-item").forEach(el => {
      el.addEventListener("click", () => {
        const item = items[el.dataset.idx];
        if (item && item.action) item.action();
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="search-ph" style="color:#d9534f">Gagal melakukan pencarian.</div>`;
  }
}

// ---------------------------------------------------------------------
// Profil Desa
// ---------------------------------------------------------------------
// Kartu statistik; angka murni (integer) dianimasi lewat data-count
function statItem(ic, val, label) {
  if (!val) return "";
  const pureNum = /^\d+$/.test(String(val).trim());
  return `
    <div class="stat-card">
      <span class="ic">${ic}</span>
      <div class="v" ${pureNum ? `data-count="${esc(val)}"` : ""}>${esc(val)}</div>
      <div class="k">${esc(label)}</div>
    </div>`;
}

// Ambil config desa SEKALI per load (dipakai hero, profil, kontak) — hindari fetch berulang
async function getSiteConfig() {
  if (window.__siteConfig) return window.__siteConfig;
  const { data } = await sb.from("site_config").select("*").eq("id", 1).single();
  if (data) window.__siteConfig = data;
  return data;
}

async function loadProfil() {
  const data = await getSiteConfig();
  const el = document.getElementById("profil-content");
  if (!data) { el.innerHTML = `<div class="empty">Data profil belum tersedia.</div>`; return; }

  const visi = data.visi, misi = data.misi;
  const potensi = (data.potensi || "").split(/[,;]/).map(s => s.trim()).filter(Boolean);

  el.innerHTML = `
    <div class="profil-hero">
      ${data.logo_url ? `<img class="profil-logo" src="${esc(imgUrl(data.logo_url))}" alt="${esc(data.village_name)}" />` : `<div class="profil-logo">🏡</div>`}
      <h3>${esc(data.village_name) || "Desa"}</h3>
      ${data.motto ? `<p class="motto">${esc(data.motto)}</p>` : ""}
      ${data.tahun_berdiri ? `<span class="badge">🗓️ Berdiri ${esc(data.tahun_berdiri)}</span>` : ""}
    </div>

    <div class="stat-grid">
      ${statItem("🗺️", data.luas_wilayah, "Luas Wilayah")}
      ${statItem("👥", data.jumlah_penduduk, "Penduduk")}
      ${statItem("🏘️", data.jumlah_kepala_keluarga, "Kepala Keluarga")}
      ${statItem("🗓️", data.tahun_berdiri, "Berdiri")}
    </div>

    ${(visi || misi) ? `<div class="vm-grid">
      ${visi ? `<div class="vm-card visi"><div class="vm-label">✨ Visi</div><p>${esc(visi)}</p></div>` : ""}
      ${misi ? `<div class="vm-card misi"><div class="vm-label">🎯 Misi</div>${toParagraf(misi)}</div>` : ""}
    </div>` : ""}

    ${data.sejarah ? `<div class="profil-block">
      <h3>📜 Sejarah Desa</h3>
      <p>${esc(data.sejarah)}</p>
    </div>` : ""}

    ${potensi.length ? `<div class="profil-block">
      <h3>🌱 Potensi Desa</h3>
      <div class="chip-wrap">${potensi.map(p => `<span class="chip">${esc(p)}</span>`).join("")}</div>
    </div>` : ""}

    ${data.alamat_kantor ? `<div class="profil-block">
      <h3>🏢 Alamat Kantor</h3>
      <p>${esc(data.alamat_kantor)}</p>
    </div>` : ""}

    ${data.maps_url ? `<div class="profil-block">
      <h3>🗺️ Lokasi Desa</h3>
      <iframe class="map-frame" src="${esc(data.maps_url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>` : ""}
  `;
}

// ---------------------------------------------------------------------
// Perangkat Desa
// ---------------------------------------------------------------------
async function loadPerangkat() {
  const { data } = await sb.from("perangkat_desa").select("*").order("sort_order");
  const el = document.getElementById("perangkat-content");
  if (!data || data.length === 0) { el.innerHTML = `<div class="empty">Belum ada data perangkat desa.</div>`; return; }

  const kades = data.find(p => p.is_kades) || null;
  const others = data.filter(p => p !== kades);

  let html = "";
  if (kades) {
    html += `
      <div class="card card-kades" data-open="${esc(kades.id)}" role="button" tabindex="0">
        <div class="kades-avatar">
          ${kades.foto_url ? `<img src="${esc(imgUrl(kades.foto_url))}" alt="${esc(kades.nama)}" />` : `<div class="avatar">👨‍💼</div>`}
        </div>
        <div class="kades-info">
          <span class="badge">Kepala Desa</span>
          <h3>${esc(kades.nama)}</h3>
          ${kades.periode ? `<div class="meta">Periode ${esc(kades.periode)}</div>` : ""}
          <div class="kades-hint">👆 Klik untuk lihat tugas</div>
        </div>
      </div>`;
  }

  html += `<div class="cards">` + others.map(p => `
    <div class="card card-person" data-open="${esc(p.id)}" role="button" tabindex="0">
      <div class="body">
        ${p.foto_url ? `<img class="avatar-lg" src="${esc(imgUrl(p.foto_url))}" alt="${esc(p.nama)}" />` : `<div class="avatar-lg">👤</div>`}
        <h3>${esc(p.nama)}</h3>
        <div class="badge">${esc(p.jabatan)}</div>
        ${p.periode ? `<div class="meta">Periode: ${esc(p.periode)}</div>` : ""}
        ${p.tugas ? `<div class="desc line-clamp-2">${esc(p.tugas)}</div>` : ""}
        <div class="view-detail">Lihat detail →</div>
      </div>
    </div>
  `).join("") + `</div>`;

  el.innerHTML = html;

  // Klik kartu → modal detail tugas
  el.querySelectorAll("[data-open]").forEach(card => {
    const open = (id) => {
      const p = data.find(x => x.id === id);
      if (!p) return;
      openModal(`
        <div class="modal-head center">
          ${p.foto_url ? `<img class="modal-avatar" src="${esc(imgUrl(p.foto_url))}" alt="${esc(p.nama)}" />` : `<div class="modal-avatar">👤</div>`}
          <h3>${esc(p.nama)}</h3>
          <div class="badge">${esc(p.jabatan)}</div>
          ${p.periode ? `<div class="meta">Periode: ${esc(p.periode)}</div>` : ""}
        </div>
        ${p.tugas ? `<div class="modal-block"><h4>📋 Tugas & Fungsi</h4><p class="modal-par">${esc(p.tugas)}</p></div>` : ""}
      `);
    };
    card.addEventListener("click", () => open(card.dataset.open));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(card.dataset.open); });
  });
}

// ---------------------------------------------------------------------
// UMKM Desa
// ---------------------------------------------------------------------
let umkmData = [];
let umkmKategori = ["Semua"];
let umkmFilter = "Semua";

async function loadUmkm() {
  const { data } = await sb.from("umkm").select("*").order("sort_order");
  const el = document.getElementById("umkm-content");
  if (!data || data.length === 0) { el.innerHTML = `<div class="empty">Belum ada data UMKM.</div>`; return; }

  umkmData = data;
  umkmKategori = ["Semua", ...Array.from(new Set(data.map(u => u.kategori).filter(Boolean)))];
  umkmFilter = "Semua";

  el.innerHTML = `
    <div class="chip-filter-wrap" id="umkm-filters"></div>
    <div class="cards umkm-grid" id="umkm-cards"></div>
  `;

  renderUmkmFilters();
  renderUmkmCards();
}

function renderUmkmFilters() {
  const wrap = document.getElementById("umkm-filters");
  if (!wrap) return;
  wrap.innerHTML = umkmKategori.map(k => `
    <button class="chip-filter ${k === umkmFilter ? "active" : ""}" data-kat="${esc(k)}">${esc(k)}</button>
  `).join("");
  wrap.querySelectorAll(".chip-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      umkmFilter = btn.dataset.kat;
      renderUmkmFilters();
      renderUmkmCards();
    });
  });
}

function renderUmkmCards() {
  const grid = document.getElementById("umkm-cards");
  if (!grid) return;
  const list = umkmFilter === "Semua" ? umkmData : umkmData.filter(u => u.kategori === umkmFilter);
  grid.innerHTML = list.map(u => `
    <div class="card card-umkm" data-open="${esc(u.id)}" role="button" tabindex="0">
      ${u.foto_url ? `<img class="thumb" src="${esc(imgUrl(u.foto_url))}" alt="${esc(u.nama)}" />` : `<div class="thumb thumb-ph">🛍️</div>`}
      <div class="body">
        ${u.kategori ? `<span class="badge">${esc(u.kategori)}</span>` : ""}
        <h3>${esc(u.nama)}</h3>
        ${u.pemilik ? `<div class="meta">Pemilik: ${esc(u.pemilik)}</div>` : ""}
        ${u.deskripsi ? `<div class="desc line-clamp-2">${esc(u.deskripsi)}</div>` : ""}
        <div class="view-detail">Lihat detail →</div>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-open]").forEach(card => {
    const open = (id) => {
      const u = umkmData.find(x => x.id === id);
      if (!u) return;
      const wa = u.kontak ? `https://wa.me/${esc(u.kontak.replace(/[^0-9]/g, ""))}` : "";
      const maps = u.maps_url && u.maps_url.startsWith("http") ? u.maps_url : "";
      openModal(`
        <div class="modal-head">
          <div>
            ${u.kategori ? `<span class="badge">${esc(u.kategori)}</span>` : ""}
            <h3>${esc(u.nama)}</h3>
            ${u.pemilik ? `<div class="meta">Pemilik: ${esc(u.pemilik)}</div>` : ""}
          </div>
        </div>
        ${u.foto_url ? `<img class="modal-cover" src="${esc(imgUrl(u.foto_url))}" alt="${esc(u.nama)}" />` : `<div class="modal-cover ph">🛍️</div>`}
        ${u.deskripsi ? `<div class="modal-block"><p class="modal-par">${esc(u.deskripsi)}</p></div>` : ""}
        <div class="modal-info">
          ${u.alamat ? `<div class="row"><span class="ic">📍</span><span>${esc(u.alamat)}</span></div>` : ""}
          ${u.jam_buka ? `<div class="row"><span class="ic">🕒</span><span>${esc(u.jam_buka)}</span></div>` : ""}
          ${u.kontak ? `<div class="row"><span class="ic">📞</span><span>${esc(u.kontak)}</span></div>` : ""}
        </div>
        ${(wa || maps) ? `<div class="modal-actions">
          ${wa ? `<a class="btn whatsapp" href="${wa}" target="_blank">💬 Chat WhatsApp</a>` : ""}
          ${maps ? `<a class="btn secondary" href="${maps}" target="_blank">📍 Buka di Maps</a>` : ""}
        </div>` : ""}
      `);
    };
    card.addEventListener("click", () => open(card.dataset.open));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(card.dataset.open); });
  });
}

// ---------------------------------------------------------------------
// Berita Terkini (Antara News RSS via rss2json — dengan foto)
// ---------------------------------------------------------------------
// Antara menyertakan gambar di RSS-nya; CORS-friendly via rss2json
const NEWS_SOURCES = [
  "https://www.antaranews.com/rss/terkini.xml",
  "https://news.google.com/rss/search?q=desa+indonesia&hl=id-ID&gl=ID&ceid=ID:id"
];
const NEWS_API = (rss) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}&count=12`;

// Ekstrak gambar dari beragam field RSS
function extractImg(a) {
  if (a.thumbnail && a.thumbnail.startsWith("http")) return a.thumbnail;
  if (a.enclosure && a.enclosure.link && a.enclosure.link.startsWith("http")) return a.enclosure.link;
  // Cari <img> di dalam content HTML
  if (a.content) {
    const m = a.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1].startsWith("http")) return m[1];
  }
  // Cari URL gambar di description
  if (a.description) {
    const m = a.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1].startsWith("http")) return m[1];
  }
  return "";
}

async function loadBerita() {
  const el = document.getElementById("berita-content");
  el.innerHTML = `<div class="spinner"></div>`;

  let items = [];
  for (const rss of NEWS_SOURCES) {
    try {
      const res = await fetch(NEWS_API(rss));
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status === "ok" && json.items && json.items.length > 0) {
        items = json.items;
        break;
      }
    } catch (_) { continue; }
  }

  if (items.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📰</div>Gagal memuat berita terkini.<br><small style="color:var(--muted)">Periksa koneksi internet Anda.</small></div>`;
    return;
  }

  const [featured, ...rest] = items;

  const renderCard = (a, isFeatured = false) => {
    const rawTitle = a.title || "(Tanpa Judul)";
    const judul = rawTitle.replace(/\s-\s[^-]+$/, "").trim();
    const sumber = a.author || a.feed_url || (rawTitle.includes(" - ") ? rawTitle.split(" - ").pop().trim() : "Antara News");
    const tanggal = a.pubDate ? fmtTanggal(a.pubDate) : "";
    const rawDesc = a.description ? a.description.replace(/<[^>]*>/g, "").trim() : "";
    const desc = rawDesc.substring(0, 200);
    const img = extractImg(a);
    const url = a.link || "#";

    if (isFeatured) {
      return `
        <a class="card card-featured gnews-link" href="${esc(url)}" target="_blank" rel="noopener">
          ${img
            ? `<img class="thumb" src="${esc(img)}" alt="${esc(judul)}" onerror="this.outerHTML='<div class=\\'thumb thumb-ph featured-ph\\'>📰</div>'" />`
            : `<div class="thumb thumb-ph featured-ph">📰</div>`}
          <div class="body">
            <div class="badge-row">
              ${sumber ? `<span class="badge">${esc(sumber)}</span>` : ""}
              <span class="badge badge-new">Terkini</span>
            </div>
            <h3>${esc(judul)}</h3>
            ${tanggal ? `<div class="meta">📅 ${tanggal}</div>` : ""}
            ${desc ? `<div class="desc line-clamp-3">${esc(desc)}</div>` : ""}
            <div class="view-detail">Baca selengkapnya ↗</div>
          </div>
        </a>`;
    }
    return `
      <a class="card card-berita gnews-link" href="${esc(url)}" target="_blank" rel="noopener">
        ${img
          ? `<img class="thumb" src="${esc(img)}" alt="${esc(judul)}" onerror="this.outerHTML='<div class=\\'thumb thumb-ph\\'>📰</div>'" />`
          : `<div class="thumb thumb-ph">📰</div>`}
        <div class="body">
          ${sumber ? `<span class="badge">${esc(sumber)}</span>` : ""}
          <h3>${esc(judul)}</h3>
          ${tanggal ? `<div class="meta">📅 ${tanggal}</div>` : ""}
          ${desc ? `<div class="desc line-clamp-2">${esc(desc)}</div>` : ""}
          <div class="view-detail">Baca ↗</div>
        </div>
      </a>`;
  };

  el.innerHTML = `
    <div class="gnews-notice">📡 Berita terkini dari ANTARA · Diperbarui ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</div>
    ${renderCard(featured, true)}
    <div class="cards">
      ${rest.map(a => renderCard(a)).join("")}
    </div>`;
}

// ---------------------------------------------------------------------
// Agenda Desa
// ---------------------------------------------------------------------
async function loadAgenda() {
  const el = document.getElementById("agenda-content");
  let data;
  try {
    const res = await sb.from("agenda").select("*").order("tanggal", { ascending: true });
    data = res.data;
  } catch (_) { data = null; }

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>Belum ada agenda kegiatan mendatang.</div>`;
    return;
  }

  el.innerHTML = `<div class="agenda-list">` + data.map(a => {
    const d = new Date(a.tanggal || Date.now());
    const day = isNaN(d.getTime()) ? "1" : d.getDate();
    const month = isNaN(d.getTime()) ? "Bbl" : d.toLocaleDateString("id-ID", { month: "short" });
    const fotoUrl = a.foto_url ? imgUrl(a.foto_url) : "";
    return `
      <div class="agenda-card">
        <div class="agenda-date-box">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="agenda-info">
          ${a.kategori ? `<span class="badge">${esc(a.kategori)}</span>` : ""}
          <h3>${esc(a.judul)}</h3>
          <div class="meta-row">
            ${a.waktu ? `<span>🕒 ${esc(a.waktu)}</span>` : ""}
            ${a.lokasi ? `<span>📍 ${esc(a.lokasi)}</span>` : ""}
          </div>
          ${a.deskripsi ? `<p style="font-size:13.5px;color:var(--text);margin-top:4px">${esc(a.deskripsi)}</p>` : ""}
          ${fotoUrl ? `<img class="agenda-foto" src="${esc(fotoUrl)}" alt="${esc(a.judul)}" loading="lazy" />` : ""}
        </div>
      </div>
    `;
  }).join("") + `</div>`;
}

// ---------------------------------------------------------------------
// Dokumen & Surat Layanan
// ---------------------------------------------------------------------
async function loadDokumen() {
  const el = document.getElementById("dokumen-content");
  let data;
  try {
    const res = await sb.from("dokumen").select("*").order("sort_order");
    data = res.data;
  } catch (_) { data = null; }

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📄</div>Belum ada dokumen publik.</div>`;
    return;
  }

  el.innerHTML = `<div class="dokumen-grid">` + data.map(d => `
    <div class="dokumen-card">
      <div class="dokumen-left">
        <div class="dokumen-icon">📄</div>
        <div class="dokumen-info">
          <h4>${esc(d.judul)}</h4>
          <p>${esc(d.kategori || "Dokumen")} ${d.ukuran ? `· ${esc(d.ukuran)}` : ""}</p>
          ${d.deskripsi ? `<p style="font-size:12px;margin-top:2px">${esc(d.deskripsi)}</p>` : ""}
        </div>
      </div>
      <a class="btn-download" href="${esc(d.file_url)}" target="_blank" download>⬇ Unduh</a>
    </div>
  `).join("") + `</div>`;
}

// ---------------------------------------------------------------------
// Pengaduan Warga
// ---------------------------------------------------------------------
async function loadPengaduan() {
  const el = document.getElementById("pengaduan-content");
  el.innerHTML = `
    <div class="form-pengaduan">
      <h3 style="margin-bottom:14px;color:var(--accent-dark)">📝 Kirim Aspirasi / Pengaduan</h3>
      <form id="public-pengaduan-form">
        <div class="field"><label>Nama Lengkap</label><input id="pg_nama" required placeholder="Nama Anda" /></div>
        <div class="field"><label>No. HP / WA (Opsional)</label><input id="pg_kontak" placeholder="08xxxxxxxxxx" /></div>
        <div class="field"><label>Subjek / Judul Laporan</label><input id="pg_subjek" required placeholder="mis. Jalan Rusak Dusun 1" /></div>
        <div class="field"><label>Isi Aspirasi / Pengaduan</label><textarea id="pg_isi" required placeholder="Tuliskan secara jelas detail laporan Anda..." style="height:110px"></textarea></div>
        <button class="btn full" type="submit" style="margin-top:10px">Kirim Pengaduan</button>
      </form>
      <div id="pg-msg" style="margin-top:10px;text-align:center;font-size:13.5px;font-weight:600"></div>
    </div>
    <div class="pengaduan-status-box" id="public-pengaduan-list">
      <h3 style="margin-bottom:12px">📢 Status Laporan Terbaru Warga</h3>
      <div id="pg-recent-items"><div class="spinner"></div></div>
    </div>
  `;

  document.getElementById("public-pengaduan-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("pg-msg");
    msg.textContent = "Mengirim...";
    msg.style.color = "var(--muted)";

    const payload = {
      nama: document.getElementById("pg_nama").value.trim(),
      kontak: document.getElementById("pg_kontak").value.trim(),
      subjek: document.getElementById("pg_subjek").value.trim(),
      isi: document.getElementById("pg_isi").value.trim(),
      status: "Pending"
    };

    try {
      const { error } = await sb.from("pengaduan").insert([payload]);
      if (error) throw error;
      msg.textContent = "✅ Terima kasih! Pengaduan Anda berhasil terkirim dan akan ditindaklanjuti oleh perangkat desa.";
      msg.style.color = "var(--accent)";
      document.getElementById("public-pengaduan-form").reset();
      loadRecentPengaduan();
    } catch (err) {
      msg.textContent = "❌ Gagal mengirim pengaduan: " + err.message;
      msg.style.color = "#d9534f";
    }
  });

  loadRecentPengaduan();
}

async function loadRecentPengaduan() {
  const container = document.getElementById("pg-recent-items");
  if (!container) return;
  try {
    const { data } = await sb.from("pengaduan").select("subjek, isi, status, tanggapan, created_at").order("created_at", { ascending: false }).limit(5);
    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty">Belum ada laporan warga.</div>`;
      return;
    }
    container.innerHTML = data.map(p => `
      <div class="pengaduan-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:14px">${esc(p.subjek)}</strong>
          <span class="badge-status ${esc(p.status.toLowerCase())}">${esc(p.status)}</span>
        </div>
        <p style="font-size:13px;color:var(--text);margin-bottom:6px">${esc(p.isi)}</p>
        ${p.tanggapan ? `<div style="background:var(--card);padding:8px 12px;border-radius:8px;font-size:12.5px;color:var(--accent-dark)"><strong>Tanggapan Admin:</strong> ${esc(p.tanggapan)}</div>` : ""}
      </div>
    `).join("");
  } catch (_) {
    container.innerHTML = `<div class="empty">Fitur pengaduan siap dipakai setelah migrasi v3.</div>`;
  }
}

// ---------------------------------------------------------------------
// Galeri Foto
// ---------------------------------------------------------------------
async function loadGaleri() {
  const el = document.getElementById("galeri-content");
  let data;
  try {
    const res = await sb.from("galeri").select("*").order("sort_order");
    data = res.data;
  } catch (_) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🖼️</div>Galeri foto belum tersedia.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🖼️</div>Belum ada foto di galeri.</div>`;
    return;
  }

  el.innerHTML = `<div class="galeri-grid">` + data.map(g => `
    <div class="galeri-item" data-open="${esc(g.id)}" role="button" tabindex="0">
      ${g.foto_url ? `<img src="${esc(imgUrl(g.foto_url))}" alt="${esc(g.judul || "Foto")}" loading="lazy" />`
                    : `<div class="galeri-ph">🖼️</div>`}
      <div class="galeri-cap">
        ${g.kategori ? `<span class="badge">${esc(g.kategori)}</span>` : ""}
        <h4>${esc(g.judul || "Tanpa judul")}</h4>
        ${g.tanggal ? `<div class="meta">${fmtTanggal(g.tanggal)}</div>` : ""}
      </div>
    </div>
  `).join("") + `</div>`;

  el.querySelectorAll("[data-open]").forEach(item => {
    const open = (id) => {
      const g = data.find(x => x.id === id);
      if (!g) return;
      const src = g.foto_url ? imgUrl(g.foto_url) : "";
      openModal(`
        ${src ? `<img class="lightbox" src="${esc(src)}" alt="${esc(g.judul || "Foto")}" />`
              : `<div class="lightbox-ph">🖼️</div>`}
        ${(g.judul || g.deskripsi || g.kategori || g.tanggal) ? `<div class="modal-block lightbox-cap">
          ${g.kategori ? `<span class="badge">${esc(g.kategori)}</span>` : ""}
          ${g.judul ? `<h3>${esc(g.judul)}</h3>` : ""}
          ${g.tanggal ? `<div class="meta">📅 ${fmtTanggal(g.tanggal)}</div>` : ""}
          ${g.deskripsi ? `<p class="modal-par">${esc(g.deskripsi)}</p>` : ""}
        </div>` : ""}
      `);
    };
    item.addEventListener("click", () => open(item.dataset.open));
    item.addEventListener("keydown", (e) => { if (e.key === "Enter") open(item.dataset.open); });
  });
}

// ---------------------------------------------------------------------
// Kontak & Lokasi
// ---------------------------------------------------------------------
async function loadKontak() {
  const data = await getSiteConfig();
  const el = document.getElementById("kontak-content");
  if (!data) { el.innerHTML = `<div class="empty">Data kontak belum tersedia.</div>`; return; }

  const wa = data.telepon ? `https://wa.me/${esc(data.telepon.replace(/[^0-9]/g, ""))}` : "";
  const fb = data.facebook ? (data.facebook.startsWith("http") ? data.facebook : `https://facebook.com/${data.facebook}`) : "";
  const ig = data.instagram ? (data.instagram.startsWith("http") ? data.instagram : `https://instagram.com/${data.instagram}`) : "";

  el.innerHTML = `
    <div class="contact-box">
      <h3>📞 Hubungi Desa</h3>
      ${data.alamat_kantor ? `<div class="row"><span class="ic">🏢</span><span>${esc(data.alamat_kantor)}</span></div>` : ""}
      ${data.telepon ? `<div class="row"><span class="ic">📱</span><a href="${wa}" target="_blank">${esc(data.telepon)}</a></div>` : ""}
      ${data.email ? `<div class="row"><span class="ic">✉️</span><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></div>` : ""}
      ${data.jam_layanan ? `<div class="row"><span class="ic">🕒</span><span>${esc(data.jam_layanan)}</span></div>` : ""}
      ${wa ? `<a class="btn whatsapp" href="${wa}" target="_blank">💬 Chat WhatsApp Desa</a>` : ""}
    </div>
    ${data.maps_url ? `<div class="contact-box">
      <h3>📍 Lokasi Desa</h3>
      <iframe class="map-frame" src="${esc(data.maps_url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>` : ""}
    ${(fb || ig) ? `<div class="contact-box">
      <h3>🌐 Media Sosial</h3>
      <div class="soc-btns">
        ${fb ? `<a class="btn soc" href="${fb}" target="_blank">📘 Facebook Desa</a>` : ""}
        ${ig ? `<a class="btn soc" href="${ig}" target="_blank">📸 Instagram Desa</a>` : ""}
      </div>
    </div>` : ""}
  `;
}

// ---------------------------------------------------------------------
// ANIMASI (GSAP) - aman jika gsap tidak tersedia
// ---------------------------------------------------------------------
function reduceMotion() {
  return typeof window.matchMedia !== "undefined" &&
         window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateCounter(el) {
  const raw = (el.dataset.count || "").trim();
  if (!raw) return;
  if (!/^\d+$/.test(raw)) { el.textContent = raw; return; }
  const target = parseInt(raw, 10);
  const render = v => el.textContent = v >= 10000 ? v.toLocaleString("id-ID") : String(v);
  if (typeof window.gsap === "undefined" || reduceMotion()) { render(target); return; }
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target, duration: 1.1, ease: "power2.out",
    onUpdate: () => render(Math.round(obj.v))
  });
}

function revealSection(target) {
  if (typeof window.gsap === "undefined" || reduceMotion() || !target) return;
  const cards = target.querySelectorAll(".card, .profil-block, .contact-box, .stat-card, .vm-card, .view-head, .agenda-card, .dokumen-card, .form-pengaduan");
  gsap.fromTo(target, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
  gsap.fromTo(cards, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, delay: 0.1, ease: "power2.out" });
  target.querySelectorAll(".stat-card .v[data-count]").forEach(el => animateCounter(el));
}

function initAnimations() {
  if (typeof window.gsap === "undefined" || reduceMotion()) return;

  gsap.to(".blob-1", { x: 40, y: 30, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".blob-2", { x: -50, y: -20, duration: 11, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".blob-3", { x: -30, y: 40, duration: 13, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".blob-4", { x: 30, y: -30, duration: 15, repeat: -1, yoyo: true, ease: "sine.inOut" });

  const decor = document.querySelector(".bg-decor");
  if (decor && window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("mousemove", (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5);
      const cy = (e.clientY / window.innerHeight - 0.5);
      gsap.to(".blob-1", { xPercent: cx * 12, yPercent: cy * 12, duration: 1.2, ease: "power2.out" });
      gsap.to(".blob-2", { xPercent: cx * -10, yPercent: cy * -10, duration: 1.2, ease: "power2.out" });
      gsap.to(".blob-3", { xPercent: cx * 16, yPercent: cy * 16, duration: 1.2, ease: "power2.out" });
      gsap.to(".blob-4", { xPercent: cx * -14, yPercent: cy * -14, duration: 1.2, ease: "power2.out" });
    });
  }

  const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
  heroTl.from(".hero .logo", { y: -20, scale: 0.6, opacity: 0, duration: 0.7 })
        .from(".hero h1", { y: 20, opacity: 0, duration: 0.6 }, "-=0.3")
        .from(".hero .motto", { y: 14, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".hero-scroll", { opacity: 0, duration: 0.4 }, "-=0.2");

  gsap.from(".menu-card", {
    y: 24, opacity: 0, scale: 0.9, duration: 0.5, stagger: 0.08, ease: "back.out(1.6)", delay: 0.3
  });
  gsap.from(".section-title", { x: -16, opacity: 0, duration: 0.5, delay: 0.2 });

  document.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("mouseenter", () => gsap.to(card, { scale: 1.04, duration: 0.2 }));
    card.addEventListener("mouseleave", () => gsap.to(card, { scale: 1, duration: 0.2 }));
  });
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
async function init() {
  renderMenu();
  bindModalHandlers();
  initSearchSystem();

  // Mobile Bottom Nav Binding
  document.querySelectorAll(".mobile-bottom-nav [data-nav-section]").forEach(btn => {
    btn.addEventListener("click", () => openSection(btn.dataset.navSection));
  });

  const data = await getSiteConfig();
  if (data) {
    document.getElementById("hero-name").textContent = data.village_name || "Desa";
    document.getElementById("hero-motto").textContent = data.motto || "";
    document.getElementById("nav-name").textContent = data.village_name || "Desa";
    updateOfficeStatus(data.jam_layanan);

    if (data.logo_url) {
      const url = `url(${esc(imgUrl(data.logo_url))})`;
      const heroLogo = document.getElementById("hero-logo");
      heroLogo.textContent = "";
      heroLogo.style.backgroundImage = url;
      heroLogo.style.backgroundSize = "cover";
      heroLogo.style.backgroundPosition = "center";
      const navLogo = document.getElementById("nav-logo");
      navLogo.textContent = "";
      navLogo.style.backgroundImage = url;
      navLogo.style.backgroundSize = "cover";
      navLogo.style.backgroundPosition = "center";
    }
    if (data.foto_desa) {
      const hb = document.getElementById("hero-bg");
      hb.style.backgroundImage = `url(${esc(imgUrl(data.foto_desa))})`;
    }
    if (data.accent_color) {
      document.documentElement.style.setProperty("--accent", data.accent_color);
      const dark = shade(data.accent_color, -0.18);
      document.documentElement.style.setProperty("--accent-dark", dark);
    }
  } else {
    document.getElementById("hero-name").textContent = "Desa";
    document.getElementById("nav-name").textContent = "Desa";
    updateOfficeStatus(null);
  }

  const loaders = {
    "section-profil": loadProfil,
    "section-perangkat": loadPerangkat,
    "section-umkm": loadUmkm,
    "section-berita": loadBerita,
    "section-agenda": loadAgenda,
    "section-dokumen": loadDokumen,
    "section-pengaduan": loadPengaduan,
    "section-galeri": loadGaleri,
    "section-kontak": loadKontak
  };
  const loaded = {};
  window.ensureLoaded = async function(sectionId) {
    if (loaded[sectionId] && loaders[sectionId]) return;
    loaded[sectionId] = true;
    if (loaders[sectionId]) await loaders[sectionId]();
  };

  initAnimations();
}

function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.round(r * (1 + percent)); g = Math.round(g * (1 + percent)); b = Math.round(b * (1 + percent));
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

init();
