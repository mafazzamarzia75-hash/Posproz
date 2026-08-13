# 🚀 Panduan Koneksi Supabase & Mode Offline-First

> **Versi berikut:** Aplikasi sudah berada pada arsitektur **Offline-First sejati (Dexie + SyncService)**. Satu konfigurasi di UI mengendalikan seluruh sistem.

Dokumen ini menjelaskan cara **mengaktifkan cloud synchronization (Supabase)** dan **memengaruhi mode offline-first** langsung dari antarmuka pengguna (UI) — tanpa perlu mengedit kode atau file `.env` secara manual.

---

## 📋 Ringkasan Arsitektur (Offline-First)

| Lapisan | Teknologi | Peran |
|---|---|---|
| **Satu-satunya database lokal** | **Dexie.js** (`PosPro_OfflineDB`) | Semua data (produk, transaksi, customer, dll) tersimpan di sini — baca & tulis |
| **Antrian sinkronisasi** | `syncQueue.ts` | Tulis ke Dexie → ditandai `sync_status` → dikirim ke cloud |
| **Sinkronisasi otomatis** | `SyncService.ts` | Membaca antrian tiap 30 detik → upsert/delete ke Supabase |
| **Cloud** | Supabase (PostgreSQL) | Replikasi online & konsolidasi data antar perangkat |

**Alur offline-first:**
```
UI (indexdb*)
  → Tulis: indexdb.save() → syncQueue.enqueueUpsert() → Dexie
  → Baca:  indexdb.getAll() → Dexie (sumber tunggal)
  → Sync otomatis: SyncService → Supabase → markAsSynced
```

---

## 🔧 Langkah 1: Siapkan Skema Database di Supabase

1. Buka [Supabase](https://supabase.com) dan buat/buka project Anda.
2. Buka **SQL Editor → New Query**, salin isi file:
   **`supabase-schema-lengkap.sql`** (ada di root project) — klik **Run**.

> ✅ Skema ini **idempoten** (aman dijalankan berulang). Membuat **12 tabel**:
> `products`, `customers`, `suppliers`, `sales`, `restocks`, `returs`,
> `debts`, `discounts`, `expenses`, `users`, `categories`, `sales`.

Sebelum menyimpan, schema sudah mencakup:
- **Index** (`id`, `sync_status`, `updated_at`) untuk performa sinkronisasi.
- **RLS + Policy dasar** agar data aman (lihat bagian 🔒 Keamanan).

---

## 🔑 Langkah 2: Konfigurasi Supabase lewat UI (Pengaturan)

> **Tidak perlu edit `.env`!** Semua dikonfigurasi lewat UI.

1. Buka aplikasi POS → masuk sebagai `superadmin` → buka **Menu Pengaturan**.
2. Cari kartu **「Mode Offline — IndexedDB」** (atau **「Koneksi Supabase Cloud」** jika sudah terhubung).
3. Klik area kartu untuk perbesar, lalu klik tombol **「Konfigurasi」**.
4. Isi kedua kolom:
   - **Supabase URL** → `https://[project-id].supabase.co`
   - **Supabase Anon Key** → key publik dari **Project Settings → API**
5. Klik **「Simpan Konfigurasi」** → halaman akan reload otomatis.

> 💡 Setelah reload, kartu berubah menjadi **「Koneksi Supabase Cloud」** dengan status **Online**.
> Data lama di IndexedDB legacy akan **migrate otomatis ke Dexie** pada startup pertama.

### 📋 Langkah-langkah Panduan (klik tombol Panduan)
Jika kesulitan, klik tombol **「Panduan」** di kartu — akan muncul wizard 5 langkah + tombol **Copy SQL Schema**.

---

## 🔌 Langkah 3: Pastikan Sdk Sudah Terpasang

Di `package.json` sudah ada dependency:
```json
"@supabase/supabase-js": "..."
```
Jika belum terpasang:
```bash
npm install @supabase/supabase-js
```

---

## 🔄 Langkah 4: Cara Sinkronisasi Offline-First Bekerja

| Skenario | Perilaku |
|---|---|
| **Online, data baru dibuat** | Data langsung tersimpan di Dexie + masuk antrian sync → dikirim ke Supabase otomatis (30 detik) |
| **Offline, data baru dibuat** | Data tersimpan di Dexie + antrian → **otomatis terkirim saat online kembali** |
| **Online, data dihapus** | Masuk antrian delete → dikirim ke Supabase + dihapus dari Dexie |
| **Koneksi putus saat sync** | SyncService retry otomatis saa koneksi pulih |
| **Belum konfigurasi Supabase** | Aplikasi bekerja 100% offline (hanya Dexie lokal) |

> 🧠 Semua operasi tulis (create/update/delete) **tidak pernah gagal karena offline** — data selalu aman di Dexie.

---

## 🧪 Langkah 5: Verifikasi Koneksi

Setelah menyimpan konfigurasi:
1. Buka **Pengaturan → kartu sinkronisasi**.
2. Karti akan menampilkan: **「Status: Online」**, **「Tabel Terhubung: 12」**, dan **「Antrian Pending: 0」**.
3. Buat transaksi uji (jual barang) — cek log di konsol:
   - `🟢 PG: Transaksi [...] diantrekan untuk sinkronisasi.`
   - `🟢 PG → Supabase OK`
   - `🟢 PG: Sync updated → marked synced.`

---

## 🔓 Langkah 6: Memutuskan Koneksi (Kembali ke Offline)

1. Buka **Pengaturan → kartu sinkronisasi**.
2. Klik **「Hapus Konfigurasi」** → konfirmasi.
3. Halaman reload → karti kembali ke **「Mode Offline — IndexedDB」**.
4. Aplikasi kembali bekerja 100% lokal (Dexie) — **tidak ada data cloud yang dihapus**.

---

## 🔒 Langkah 7: Keamanan (RLS) — Opsional

Jika deploy ke produksi:
1. Buka **Supabase Dashboard → Table Editor**.
2. Aktifkan **Row Level Security (RLS)** pada setiap tabel.
3. Tambahkan policy sesuai kebutuhan:
   - Super Admin: akses penuh.
   - Kasir/Gudang: READ/WRITE asasuai scope masing-masing.

Contoh policy untuk `products`:
```sql
CREATE POLICY "Allow full access for authenticated users"
ON products FOR ALL TO authenticated USING (true);
```

---

## ❓ FAQ

**Q: Apakah data hilang jika offline lama?**
> Tidak. Semua data tersimpan di Dexie (browser). SyncService akan menyampaikan ke Supabase otomatis saat online kembali.

**Q: Berapa lama sync ke Supabase?**
> ~30 detik setelah kembali online. Bisa dipaksa manual lewat tombol **「Sync Sekarang」** di karti.

**Q: Apa bedanya IndexedDB legacy dan Dexie?**
> Dexie adalah lapisan di atas IndexedDB yang lebih ringan dan terstruktur. **IndexedDB legacy sudah tidak lagi dipakai** — semua operasi membaca/menulis melalui Dexie saja.

**Q: Perlu jalankan migration kah?**
> Tidak perlu manual. Migrasi IndexedDB legacy → Dexie dilakukan **otomatis satu kali** di startup (`migrateLegacyToDexie()` di `main.tsx`).

---

*Panduan ini selalu update. Lihat juga `OFFLINE_FIRST_ARCHITECTURE.md` untuk dokumentasi teknis dari sisi developer/kodingan.*
</arg_value>
</write_to_file></tool_call>