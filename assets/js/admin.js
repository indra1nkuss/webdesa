// =====================================================================
// admin.js - Panel admin: auth (Supabase) + CRUD + upload foto ke storage
// =====================================================================

if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
  alert("Library Supabase tidak terbaca. Pastikan file assets/vendor/supabase.js ada & ter-load.");
  throw new Error("Supabase library missing");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
function imgUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Upload file ke storage, return path (atau null)
async function uploadImage(file, prefix) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${prefix}_${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
  if (error) { toast("Upload gagal: " + error.message); return null; }
  return path;
}

// ---------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------
document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  document.getElementById("auth-msg").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById("auth-msg").textContent = error.message; return; }
  showDash(); // langsung tampilkan dashboard setelah login berhasil
});

const btnSignup = document.getElementById("btn-signup");
if (btnSignup) {
  btnSignup.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    document.getElementById("auth-msg").textContent = "";
    if (!email || !password) { document.getElementById("auth-msg").textContent = "Isi email & password."; return; }
    const { error } = await sb.auth.signUp({ email, password });
    if (error) { document.getElementById("auth-msg").textContent = error.message; }
    else { alert("Cek email untuk verifikasi, lalu login."); }
  });
}

document.getElementById("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

// Cek session & pantau perubahan auth (login/logout) — cukup SATU kali,
// menghindari showDash()/bindTabs() ganda yang membuat listener & fetch dobel.
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) showDash();
})();
sb.auth.onAuthStateChange((_event, session) => {
  if (session) showDash();
});

function showDash() {
  // Hindari inisialisasi ganda jika dipanggil dari login + onAuthStateChange
  if (window.__dashReady) return;
  window.__dashReady = true;
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("dash-screen").style.display = "block";
  if (typeof window.gsap !== "undefined") {
    gsap.from(".sidebar", { x: -20, opacity: 0, duration: 0.5, ease: "power2.out" });
    gsap.from(".sidebar .nav-item", { x: -12, opacity: 0, duration: 0.4, stagger: 0.06, ease: "power2.out", delay: 0.1 });
    gsap.from(".topbar", { y: -12, opacity: 0, duration: 0.5, ease: "power2.out", delay: 0.15 });
    gsap.from(".tab-panel.active", { opacity: 0, y: 14, duration: 0.45, ease: "power2.out", delay: 0.2 });
  }
  bindTabs();
  loadProfilForm();
  loadPerangkat();
  loadUmkm();
  loadBerita();
  loadAgenda();
  loadDokumen();
  loadPengaduan();
  loadGaleri();
}

