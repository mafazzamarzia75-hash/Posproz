# 🏪 POSPro — Sistem Kasir Offline-First

> **Aplikasi Point of Sale (POS) modern** dengan arsitektur **offline-first sejati** — semua data tersimpan lokal di browser (Dexie/IndexedDB) dan **otomatis tersinkronisasi ke cloud (Supabase/PostgreSQL)** saat online. Dirancang untuk **multi-device, multi-akun, dan multi-cabang**.

---

## 📋 Daftar Isi

- [✨ Fitur Utama](#-fitur-utama)
- [🏗️ Arsitektur](#️-arsitektur)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Struktur Project](#-struktur-project)
- [🗄️ Database & Sinkronisasi](#️-database--sinkronisasi)
- [🚀 Cara Menjalankan](#-cara-menjalankan)
- [📖 Tutorial Penggunaan](#-tutorial-penggunaan)
- [🔐 Manajemen Akun & Role](#-manajemen-akun--role)
- [🖨️ Printer & Barcode](#️-printer--barcode)
- [📦 Import & Backup Data](#-import--backup-data)
- [🌐 Deployment](#-deployment)
- [❓ FAQ](#-faq)

---

## ✨ Fitur Utama

### 🛒 Kasir (Point of Sale)
- **Scan barcode** — dukung scanner hardware (HID Keyboard Mode) & kamera (ZXing)
- **Pencarian instan** — filter produk real-time dengan auto-match SKU/Barcode
- **Mode Eceran & Grosir** — toggle harga retail/wholesale
- **Harga promo** — tampilan harga coret + badge PROMO
- **Override harga/qty manual** — edit harga per item di keranjang
- **Kode diskon** — validasi & terapkan kode promo
- **Pembayaran Tunai & Piutang (Tempo)** — hitung kembalian otomatis, quick-amount buttons
- **Cetak struk** — dukung printer thermal 58mm/80mm, Android via RawBT
- **Auto-decrement stok** — stok berkurang otomatis setelah transaksi
- **Auto-simpan pelanggan** — pelanggan baru tersimpan otomatis saat checkout

### 📦 Inventori & Produk
- **CRUD produk lengkap** — nama, SKU, barcode, kategori, 4 harga (modal/eceran/grosir/promo), stok, supplier
- **Import massal** — dari file JSON/Excel (template tersedia)
- **Cetak label barcode & label rak** — 12 preset ukuran label thermal
- **Peringatan stok menipis** — alert otomatis saat stok di bawah minimum
- **Migrasi ID & deduplikasi** — rapikan data produk otomatis

### 📊 Manajemen Bisnis
- **Dashboard** — ringkasan penjualan, produk terlaris, stok menipis
- **Laporan** — rekap penjualan, export Excel/CSV
- **Riwayat transaksi** — lengkap dengan detail item
- **Hutang & Piutang** — catat tempo, DP, status (unpaid/partial/paid)
- **Restock & Retur** — kelola barang masuk & retur
- **Supplier & Pelanggan** — database relasi lengkap
- **Pengeluaran** — catat biaya operasional
- **Diskon & Promo** — kode diskon dengan batas pemakaian

### 🔄 Offline-First & Sinkronisasi
- **100% offline** — semua fitur berfungsi tanpa internet
- **Sinkronisasi otomatis** — tiap 30 detik saat online (SyncService)
- **Antrian sinkronisasi** — data tidak pernah hilang (sync_status: created/updated/deleted)
- **Migrasi otomatis** — data IndexedDB lama → Dexie saat startup
- **Multi-cabang** — kolom `branch_id` di semua tabel (skema SQL multi-tenant)

### 🎨 UI/UX
- **Dark mode** — tema gelap/terang
- **Navbar draggable** — bisa digeser ke atas/bawah/kiri/kanan/bebas
- **Responsif** — mobile, tablet, desktop
- **Animasi halus** — Motion (Framer Motion)
- **High Density** — tampilan padat untuk kasir profesional

---

## 🏗️ Arsitektur

### Filosofi Offline-First

```
TULIS → selalu ke Dexie (lokal) → ditandai sync_status
BACA  → selalu dari Dexie (sumber tunggal)
SYNC  → SyncService kirim ke Supabase tiap 30 detik
```

### Diagram Alur Data

```
┌─────────────────────────────────────────────────────────┐
│                      UI (React)                         │
│  POSPage · InventoryPage · HistoryPage · SettingsPage   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Facade Service (src/lib/indexdb*)           │
│  indexdbBarang · indexdbTransaksi · indexdbCustomer ...  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Sync Queue (src/lib/syncQueue.ts)           │
│  enqueueUpsert() · enqueueDelete() → sync_status         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│         Dexie (IndexedDB) — PosPro_OfflineDB             │
│  12 tabel: products, customers, suppliers, transactions, │
│  restocks, returs, debts, discounts, expenses, users,    │
│  categories, sales                                       │
└──────────────────────┬──────────────────────────────────┘
                       │ (SyncService — tiap 30 detik)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL Cloud)                 │
│  Upsert/Delete → markAsSynced → pull data baru           │
└─────────────────────────────────────────────────────────┘
```

### Komponen Inti

| Komponen | File | Peran |
|---|---|---|
| **Dexie DB** | `src/lib/dexieDb.ts` | Satu-satunya database lokal (12 tabel) |
| **Sync Queue** | `src/lib/syncQueue.ts` | Jembatan tulis ke Dexie + antrian sync |
| **SyncService** | `src/services/sync/SyncService.ts` | Sinkronisasi otomatis tiap 30 detik |
| **OfflineDetector** | `src/services/sync/OfflineDetector.ts` | Deteksi status online/offline |
| **Supabase Client** | `src/lib/supabaseClient.ts` | Gatekeeper cloud (isPostgresConfigured) |
| **Migrasi Legacy** | `src/lib/migrateLegacy.ts` | Migrasi IndexedDB lama → Dexie |
| **DatabaseService** | `src/services/db/DatabaseService.ts` | Backup/restore/import/sync data |
| **PrinterService** | `src/services/hardware/PrinterService.ts` | Cetak struk thermal (58/80mm, RawBT) |
| **ScannerService** | `src/services/hardware/ScannerService.ts` | Tangkap input barcode scanner hardware |
| **BarcodeService** | `src/services/hardware/BarcodeService.ts` | Generate barcode (JsBarcode) |

---

## 🛠️ Tech Stack

### Frontend
| Teknologi | Versi | Kegunaan |
|---|---|---|
| **React** | ^19.0.0 | Framework UI |
| **TypeScript** | ~5.8.2 | Type safety |
| **Vite** | ^6.4.3 | Build tool & dev server |
| **React Router** | ^7.14.2 | Routing SPA |
| **Zustand** | ^5.0.12 | State management (lightweight) |
| **Tailwind CSS** | ^4.1.14 | Styling utility-first |
| **Motion** | ^12.23.24 | Animasi (Framer Motion fork) |
| **Lucide React** | ^0.546.0 | Icon library |
| **Recharts** | ^3.8.1 | Grafik laporan |

### Database & Sinkronisasi
| Teknologi | Versi | Kegunaan |
|---|---|---|
| **Dexie** | ^4.4.3 | IndexedDB wrapper (database lokal offline) |
| **Supabase** | ^2.108.1 | PostgreSQL cloud + realtime sync |
| **Firebase** | ^12.14.0 | Firestore (legacy cloud, opsional) |
| **MongoDB/Mongoose** | ^7.3.0 / ^9.7.0 | Opsional (native) |

### Hardware & Utilitas
| Teknologi | Versi | Kegunaan |
|---|---|---|
| **ZXing Browser** | ^0.2.0 | Scan barcode via kamera |
| **JsBarcode** | ^3.12.3 | Generate barcode untuk label |
| **ExcelJS / XLSX** | ^3.4.0 / ^0.18.5 | Export/import Excel |
| **UUID** | ^14.0.0 | Generate UUID |
| **Capacitor** | ^8.4.1 | Build Android native |
| **Tauri** | ^2.11.2 | Build Windows desktop (opsional) |

### Scripts
```bash
npm run dev          # Jalankan dev server (port 3000, host 0.0.0.0)
npm run build        # Build produksi ke dist/
npm run preview      # Preview hasil build
npm run lint         # TypeScript type check (tsc --noEmit)
npm run clean        # Hapus folder dist/
npm run tauri:dev    # Jalankan sebagai desktop app (Tauri)
npm run tauri:build  # Build desktop app (Tauri)
```

---

## 📁 Struktur Project

```
├── src/
│   ├── main.tsx                    # Entry point + migrasi legacy → Dexie
│   ├── App.tsx                     # Routing + proteksi role
│   ├── index.css                   # Tailwind + CSS variables (light/dark)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── MainLayout.tsx      # Layout + navbar draggable
│   │   ├── pos/
│   │   │   ├── CheckoutModal.tsx   # Modal checkout 3-step
│   │   │   ├── ManualEditModal.tsx # Edit harga/qty manual
│   │   │   ├── BarcodeScannerModal.tsx # Scan via kamera
│   │   │   ├── BarcodePrintModal.tsx   # Cetak label barcode/rak
│   │   │   ├── StockAlert.tsx      # Alert stok menipis
│   │   │   └── PriceModeToggle.tsx # Toggle eceran/grosir
│   │   └── sync/
│   │       └── SupabaseSyncCard.tsx # UI konfigurasi Supabase
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx           # Halaman login
│   │   ├── DashboardPage.tsx       # Dashboard (admin)
│   │   ├── POSPage.tsx             # Kasir (admin/kasir)
│   │   ├── InventoryPage.tsx       # Produk (admin/gudang)
│   │   ├── HistoryPage.tsx         # Riwayat transaksi
│   │   ├── ReportPage.tsx          # Laporan (admin)
│   │   ├── SettingsPage.tsx        # Pengaturan (admin)
│   │   ├── SupplierPage.tsx        # Supplier (admin/gudang)
│   │   ├── CustomerPage.tsx        # Pelanggan (admin/kasir)
│   │   ├── ExpensePage.tsx         # Pengeluaran (admin)
│   │   ├── DiscountPage.tsx        # Diskon (admin)
│   │   ├── DebtPage.tsx            # Hutang/Piutang (admin/kasir)
│   │   ├── RestockPage.tsx         # Restock (admin/gudang)
│   │   └── ReturPage.tsx           # Retur (admin/gudang)
│   │
│   ├── lib/
│   │   ├── dexieDb.ts              # Schema Dexie (12 tabel)
│   │   ├── syncQueue.ts            # Antrian sinkronisasi
│   │   ├── migrateLegacy.ts        # Migrasi IndexedDB lama
│   │   ├── supabaseClient.ts       # Supabase client + gatekeeper
│   │   ├── firebaseClient.ts       # Firebase client (legacy)
│   │   ├── indexdbBarang.ts        # Service produk
│   │   ├── indexdbTransaksi.ts     # Service transaksi
│   │   ├── indexdbCustomer.ts      # Service pelanggan
│   │   ├── indexdbSupplier.ts      # Service supplier
│   │   ├── indexdbDebt.ts          # Service hutang/piutang
│   │   ├── indexdbDiscount.ts      # Service diskon
│   │   ├── indexdbRestock.ts       # Service restock
│   │   ├── indexdbRetur.ts         # Service retur
│   │   ├── indexdbExpense.ts       # Service pengeluaran
│   │   ├── indexdbCategory.ts      # Service kategori
│   │   ├── indexdbUser.ts          # Service user & autentikasi
│   │   ├── utils.ts                # Utility functions
│   │   ├── uuidGenerator.ts        # Generate UUID
│   │   ├── nativeHandler.ts        # Handler platform native
│   │   └── platformDetector.ts     # Deteksi platform
│   │
│   ├── services/
│   │   ├── db/
│   │   │   ├── DatabaseService.ts  # Backup/restore/import/sync
│   │   │   ├── OfflineFirstAdapter.ts # Adapter offline-first
│   │   │   ├── IDatabase.ts        # Interface database
│   │   │   ├── BaseAdapter.ts      # Base adapter
│   │   │   ├── DefaultData.json    # Data default produk
│   │   │   └── SeederService.ts    # Seeder data
│   │   ├── hardware/
│   │   │   ├── PrinterService.ts   # Cetak struk
│   │   │   ├── ScannerService.ts   # Scanner hardware
│   │   │   └── BarcodeService.ts   # Generate barcode
│   │   └── sync/
│   │       ├── SyncService.ts      # Sinkronisasi otomatis
│   │       └── OfflineDetector.ts  # Deteksi online/offline
│   │
│   ├── store/
│   │   ├── useCartStore.ts         # State keranjang (persist)
│   │   └── useSettingsStore.ts     # State pengaturan (persist)
│   │
│   ├── hooks/
│   │   └── useBarcodeScanner.ts    # Hook scanner barcode
│   │
│   └── interfaces/
│       └── index.ts                # Type definitions (Product, CartItem, dll)
│
├── supabase-schema-offline-first.sql  # Skema SQL lengkap (multi-tenant)
├── supabase-schema-lengkap.sql        # Skema SQL versi lama
├── public/
│   ├── import-all-products.html       # Tool import produk via browser
│   ├── import-products-template.json  # Template import produk
│   ├── products-data.json             # Data produk contoh
│   └── products-sample.json           # Sample produk
│
├── android/                           # Project Android (Capacitor)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── capacitor.config.ts
└── vercel.json
```

---

## 🗄️ Database & Sinkronisasi

### Database Lokal (Dexie — `PosPro_OfflineDB`)

12 tabel yang selalu tersinkronisasi:

| Tabel | Kegunaan | Sync Status |
|---|---|---|
| `products` | Produk/barang | ✅ |
| `customers` | Pelanggan | ✅ |
| `suppliers` | Pemasok | ✅ |
| `transactions` | Transaksi (Dexie schema) | ✅ |
| `sales` | Transaksi penjualan (UI utama) | ✅ |
| `restocks` | Riwayat restock | ✅ |
| `returs` | Retur barang | ✅ |
| `debts` | Hutang & piutang | ✅ |
| `discounts` | Diskon & promo | ✅ |
| `expenses` | Pengeluaran | ✅ |
| `users` | Akun pengguna | ✅ |
| `categories` | Kategori produk | ✅ |

Setiap record memiliki:
```typescript
interface SyncableEntity {
  id: string;                    // UUID (client-generated)
  sync_status: 'synced' | 'created' | 'updated' | 'deleted';
  updated_at: number;            // timestamp ms
  created_at?: number;
  synced_at?: number;
}
```

### Database Cloud (Supabase/PostgreSQL)

Jalankan **`supabase-schema-offline-first.sql`** di Supabase SQL Editor. Skema ini mencakup:

- **12 tabel data** + **4 tabel master** (`branches`, `user_branches`, `devices`, `sync_logs`)
- **Kolom `branch_id` & `device_id`** di semua tabel — untuk multi-cabang & multi-device
- **`is_deleted`** — soft delete/tombstone untuk sinkronisasi multi-device
- **Trigger `set_updated_at()`** — auto-update timestamp
- **Index** — `updated_at`, `is_deleted`, `branch_id` untuk performa sync
- **RLS multi-tenant** — superadmin akses semua, user akses cabangnya sendiri
- **Idempotent** — aman dijalankan ulang, upgrade aman dari skema lama

### Alur Sinkronisasi

```
1. User melakukan aksi (tambah/edit/hapus data)
2. Data ditulis ke Dexie dengan sync_status = 'created'/'updated'/'deleted'
3. SyncService (loop 30 detik) membaca antrian
4. Jika online → upsert/delete ke Supabase
5. Berhasil → markAsSynced (sync_status = 'synced')
6. Gagal → retry otomatis saat online kembali
```

---

## 🚀 Cara Menjalankan

### Prasyarat
- **Node.js** 18+ (disarankan 20+)
- **npm** atau **yarn**

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Dev Server
```bash
npm run dev
```
Buka **http://localhost:3000** di browser.

### 3. Build Produksi
```bash
npm run build
npm run preview
```

### 4. Koneksikan ke Supabase (Opsional)
1. Buat project di [Supabase](https://supabase.com)
2. Buka **SQL Editor → New Query**
3. Salin isi **`supabase-schema-offline-first.sql`** → **Run**
4. Buka aplikasi → **Pengaturan → kartu sinkronisasi → Konfigurasi**
5. Isi **Supabase URL** + **Anon Key** → **Simpan**
6. Aplikasi reload → sinkronisasi otomatis aktif

> 💡 **Tanpa Supabase?** Aplikasi tetap berjalan 100% offline (hanya Dexie lokal).

---

## 📖 Tutorial Penggunaan

### 🔐 Login

| Role | Username | Password | Akses |
|---|---|---|---|
| **Super Admin** | `superadmin` | `super123` | Semua fitur + manajemen akun |
| **Admin** | `admin` | `admin123` | Semua fitur (tanpa manajemen akun) |
| **Kasir** | `kasir` | `kasir123` | POS, Riwayat, Pelanggan, Hutang |
| **Gudang** | `gudang` | `gudang123` | Produk, Supplier, Restock, Retur |

> ⚠️ **Segera ganti password default** setelah login pertama!

### 🛒 Transaksi Penjualan (Kasir)

1. **Login** sebagai `kasir` atau `admin`
2. Buka menu **Kasir** (atau otomatis diarahkan)
3. **Cari produk**:
   - Scan barcode dengan scanner hardware (otomatis masuk keranjang)
   - Atau klik ikon kamera untuk scan via kamera
   - Atau ketik nama/SKU di kolom pencarian
4. **Atur qty** — klik tombol +/− di keranjang
5. **Edit harga** (opsional) — klik harga item → modal edit → ubah harga/qty
6. **Pilih mode** — Eceran/Grosir (toggle di atas daftar produk)
7. Klik **Bayar** → modal checkout:
   - **Step 1 (Review)**: isi nama pelanggan (opsional), kode diskon (opsional)
   - **Step 2 (Pembayaran)**: pilih Tunai/Piutang, masukkan uang, lihat kembalian
   - **Step 3 (Sukses)**: cetak struk / transaksi baru
8. Stok produk **berkurang otomatis**

### 📦 Kelola Produk (Gudang/Admin)

1. Buka menu **Produk**
2. **Tambah produk**: klik tombol tambah → isi form (nama, SKU, barcode, kategori, harga, stok)
3. **Edit produk**: klik produk → ubah data → simpan
4. **Hapus produk**: klik ikon hapus
5. **Import massal**: Pengaturan → Import Produk → pilih file JSON
6. **Cetak label**: POS → klik ikon printer → pilih produk → pilih ukuran label → cetak

### 🚚 Restock Barang (Gudang)

1. Buka menu **Masuk** (Restock)
2. Klik **Tambah Restock**
3. Pilih supplier, pilih produk, masukkan qty & harga beli
4. Simpan → stok produk bertambah otomatis

### 🔄 Retur Barang (Gudang)

1. Buka menu **Retur**
2. Klik **Tambah Retur**
3. Pilih tipe (retur customer/supplier), pilih produk, masukkan qty & alasan
4. Simpan → stok produk kembali

### 👥 Kelola Pelanggan (Kasir/Admin)

1. Buka menu **Pelanggan**
2. Tambah/edit/hapus pelanggan
3. Lihat total belanja, jumlah transaksi, transaksi terakhir
4. Pelanggan baru **otomatis tersimpan** saat checkout di POS

### 🚚 Kelola Supplier (Gudang/Admin)

1. Buka menu **Supplier**
2. Tambah/edit/hapus supplier
3. Lihat jumlah produk & total pembelian per supplier

### 💰 Hutang & Piutang (Kasir/Admin)

1. Buka menu **Hutang**
2. Lihat daftar hutang/piutang (status: unpaid/partial/paid)
3. **Tambah hutang**: pilih tipe (piutang/hutang), pelanggan/supplier, jumlah, jatuh tempo
4. **Bayar hutang**: klik item → catat pembayaran → status berubah otomatis
5. Piutang **otomatis tercatat** saat checkout dengan metode Piutang

### 🏷️ Diskon & Promo (Admin)

1. Buka menu **Diskon**
2. **Tambah diskon**: kode, nama, tipe (persentase/nominal), nilai, minimal belanja, batas pemakaian, periode berlaku
3. Kode diskon bisa dipakai di checkout POS

### 💸 Pengeluaran (Admin)

1. Buka menu **Biaya**
2. Tambah/edit/hapus pengeluaran (nama, jumlah, kategori, tanggal, catatan)

### 📊 Laporan (Admin)

1. Buka menu **Laporan**
2. Lihat grafik penjualan, rekap per periode
3. **Export** ke Excel/CSV

### 🧾 Riwayat Transaksi (Kasir/Admin)

1. Buka menu **Riwayat**
2. Lihat semua transaksi (urut terbaru)
3. Klik transaksi untuk lihat detail item
4. **Cetak ulang struk** jika diperlukan

### ⚙️ Pengaturan (Admin)

| Fitur | Keterangan |
|---|---|
| **Identitas Toko** | Nama, telepon, alamat, footer struk |
| **Dark Mode** | Toggle tema gelap/terang |
| **Pengaturan Printer** | Lebar kertas (58/80mm), tinggi ekstra, mode barcode |
| **Pengaturan Label** | Preset ukuran label, gap, margin |
| **Manajemen Akun** | Tambah/edit/hapus user (super_admin) |
| **Backup Data** | Download semua data sebagai JSON |
| **Restore Data** | Pulihkan data dari file backup |
| **Import Produk** | Import massal dari JSON |
| **Backup Transaksi** | Backup riwayat transaksi saja |
| **Reset Transaksi** | Hapus semua riwayat transaksi |
| **Reset Aplikasi** | Hapus SEMUA data (konfirmasi ketik "RESET") |
| **Migrasi ID** | Ubah ID produk ke format `prod_<sku>` |
| **Deduplikasi** | Hapus produk duplikat (SKU/barcode sama) |
| **Sinkronisasi** | Konfigurasi Supabase + sync manual |
| **Uji Cetak** | Cetak struk percobaan |

---

## 🔐 Manajemen Akun & Role

### Role & Hak Akses

| Fitur | Super Admin | Admin | Kasir | Gudang |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ❌ | ❌ |
| POS (Kasir) | ✅ | ✅ | ✅ | ❌ |
| Produk | ✅ | ✅ | ❌ | ✅ |
| Supplier | ✅ | ✅ | ❌ | ✅ |
| Restock | ✅ | ✅ | ❌ | ✅ |
| Retur | ✅ | ✅ | ❌ | ✅ |
| Pelanggan | ✅ | ✅ | ✅ | ❌ |
| Hutang/Piutang | ✅ | ✅ | ✅ | ❌ |
| Riwayat | ✅ | ✅ | ✅ | ❌ |
| Laporan | ✅ | ✅ | ❌ | ❌ |
| Pengeluaran | ✅ | ✅ | ❌ | ❌ |
| Diskon | ✅ | ✅ | ❌ | ❌ |
| Pengaturan | ✅ | ✅ | ❌ | ❌ |
| Manajemen Akun | ✅ | ❌ | ❌ | ❌ |

### Tambah Akun Baru (Super Admin)

1. Login sebagai `superadmin`
2. Buka **Pengaturan → Manajemen Akun**
3. Klik **Tambah Akun**
4. Isi username, nama lengkap, password, role
5. Simpan

> ⚠️ Akun `superadmin` dan `admin` **tidak bisa dihapus**.

---

## 🖨️ Printer & Barcode

### Printer Thermal (Windows/Desktop)
1. Buka **Pengaturan → Pengaturan Printer**
2. Pilih **lebar kertas** (58mm atau 80mm)
3. Atur **tinggi ekstra** jika printer memotong bagian bawah
4. Pilih **mode barcode** (SVG/PNG) sesuai driver printer
5. Klik **Uji Cetak** untuk verifikasi

### Printer Thermal (Android)
- Aplikasi mendeteksi platform Android otomatis
- Cetak struk via **RawBT** (aplikasi Android untuk printer thermal)
- Download RawBT: https://rawbt.ru/
- Jika redirect otomatis diblokir browser, ikuti instruksi overlay manual

### Scanner Barcode
- **Scanner hardware (HID Keyboard Mode)** — plug & play, bekerja global di seluruh aplikasi
- **Kamera** — klik ikon kamera di halaman POS → scan via kamera (ZXing)
- **Auto-match** — ketik SKU/barcode di kolom pencarian → otomatis masuk keranjang

### Cetak Label Barcode/Rak
1. Buka halaman **POS**
2. Klik ikon **printer** (di dekat pencarian)
3. Pilih produk (multi-select)
4. Pilih **jenis label** (Barcode / Rak)
5. Pilih **ukuran preset** (58×30, 58×40, 80×30, 80×50, A4 Grid, Label Rak, dll)
6. Atur harga promo (opsional)
7. Klik **Cetak**

---

## 📦 Import & Backup Data

### Import Produk Massal

**Format JSON:**
```json
[
  {
    "name": "Indomie Goreng",
    "sku": "IDM-GORENG",
    "barcode": "8991001101234",
    "category": "Makanan",
    "priceRetail": 3500,
    "priceWholesale": 3200,
    "priceCost": 2800,
    "stock": 100,
    "min_stock": 10
  }
]
```

**Cara import:**
1. Buka **Pengaturan → Import Produk**
2. Pilih file JSON (format array atau object dengan key `products`)
3. Konfirmasi → produk ditambahkan/diperbarui
4. Halaman reload otomatis

> 💡 Template tersedia di `public/import-products-template.json`

### Backup & Restore

**Backup:**
1. Buka **Pengaturan → Backup Data**
2. File JSON terunduh otomatis (berisi semua data)

**Restore:**
1. Buka **Pengaturan → Restore Data**
2. Pilih file backup JSON
3. Konfirmasi → semua data diganti dengan data backup
4. Halaman reload otomatis

> ⚠️ Restore **menghapus semua data saat ini** dan menggantinya dengan data backup!

---

## 🌐 Deployment

### Vercel (Recommended)
Project sudah memiliki `vercel.json`. Deploy langsung dari GitHub:
1. Import repository ke Vercel
2. Build command: `npm run build`
3. Output directory: `dist`

### Android (Capacitor)
```bash
npm run build
npx cap sync android
npx cap open android
```

### Windows Desktop (Tauri)
```bash
npm run tauri:dev      # Development
npm run tauri:build    # Build installer
```

### Local Network (LAN)
Lihat **`LOCAL_LAN_GUIDE.md`** untuk panduan menjalankan di jaringan lokal.

---

## ❓ FAQ

**Q: Apakah data hilang jika offline lama?**
> Tidak. Semua data tersimpan di Dexie (browser). SyncService akan mengirim ke Supabase otomatis saat online kembali.

**Q: Berapa lama sinkronisasi ke Supabase?**
> ~30 detik setelah online. Bisa dipaksa manual lewat tombol **Sync Sekarang** di Pengaturan.

**Q: Apa bedanya IndexedDB legacy dan Dexie?**
> Dexie adalah lapisan di atas IndexedDB yang lebih ringan dan terstruktur. IndexedDB legacy sudah tidak dipakai — semua operasi melalui Dexie.

**Q: Perlu menjalankan migrasi manual?**
> Tidak. Migrasi IndexedDB legacy → Dexie dilakukan otomatis saat startup (`migrateLegacyToDexie()`).

**Q: Bagaimana cara reset semua data?**
> Pengaturan → **Reset Aplikasi** → ketik "RESET" untuk konfirmasi.

**Q: Apakah mendukung multi-cabang?**
> Ya. Skema SQL `supabase-schema-offline-first.sql` sudah menyertakan tabel `branches`, `user_branches`, `devices`, dan kolom `branch_id` di semua tabel data.

**Q: Bagaimana keamanan data di cloud?**
> Skema SQL menyertakan **Row Level Security (RLS)** — superadmin akses semua, user biasa hanya akses data cabangnya sendiri.

---

## 📚 Dokumentasi Terkait

| Dokumen | Isi |
|---|---|
| **`OFFLINE_FIRST_ARCHITECTURE.md`** | Dokumentasi teknis arsitektur offline-first |
| **`SUPABASE_GUIDE.md`** | Panduan koneksi Supabase dari sisi UI |
| **`LOCAL_LAN_GUIDE.md`** | Panduan menjalankan di jaringan lokal |
| **`WINDOWS_DESKTOP_GUIDE.md`** | Panduan build Windows desktop |
| **`checklist.md`** | Checklist fitur offline-first |
| **`supabase-schema-offline-first.sql`** | Skema SQL lengkap (multi-tenant) |

---

## 📄 Lisensi

**Apache-2.0** — Silakan gunakan, modifikasi, dan distribusikan.

---

*Dokumentasi ini disusun berdasarkan analisis menyeluruh terhadap kode sumber project.*