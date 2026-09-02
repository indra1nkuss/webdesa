# 🔌 Panduan Server Lokal — WebInformasiDesa

Panduan menyalakan & mematikan server lokal di **terminal VS Code**.

---

## ▶️ Menyalakan Server

Buka terminal VS Code (`Ctrl` + `` ` `` → pilih **PowerShell**), lalu:

### Dengan Python
```powershell
cd WebInformasiDesa
python -m http.server 8000
```

### Dengan Node
```powershell
cd WebInformasiDesa
npx serve WebInformasiDesa
```

Setelah server jalan, buka di browser:
- **Site publik**: http://localhost:8123
- **Panel admin**: http://localhost:8123/admin.html

> Jika port 8000 sudah dipakai, ganti angkanya, misalnya:
> ```powershell
> python -m http.server 8001
> ```

---

## ⏹️ Mematikan Server

### Cara paling umum (disarankan)
Di **terminal yang sama** tempat server berjalan, tekan:

```
Ctrl + C
```

Server langsung berhenti. Ini cara paling aman karena hanya menghentikan server kita, tidak menyentuh proses lain.

---

### Cara alternatif (server di terminal lain / lupa di mana)

1. **Cari proses yang memegang port 8000:**
   ```powershell
   Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
   ```

2. **Hentikan prosesnya** — ganti `<PID>` dengan angka dari hasil di atas:
   ```powershell
   Stop-Process -Id <PID> -Force
   ```

---

## 💡 Tips

- Tekan `Ctrl + C` di **terminal yang sama** tempat server dijalankan.
- Kalau terminal itu ditutup begitu saja, server biasanya ikut mati — tapi lebih aman tekan `Ctrl + C` dulu.
- Tidak ada perintah `start` / `stop` khusus — yang dipakai hanyalah `python -m http.server` (jalankan) dan `Ctrl + C` (hentikan).

---

## 🧾 Ringkasan Perintah

| Aksi | Perintah |
|------|----------|
| Jalankan (Python) | `python -m http.server 8000` |
| Jalankan (Node) | `npx serve WebInformasiDesa` |
| Hentikan | `Ctrl + C` |
| Cari PID di port 8000 | `Get-NetTCPConnection -LocalPort 8000` |
| Paksa hentikan proses | `Stop-Process -Id <PID> -Force` |