// ---------------------------------------------------------------------
// TABS (sidebar nav)
// ---------------------------------------------------------------------
function bindTabs() {
  const titleMap = {
    profil: "Profil Desa",
    perangkat: "Perangkat Desa",
    umkm: "UMKM Desa",
    berita: "Berita & Pengumuman",
    agenda: "Agenda Desa",
    dokumen: "Dokumen & Surat",
    pengaduan: "Pengaduan Warga",
    galeri: "Galeri Foto"
  };
  const items = document.querySelectorAll(".nav-item");
  if (items.length && items[0].dataset.tabsBound) return;
  items.forEach(tab => { tab.dataset.tabsBound = "1"; });
  items.forEach(tab => {
    tab.addEventListener("click", () => {
      items.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById("tab-" + tab.dataset.tab);
      if (panel) panel.classList.add("active");
      document.getElementById("dash-title").textContent = titleMap[tab.dataset.tab] || "Admin";
      if (typeof window.gsap !== "undefined") {
        gsap.fromTo(panel, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
      }
    });
  });
}

// ---------------------------------------------------------------------
// AGENDA DESA (CRUD)
// ---------------------------------------------------------------------
async function loadAgenda() {
  const tb = document.querySelector("#table-agenda tbody");
  if (!tb) return;
  let data;
  try {
    const res = await sb.from("agenda").select("*").order("tanggal", { ascending: true });
    data = res.data;
  } catch (_) {
    tb.innerHTML = `<tr><td class="empty">Jalankan migration_v3.sql di Supabase.</td></tr>`;
    return;
  }
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada agenda</td></tr>`; return; }
  tb.innerHTML = data.map(a => `
    <tr>
      <td>📅</td>
      <td><b>${esc(a.judul)}</b><br><span style="color:var(--muted)">${esc(a.tanggal)} · ${esc(a.waktu || "")} · ${esc(a.lokasi || "")}</span></td>
      <td>
        <button class="btn small" onclick="editAgenda('${esc(a.id)}')">Edit</button>
        <button class="btn danger small" onclick="delAgenda('${esc(a.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-agenda").addEventListener("click", () => {
  ["agn_id","agn_judul","agn_tanggal","agn_waktu","agn_lokasi","agn_kategori","agn_deskripsi"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("modal-agenda").style.display = "block";
});
document.getElementById("agn-cancel").addEventListener("click", () => document.getElementById("modal-agenda").style.display = "none");

window.editAgenda = async (id) => {
  const { data } = await sb.from("agenda").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("agn_id").value = data.id;
  document.getElementById("agn_judul").value = data.judul || "";
  document.getElementById("agn_tanggal").value = data.tanggal || "";
  document.getElementById("agn_waktu").value = data.waktu || "";
  document.getElementById("agn_lokasi").value = data.lokasi || "";
  document.getElementById("agn_kategori").value = data.kategori || "";
  document.getElementById("agn_deskripsi").value = data.deskripsi || "";
  document.getElementById("modal-agenda").style.display = "block";
};

window.delAgenda = async (id) => {
  if (!confirm("Hapus agenda ini?")) return;
  const { error } = await sb.from("agenda").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadAgenda(); }
};

document.getElementById("form-agenda").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("agn_id").value;
  const row = {
    judul: document.getElementById("agn_judul").value,
    tanggal: document.getElementById("agn_tanggal").value,
    waktu: document.getElementById("agn_waktu").value,
    lokasi: document.getElementById("agn_lokasi").value,
    kategori: document.getElementById("agn_kategori").value,
    deskripsi: document.getElementById("agn_deskripsi").value
  };
  let res;
  if (id) res = await sb.from("agenda").update(row).eq("id", id);
  else res = await sb.from("agenda").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-agenda").style.display = "none"; loadAgenda(); }
});

// ---------------------------------------------------------------------
// DOKUMEN & SURAT DESA (CRUD)
// ---------------------------------------------------------------------
async function loadDokumen() {
  const tb = document.querySelector("#table-dokumen tbody");
  if (!tb) return;
  let data;
  try {
    const res = await sb.from("dokumen").select("*").order("sort_order");
    data = res.data;
  } catch (_) {
    tb.innerHTML = `<tr><td class="empty">Jalankan migration_v3.sql di Supabase.</td></tr>`;
    return;
  }
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada dokumen</td></tr>`; return; }
  tb.innerHTML = data.map(d => `
    <tr>
      <td>📄</td>
      <td><b>${esc(d.judul)}</b><br><span style="color:var(--muted)">${esc(d.kategori || "")} · ${esc(d.ukuran || "")}</span></td>
      <td>
        <button class="btn small" onclick="editDokumen('${esc(d.id)}')">Edit</button>
        <button class="btn danger small" onclick="delDokumen('${esc(d.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-dokumen").addEventListener("click", () => {
  ["dok_id","dok_judul","dok_kategori","dok_deskripsi","dok_file_url","dok_ukuran"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("modal-dokumen").style.display = "block";
});
document.getElementById("dok-cancel").addEventListener("click", () => document.getElementById("modal-dokumen").style.display = "none");

window.editDokumen = async (id) => {
  const { data } = await sb.from("dokumen").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("dok_id").value = data.id;
  document.getElementById("dok_judul").value = data.judul || "";
  document.getElementById("dok_kategori").value = data.kategori || "";
  document.getElementById("dok_deskripsi").value = data.deskripsi || "";
  document.getElementById("dok_file_url").value = data.file_url || "";
  document.getElementById("dok_ukuran").value = data.ukuran || "";
  document.getElementById("modal-dokumen").style.display = "block";
};

window.delDokumen = async (id) => {
  if (!confirm("Hapus dokumen ini?")) return;
  const { error } = await sb.from("dokumen").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadDokumen(); }
};

