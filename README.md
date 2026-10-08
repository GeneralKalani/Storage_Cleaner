# Storage Audit & In-Place Cleaner Utility

Utilitas audit penyimpanan berbasis Node.js portabel tanpa dependensi eksternal (*Zero Dependency*) dengan antarmuka web responsif interaktif dan fitur upload/pemilih folder langsung dari komputer.

## 📋 Ikhtisar Fitur & Pemenuhan SRS

| Kode SRS | Fitur & Kebutuhan | Implementasi di `storage_audit.js` |
|---|---|---|
| **STG-01** | **Recursive Scan & Dynamic Folder** | Menyediakan input path folder target dinamis di Web UI (default: `./Bahan Latihan P12`). Memindai folder target dan semua subfoldernya secara rekursif, mengumpulkan nama file, path absolut, ukuran bytes, dan hash SHA-256 tiap file ke memori. |
| **STG-02** | **Duplicate Detection** | Mengelompokkan file dengan hash SHA-256 identik (meskipun nama file berbeda). Menampilkan daftar 20 kelompok duplikat (tiap grup 2+ file identik), menandai 1 berkas master/asli dipertahankan vs salinan kembar untuk dibersihkan. |
| **STG-03** | **Giant File Flagging** | Menandai file yang ukurannya melebihi ambang batas **5 GB** sebagai **File Raksasa**. Menyajikan daftar 15 file raksasa / terbesar beserta ukurannya dalam format **MB & KB** serta badge status. |
| **STG-04** | **Responsive Web UI Dashboard** | Dashboard visual responsif di browser (`http://localhost:3000`): input field path dinamis, tombol Pindai Folder, 4 kartu metrik storage (Total File, Total Kapasitas, File Raksasa, Potensi Hemat), tabel file raksasa, dan accordion grup duplikat. |
| **STG-05** | **Safe Direct Cleanup & Modal Confirmation** | Tombol "Bersihkan Duplikat & Sampah" dengan modal konfirmasi interaktif di UI browser. Pembersihan dieksekusi langsung di tempat (*in-place*, tanpa membuat salinan atau memindahkan file). Menghapus salinan kembar dan file `.tmp`, serta wajib mempertahankan 1 file asli per grup. Kapasitas folder asal langsung berkurang. |
| **STG-06** | **Zero-Dependency Portability** | Dibangun murni menggunakan Node.js (`storage_audit.js`) dengan modul bawaan (*native* `http`, `fs`, `path`, `crypto`, `os`, `child_process`) tanpa perlu `npm install`. Membuka dashboard otomatis di browser saat aplikasi dijalankan. |

---

## 📁 Fitur Baru: Upload / Pilih Folder Tanpa Mengetik Path Manual

Aplikasi kini menyediakan **3 cara mudah** memilih folder tanpa perlu mengetik path manual:
1. **Tombol "📁 Upload / Pilih Folder"**:
   - Membuka kotak dialog pemilih folder bawaan Windows (*native directory picker*).
   - Cukup klik folder mana saja di komputer Anda dan klik *Select Folder*. Aplikasi akan langsung membaca folder tersebut dan memindainya.
2. **Drag & Drop Folder**:
   - Cukup tarik (*drag*) folder mana saja dari Windows Explorer dan jatuhkan (*drop*) ke area banner upload di dashboard.
3. **Tombol "🗂️ Jelajahi Komputer"**:
   - Membuka jendela penjelajah direktori interaktif di dalam browser untuk memilih drive (`C:\`, `D:\`) atau folder khusus (`Downloads`, `Desktop`, `Documents`).

---

## 🚀 Cara Menjalankan

### Opsi 1: Klik 2x File Launcher (Paling Praktis)
Cukup **klik 2x (double-click)** file:
👉 **`Buka_Aplikasi.bat`**

### Opsi 2: Melalui Terminal / CMD
```bash
node storage_audit.js
```

Aplikasi akan:
1. Mengaktifkan server HTTP lokal di `http://localhost:3000`.
2. Secara otomatis membuka browser default menuju dashboard web.
3. Menyiapkan folder uji coba default `./Bahan Latihan P12` dengan berkas duplikat dan `.tmp`.
