# Brit Auto WMS — Workshop Management System

**Brit Auto WMS** adalah sistem manajemen bengkel terintegrasi (*Workshop Management System*) khusus spesialis mobil mewah asal Inggris (**Jaguar, Land Rover, Bentley, Rolls-Royce**). Aplikasi ini mendigitalkan seluruh alur kerja operasional mulai dari penerimaan kendaraan & riwayat pergantian nomor polisi, manajemen Work Order (WO), penugasan teknisi, pencatatan jam kerja aktual (*clock on/off*), layar ruang tunggu pelanggan *real-time* (SSE), kontrol stok & *stock opname* suku cadang, faktur (*snapshot harga*), garansi & pengaduan, kalkulasi KPI & bonus teknisi, hingga laporan keuangan dan dasbor *mobile* (PWA) untuk pemilik.

---

## Cara Menjalankan Aplikasi

```bash
npm install
npm run dev
```

Server Express + Vite berjalan pada **http://localhost:3000**. Saat pertama kali dijalankan, aplikasi secara otomatis membuat file database SQLite (`brit-auto.db`) dan melakukan *seeding* seluruh akun demo beserta data operasional lengkap.

### Menjalankan Unit Test Domain

```bash
npm test
```

Perintah ini menjalankan seluruh pengujian unit domain murni (`server/domain/test/*.test.ts`) menggunakan `node --import tsx --test`.

---

## Akun Demo (Semua Kata Sandi: `Brit2026!`)

| Peran | Kode | Username | Nama Lengkap | Hak Akses Utama |
|---|---|---|---|---|
| **Pemilik (Owner)** | `PM` | `agus` | Agus Darmawan | Akses penuh + Dasbor Mobile Owner (`/owner/mobile`), Laporan Keuangan, KPI & Bonus, Asisten AI Eksekutif |
| **Admin** | `AD` | `admin` | Rina Kartika | Akses penuh administrasi, Faktur, Biaya Operasional, Master Data, Log Audit |
| **Service Advisor** | `SA` | `sari` | Sari Wulandari | Pelanggan, Kendaraan (Riwayat Nopol), Pembuatan & Pemeriksaan Akhir WO, Pengaduan & Garansi, Pengingat Servis |
| **Kepala Regu** | `KR` | `hasan` | Hasan Basri | Papan Penugasan Teknisi (*Assignment Board*), Pemantauan Jam Kerja, Peralatan & Alat Khusus |
| **Teknisi Senior** | `TK` | `andi` | Andi Pratama | Pekerjaan Saya (*Clock On / Pause / Clock Off* dengan layar sentuh besar) |
| **Teknisi** | `TK` | `budi` | Budi Santoso | Pekerjaan Saya (*Clock On / Pause / Clock Off*) |
| **Teknisi** | `TK` | `candra` | Candra Wijaya | Pekerjaan Saya (*Clock On / Pause / Clock Off*) |
| **Teknisi Junior** | `TK` | `dedi` | Dedi Kurniawan | Pekerjaan Saya (*Clock On / Pause / Clock Off*) |
| **Petugas Suku Cadang** | `SP` | `spare` | Hendra Wijaya | Katalog Suku Cadang, Pengeluaran Suku Cadang ke WO, Penerimaan Stok, *Stock Opname* |

---

## Skenario Demonstrasi Kriteria Penerimaan (PRD §10)

1. **Otentikasi & RBAC Enam Peran**:
   - Masuk dengan masing-masing akun di halaman `/login` (tersedia tombol klik cepat untuk setiap peran). Menu navigasi otomatis menyesuaikan peran dan endpoint API menolak akses tidak sah (`403 AKSES_DITOLAK`) serta mencatatnya di `/audit-logs`.
2. **Pencarian Riwayat Nomor Polisi (`BR-01`, `BR-02`)**:
   - Buka menu **Kendaraan & Riwayat Nopol** (`/vehicles`) dan ketik **`B 128 XL`** (nopol lama). Sistem menemukan Range Rover Autobiography LWB yang kini menggunakan nopol aktif **`B 21 XL`** beserta garis waktu perubahan nomor polisinya.
3. **Alur Work Order, Penugasan, Clock On/Off, & Layar Ruang Tunggu Real-time (SSE)**:
   - Buat WO baru di `/work-orders/new` (SA), tugaskan teknisi di `/assignments` (KR), lalu mulai *Clock On* di `/my-jobs` (TK).
   - Buka `/waiting-room` di tab terpisah: status WO langsung diperbarui secara *real-time* melalui Server-Sent Events (`/api/events`) tanpa menampilkan data pribadi pelanggan (`BR-08`).
4. **Kontrol Stok Suku Cadang & Notifikasi Stok Minimum (`BR-05`, `BR-06`)**:
   - Di detail WO (`/work-orders/:id`), coba keluarkan suku cadang melebihi stok tersedia → ditolak dengan kode `422 STOK_TIDAK_CUKUP`.
   - Pengeluaran normal mengurangi stok secara atomik, membuat mutasi `KELUAR`, dan memicu notifikasi `STOK_MINIMUM` bila `stock_qty <= min_stock`.
5. **Penutupan WO Ketat & Faktur Snapshot (`BR-07`, `BR-12`)**:
   - WO tidak dapat ditutup sebelum seluruh item pekerjaan berstatus `SELESAI` dan WO telah diperiksa SA (`DIPERIKSA`).
   - Saat ditutup, sistem menerbitkan faktur dengan harga jasa dan suku cadang yang di-*snapshot* permanen.
6. **Klasifikasi Otomatis Garansi vs Non-Garansi (`BR-09`)**:
   - Buka `/complaints` dan daftarkan pengaduan pada WO yang memiliki garansi aktif dengan kategori komponen yang sama (mis. `SUSPENSI_UDARA` pada Range Rover `B 21 XL`) → sistem otomatis mengklasifikasikan sebagai **`GARANSI`**.
7. **Kinerja Teknisi & Bonus (`BR-10`, `BR-11`)**:
   - Buka `/performance`: menampilkan Produktivitas, Efisiensi, Utilitas, Tingkat *Comeback*, serta kelayakan bonus bila Efisiensi > 40% (`eligibleBonusHours = actualHours * (efficiency - 0.40)`).
8. **Dasbor Mobile Pemilik (`390px`) & PWA**:
   - Buka `/owner/mobile` atau masuk sebagai `agus` pada layar *mobile* (`390px`): menampilkan kartu ringkasan pendapatan, laba bersih, beban operasional, progres WO, dan peringatan stok tanpa *horizontal scroll*.

---

## Arsitektur Sistem

- **Domain Layer (`server/domain/src/*`)**: Fungsi murni (*pure TypeScript functions*) tanpa ketergantungan database/HTTP untuk seluruh aturan bisnis (`workorder`, `clock`, `stock`, `invoice`, `warranty`, `kpi`, `plates`, `reminder`, `auth`).
- **Backend (`server.ts`, `server/routes/api.ts`, `server/services/*`)**: Express + SQLite (`better-sqlite3` dalam mode WAL + transaksi atomik) + SSE (`/api/events`) + Gemini API (`@google/genai` dengan model `gemini-4-argon` untuk analisis eksekutif).
- **Frontend (`src/*`)**: React 19 + TypeScript + Tailwind CSS v4 + TanStack Query + Recharts + Vite PWA (`manifest.webmanifest` & Service Worker).