document.getElementById("form-dokumen").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("dok_id").value;
  const row = {
    judul: document.getElementById("dok_judul").value,
    kategori: document.getElementById("dok_kategori").value,
    deskripsi: document.getElementById("dok_deskripsi").value,
    file_url: document.getElementById("dok_file_url").value,
    ukuran: document.getElementById("dok_ukuran").value
  };
  let res;
  if (id) res = await sb.from("dokumen").update(row).eq("id", id);
  else res = await sb.from("dokumen").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-dokumen").style.display = "none"; loadDokumen(); }
});

// ---------------------------------------------------------------------
// PENGADUAN WARGA (ADMIN RESPONSE)
// ---------------------------------------------------------------------
async function loadPengaduan() {
  const tb = document.querySelector("#table-pengaduan tbody");
  if (!tb) return;
  let data;
  try {
    const res = await sb.from("pengaduan").select("*").order("created_at", { ascending: false });
    data = res.data;
  } catch (_) {
    tb.innerHTML = `<tr><td class="empty">Jalankan migration_v3.sql di Supabase.</td></tr>`;
    return;
  }
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada pengaduan warga</td></tr>`; return; }
  tb.innerHTML = data.map(p => `
    <tr>
      <td>💬</td>
      <td>
        <b>${esc(p.subjek)}</b> — <span class="badge-status ${esc(p.status.toLowerCase())}">${esc(p.status)}</span><br>
        <span style="font-size:12.5px;color:var(--text)"><b>Oleh:</b> ${esc(p.nama)} (${esc(p.kontak || "No HP Kosong")})</span><br>
        <span style="font-size:12px;color:var(--muted)">${esc(p.isi)}</span>
      </td>
      <td>
        <button class="btn small" onclick="editPengaduanAdmin('${esc(p.id)}')">Respon</button>
        <button class="btn danger small" onclick="delPengaduan('${esc(p.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

window.editPengaduanAdmin = async (id) => {
  const { data } = await sb.from("pengaduan").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("pg_admin_id").value = data.id;
  document.getElementById("pg_admin_status").value = data.status || "Pending";
  document.getElementById("pg_admin_tanggapan").value = data.tanggapan || "";
  document.getElementById("modal-pengaduan").style.display = "block";
};

document.getElementById("pg-admin-cancel").addEventListener("click", () => document.getElementById("modal-pengaduan").style.display = "none");

window.delPengaduan = async (id) => {
  if (!confirm("Hapus pengaduan ini?")) return;
  const { error } = await sb.from("pengaduan").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadPengaduan(); }
};

document.getElementById("form-pengaduan-admin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("pg_admin_id").value;
  const row = {
    status: document.getElementById("pg_admin_status").value,
    tanggapan: document.getElementById("pg_admin_tanggapan").value
  };
  const res = await sb.from("pengaduan").update(row).eq("id", id);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Status Pengaduan Diperbarui ✓"); document.getElementById("modal-pengaduan").style.display = "none"; loadPengaduan(); }
});

// ---------------------------------------------------------------------
// PROFIL
// ---------------------------------------------------------------------
async function loadProfilForm() {
  const { data } = await sb.from("site_config").select("*").eq("id", 1).single();
  if (!data) return;
  const map = {
    p_village_name: "village_name", p_motto: "motto", p_logo_url: "logo_url",
    p_tahun_berdiri: "tahun_berdiri", p_foto_desa_url: "foto_desa",
    p_visi: "visi", p_misi: "misi",
    p_sejarah: "sejarah", p_luas_wilayah: "luas_wilayah", p_jumlah_penduduk: "jumlah_penduduk",
    p_jumlah_kepala_keluarga: "jumlah_kepala_keluarga",
    p_potensi: "potensi", p_alamat_kantor: "alamat_kantor", p_telepon: "telepon",
    p_email: "email", p_jam_layanan: "jam_layanan",
    p_maps_url: "maps_url", p_facebook: "facebook",
    p_instagram: "instagram", p_accent_color: "accent_color"
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el && data[key] !== null) el.value = data[key];
  }
}

document.getElementById("form-profil").addEventListener("submit", async (e) => {
  e.preventDefault();
  let logo = document.getElementById("p_logo_url").value.trim();
  const file = document.getElementById("p_logo_file").files[0];
  if (file) { const p = await uploadImage(file, "logo"); if (p) logo = p; }

  let fotoDesa = document.getElementById("p_foto_desa_url").value.trim();
  const fileDesa = document.getElementById("p_foto_desa_file").files[0];
  if (fileDesa) { const p = await uploadImage(fileDesa, "fotodesa"); if (p) fotoDesa = p; }

  const payload = {
    id: 1,
    village_name: document.getElementById("p_village_name").value,
    motto: document.getElementById("p_motto").value,
    logo_url: logo || null,
    tahun_berdiri: document.getElementById("p_tahun_berdiri").value,
    foto_desa: fotoDesa || null,
    visi: document.getElementById("p_visi").value,
    misi: document.getElementById("p_misi").value,
    sejarah: document.getElementById("p_sejarah").value,
    luas_wilayah: document.getElementById("p_luas_wilayah").value,
    jumlah_penduduk: document.getElementById("p_jumlah_penduduk").value,
    jumlah_kepala_keluarga: document.getElementById("p_jumlah_kepala_keluarga").value,
    potensi: document.getElementById("p_potensi").value,
    alamat_kantor: document.getElementById("p_alamat_kantor").value,
    telepon: document.getElementById("p_telepon").value,
    email: document.getElementById("p_email").value,
    jam_layanan: document.getElementById("p_jam_layanan").value,
    maps_url: document.getElementById("p_maps_url").value,
    facebook: document.getElementById("p_facebook").value,
    instagram: document.getElementById("p_instagram").value,
    accent_color: document.getElementById("p_accent_color").value || "#1f7a4d"
  };
  // upsert
  const { error } = await sb.from("site_config").upsert(payload);
  if (error) toast("Gagal: " + error.message);
  else toast("Profil tersimpan ✓");
});

// ---------------------------------------------------------------------
// PERANGKAT
// ---------------------------------------------------------------------
async function loadPerangkat() {
  const { data } = await sb.from("perangkat_desa").select("*").order("sort_order");
  const tb = document.querySelector("#table-perangkat tbody");
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada data</td></tr>`; return; }
  tb.innerHTML = data.map(p => `
    <tr>
      <td>${p.foto_url ? `<img src="${esc(imgUrl(p.foto_url))}" />` : "👤"}</td>
      <td><b>${esc(p.nama)} ${p.is_kades ? "⭐" : ""}</b><br><span style="color:var(--muted)">${esc(p.jabatan)}</span></td>
      <td>
        <button class="btn small" onclick="editPerangkat('${esc(p.id)}')">Edit</button>
        <button class="btn danger small" onclick="delPerangkat('${esc(p.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-perangkat").addEventListener("click", () => {
  ["per_id","per_nama","per_jabatan","per_periode","per_foto_url","per_sort","per_tugas"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("per_foto_file").value = "";
  document.getElementById("per_is_kades").checked = false;
  document.getElementById("modal-perangkat").style.display = "block";
});
document.getElementById("per-cancel").addEventListener("click", () => document.getElementById("modal-perangkat").style.display = "none");

window.editPerangkat = async (id) => {
  const { data } = await sb.from("perangkat_desa").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("per_id").value = data.id;
  document.getElementById("per_nama").value = data.nama || "";
  document.getElementById("per_jabatan").value = data.jabatan || "";
  document.getElementById("per_periode").value = data.periode || "";
  document.getElementById("per_foto_url").value = data.foto_url && data.foto_url.startsWith("http") ? data.foto_url : "";
  document.getElementById("per_sort").value = data.sort_order || 0;
  document.getElementById("per_tugas").value = data.tugas || "";
  document.getElementById("per_is_kades").checked = !!data.is_kades;
  document.getElementById("modal-perangkat").style.display = "block";
};

window.delPerangkat = async (id) => {
  if (!confirm("Hapus perangkat ini?")) return;
  const { error } = await sb.from("perangkat_desa").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadPerangkat(); }
};

document.getElementById("form-perangkat").addEventListener("submit", async (e) => {
  e.preventDefault();
  let foto = document.getElementById("per_foto_url").value.trim();
  const file = document.getElementById("per_foto_file").files[0];
  if (file) { const p = await uploadImage(file, "perangkat"); if (p) foto = p; }
  const id = document.getElementById("per_id").value;
  const row = {
    nama: document.getElementById("per_nama").value,
    jabatan: document.getElementById("per_jabatan").value,
    periode: document.getElementById("per_periode").value,
    foto_url: foto || null,
    tugas: document.getElementById("per_tugas").value,
    is_kades: document.getElementById("per_is_kades").checked,
    sort_order: parseInt(document.getElementById("per_sort").value) || 0
  };
  let res;
  if (id) res = await sb.from("perangkat_desa").update(row).eq("id", id);
  else res = await sb.from("perangkat_desa").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-perangkat").style.display = "none"; loadPerangkat(); }
});

// ---------------------------------------------------------------------
// UMKM
// ---------------------------------------------------------------------
async function loadUmkm() {
  const { data } = await sb.from("umkm").select("*").order("sort_order");
  const tb = document.querySelector("#table-umkm tbody");
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada data</td></tr>`; return; }
  tb.innerHTML = data.map(u => `
    <tr>
      <td>${u.foto_url ? `<img src="${esc(imgUrl(u.foto_url))}" />` : "🛍️"}</td>
      <td><b>${esc(u.nama)}</b><br><span style="color:var(--muted)">${esc(u.kategori || "")}</span></td>
      <td>
        <button class="btn small" onclick="editUmkm('${esc(u.id)}')">Edit</button>
        <button class="btn danger small" onclick="delUmkm('${esc(u.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-umkm").addEventListener("click", () => {
  ["um_id","um_nama","um_pemilik","um_kategori","um_deskripsi","um_kontak","um_alamat","um_jam_buka","um_maps_url","um_foto_url","um_sort"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("um_foto_file").value = "";
  document.getElementById("modal-umkm").style.display = "block";
});
document.getElementById("um-cancel").addEventListener("click", () => document.getElementById("modal-umkm").style.display = "none");

window.editUmkm = async (id) => {
  const { data } = await sb.from("umkm").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("um_id").value = data.id;
  document.getElementById("um_nama").value = data.nama || "";
  document.getElementById("um_pemilik").value = data.pemilik || "";
  document.getElementById("um_kategori").value = data.kategori || "";
  document.getElementById("um_deskripsi").value = data.deskripsi || "";
  document.getElementById("um_kontak").value = data.kontak || "";
  document.getElementById("um_alamat").value = data.alamat || "";
  document.getElementById("um_jam_buka").value = data.jam_buka || "";
  document.getElementById("um_maps_url").value = data.maps_url || "";
  document.getElementById("um_foto_url").value = data.foto_url && data.foto_url.startsWith("http") ? data.foto_url : "";
  document.getElementById("um_sort").value = data.sort_order || 0;
  document.getElementById("modal-umkm").style.display = "block";
};

window.delUmkm = async (id) => {
  if (!confirm("Hapus UMKM ini?")) return;
  const { error } = await sb.from("umkm").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadUmkm(); }
};

document.getElementById("form-umkm").addEventListener("submit", async (e) => {
  e.preventDefault();
  let foto = document.getElementById("um_foto_url").value.trim();
  const file = document.getElementById("um_foto_file").files[0];
  if (file) { const p = await uploadImage(file, "umkm"); if (p) foto = p; }
  const id = document.getElementById("um_id").value;
  const row = {
    nama: document.getElementById("um_nama").value,
    pemilik: document.getElementById("um_pemilik").value,
    kategori: document.getElementById("um_kategori").value,
    deskripsi: document.getElementById("um_deskripsi").value,
    kontak: document.getElementById("um_kontak").value,
    alamat: document.getElementById("um_alamat").value,
    jam_buka: document.getElementById("um_jam_buka").value,
    maps_url: document.getElementById("um_maps_url").value,
    foto_url: foto || null,
    sort_order: parseInt(document.getElementById("um_sort").value) || 0
  };
  let res;
  if (id) res = await sb.from("umkm").update(row).eq("id", id);
  else res = await sb.from("umkm").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-umkm").style.display = "none"; loadUmkm(); }
});

// ---------------------------------------------------------------------
// BERITA
// ---------------------------------------------------------------------
async function loadBerita() {
  const { data } = await sb.from("berita").select("*").order("tanggal", { ascending: false });
  const tb = document.querySelector("#table-berita tbody");
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada data</td></tr>`; return; }
  tb.innerHTML = data.map(b => `
    <tr>
      <td>${b.foto_url ? `<img src="${esc(imgUrl(b.foto_url))}" />` : "📰"}</td>
      <td><b>${esc(b.judul)}</b><br><span style="color:var(--muted)">${esc(b.kategori || "")} · ${esc(b.tanggal || "")}</span></td>
      <td>
        <button class="btn small" onclick="editBerita('${esc(b.id)}')">Edit</button>
        <button class="btn danger small" onclick="delBerita('${esc(b.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-berita").addEventListener("click", () => {
  ["ber_id","ber_judul","ber_kategori","ber_tanggal","ber_isi","ber_sumber","ber_foto_url","ber_sort"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("ber_foto_file").value = "";
  document.getElementById("modal-berita").style.display = "block";
});
document.getElementById("ber-cancel").addEventListener("click", () => document.getElementById("modal-berita").style.display = "none");

window.editBerita = async (id) => {
  const { data } = await sb.from("berita").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("ber_id").value = data.id;
  document.getElementById("ber_judul").value = data.judul || "";
  document.getElementById("ber_kategori").value = data.kategori || "";
  document.getElementById("ber_tanggal").value = data.tanggal || "";
  document.getElementById("ber_isi").value = data.isi || "";
  document.getElementById("ber_sumber").value = data.sumber || "";
  document.getElementById("ber_foto_url").value = data.foto_url && data.foto_url.startsWith("http") ? data.foto_url : "";
  document.getElementById("ber_sort").value = data.sort_order || 0;
  document.getElementById("modal-berita").style.display = "block";
};

window.delBerita = async (id) => {
  if (!confirm("Hapus berita ini?")) return;
  const { error } = await sb.from("berita").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadBerita(); }
};

document.getElementById("form-berita").addEventListener("submit", async (e) => {
  e.preventDefault();
  let foto = document.getElementById("ber_foto_url").value.trim();
  const file = document.getElementById("ber_foto_file").files[0];
  if (file) { const p = await uploadImage(file, "berita"); if (p) foto = p; }
  const id = document.getElementById("ber_id").value;
  const row = {
    judul: document.getElementById("ber_judul").value,
    kategori: document.getElementById("ber_kategori").value,
    tanggal: document.getElementById("ber_tanggal").value,
    isi: document.getElementById("ber_isi").value,
    sumber: document.getElementById("ber_sumber").value,
    foto_url: foto || null,
    sort_order: parseInt(document.getElementById("ber_sort").value) || 0
  };
  let res;
  if (id) res = await sb.from("berita").update(row).eq("id", id);
  else res = await sb.from("berita").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-berita").style.display = "none"; loadBerita(); }
});

// ---------------------------------------------------------------------
// GALERI
// ---------------------------------------------------------------------
async function loadGaleri() {
  const tb = document.querySelector("#table-galeri tbody");
  let data;
  try {
    const res = await sb.from("galeri").select("*").order("sort_order");
    data = res.data;
  } catch (_) {
    // Tabel galeri belum ada (migrasi v2 belum dijalankan)
    tb.innerHTML = `<tr><td class="empty">Jalankan supabase/migration_v2.sql dulu untuk mengaktifkan galeri.</td></tr>`;
    return;
  }
  if (!data || data.length === 0) { tb.innerHTML = `<tr><td class="empty">Belum ada data</td></tr>`; return; }
  tb.innerHTML = data.map(g => `
    <tr>
      <td>${g.foto_url ? `<img src="${esc(imgUrl(g.foto_url))}" />` : "🖼️"}</td>
      <td><b>${esc(g.judul || "Tanpa judul")}</b><br><span style="color:var(--muted)">${esc(g.kategori || "")} · ${esc(g.tanggal || "")}</span></td>
      <td>
        <button class="btn small" onclick="editGaleri('${esc(g.id)}')">Edit</button>
        <button class="btn danger small" onclick="delGaleri('${esc(g.id)}')">Hapus</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-add-galeri").addEventListener("click", () => {
  ["gal_id","gal_judul","gal_kategori","gal_tanggal","gal_deskripsi","gal_foto_url","gal_sort"].forEach(i => document.getElementById(i).value = "");
  document.getElementById("gal_foto_file").value = "";
  document.getElementById("modal-galeri").style.display = "block";
});
document.getElementById("gal-cancel").addEventListener("click", () => document.getElementById("modal-galeri").style.display = "none");

window.editGaleri = async (id) => {
  const { data } = await sb.from("galeri").select("*").eq("id", id).single();
  if (!data) return;
  document.getElementById("gal_id").value = data.id;
  document.getElementById("gal_judul").value = data.judul || "";
  document.getElementById("gal_kategori").value = data.kategori || "";
  document.getElementById("gal_tanggal").value = data.tanggal || "";
  document.getElementById("gal_deskripsi").value = data.deskripsi || "";
  document.getElementById("gal_foto_url").value = data.foto_url && data.foto_url.startsWith("http") ? data.foto_url : "";
  document.getElementById("gal_sort").value = data.sort_order || 0;
  document.getElementById("modal-galeri").style.display = "block";
};

window.delGaleri = async (id) => {
  if (!confirm("Hapus foto ini?")) return;
  const { error } = await sb.from("galeri").delete().eq("id", id);
  if (error) toast("Gagal: " + error.message); else { toast("Terhapus ✓"); loadGaleri(); }
};

document.getElementById("form-galeri").addEventListener("submit", async (e) => {
  e.preventDefault();
  let foto = document.getElementById("gal_foto_url").value.trim();
  const file = document.getElementById("gal_foto_file").files[0];
  if (file) { const p = await uploadImage(file, "galeri"); if (p) foto = p; }
  const id = document.getElementById("gal_id").value;
  const row = {
    judul: document.getElementById("gal_judul").value,
    kategori: document.getElementById("gal_kategori").value,
    tanggal: document.getElementById("gal_tanggal").value,
    deskripsi: document.getElementById("gal_deskripsi").value,
    foto_url: foto || null,
    sort_order: parseInt(document.getElementById("gal_sort").value) || 0
  };
  let res;
  if (id) res = await sb.from("galeri").update(row).eq("id", id);
  else res = await sb.from("galeri").insert(row);
  if (res.error) toast("Gagal: " + res.error.message);
  else { toast("Tersimpan ✓"); document.getElementById("modal-galeri").style.display = "none"; loadGaleri(); }
});
