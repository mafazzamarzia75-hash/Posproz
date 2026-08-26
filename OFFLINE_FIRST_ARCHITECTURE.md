# 🏗️ Dokumentasi Arsitektur Offline-First (Developer)

> **Tujuan:** Aplikasi POS ini menganadopsi sistem **offline-first** dengan **satu sumber database lokal (Dexie.js)** yang selalu tersinkron ke **Supabase (PostgreSQL)** lewat **SyncService**. Tidak ada lagi database IndexedDB legacy yang paralel.

---

## 1. Filosofi Offline-First

> Semuanya **bisa berjalan offline**. Data ditulis lokal dulu, kemudian disinkronkan ke cloud.
> Jika tidak ada konfigurasi Supabase → aplikasi 100% offline (hanya Dexie).

### Mantra
```
TULIS → selalu ke Dexie (lokal) → ditandai sync_status
BACA   → selalu dari Dexie (sumber tunggal)
SYNC   → SyncService kirim ke Supabase tiap 30 detik
```

---

## 2. Komponen Inti

### 2.1 `src/lib/dexieDb.ts` — Satu-satunya database lokal
- **Nama database:** `PosPro_OfflineDB`
- **Class:** `export class OfflineFirstDB extends Dexie`
- **12 tabel:** `products`, `customers`, `suppliers`, `transactions`, `restocks`, `returs`, `debts`, `discounts`, `expenses`, `users`, `categories`, `sales`
- **Interface kunci:** `SyncableEntity` — `{ id, sync_status, updated_at, created_at?, synced_at? }`
- **`SyncStatus`:** `'synced' | 'created' | 'updated' | 'deleted'`
- **`SYNC_TABLES`** — array 12 tabel (dipakai oleh `syncQueue` & `SyncService` secara dinamis)

### 2.2 `src/lib/syncQueue.ts` — Jembatan tulis ke Dexie + antrian sync
- **`enqueueUpsert(table, data)`** — simpan data ke Dexie, set `sync_status = 'created'` (atau `'updated'` jika sudah ada)
- **`enqueueDelete(table, id)`** — tandai `sync_status = 'deleted'` di Dexie (data tetap ada, SyncService akan hapus dari cloud lalu lokal)
- **`getAllLocal(table)`** — baca semua data dari Dexie (fallback baca)
- **`getLocalById(table, id)`** — baca satu data dari Dexie

### 2.3 `src/services/sync/SyncService.ts` — Sinkronisasi otomatis
- **`start()`** — loop tiap 30 detik; jika online, panggil `syncAll()`
- **`syncAll()`** — iterasi semua tabel di `SYNC_TABLES`, panggil `syncTable()`
- **`syncTable(table)`:**
  - Baca semua data dengan `sync_status` ∈ {`created`, `updated`, `deleted`} dari Dexie
  - **Upsert** (insert/update) data ke Supabase bagi `sync_status = 'created'|'updated'`
  - **Delete** data dari Supabase bagi `sync_status = 'deleted'`
  - Setelah berhasil → `markAsSynced(table, id)` (update `sync_status = 'synced'`, set `synced_at`)
  - Retry otomatis saat gagal

### 2.4 `src/lib/migrateLegacy.ts` — Migrasi satu kali
- **`migrateLegacyToDexie()`** — dipanggil sekali di `main.tsx`
- Menyalin data dari IndexedDB legacy (`barangDB`, `customerDB`, dll) → Dexie (`PosPro_OfflineDB`)
- Idempotent: data yang sudah ada di Dexie tidak ditimpa
- Jika migrasi gagal → non-fatal, aplikasi tetap berjalan

### 2.5 `src/lib/supabaseClient.ts` — Gatekeeper cloud
- Ekspor: `supabase` (client), `isPostgresConfigured` (boolean)
- `isPostgresConfigured` = apakah `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` ada di localStorage
- Jika `false` → semua blok `if (isPostgresConfigured)` di-skip → offline-only

### 2.6 File `indexdb*` (11 service) — Facade untuk UI
Setiap `indexdb*` adalah facade yang **membaca & menulis lewat Dexie**:
- **Tulis:** operasi save/delete → `enqueueUpsert`/`enqueueDelete` (ke Dexie) + `(offlineDB as any).<table>.put/delete()` — tidak pernah menulis langsng ke Supabase
- **Baca:** operasi getAll/getById/count → `(offlineDB as any).<table>.toArray()/.get()/.count()` — selalu dari Dexie
- Blok `if (isPostgresConfigured)` (supabase **baca**) pada method baca **pertahankan** sebagai cache sekunder

---

## 3. Flow Data Rinci

### 3.1 Menulis data (mis. buat transaksi jual)
```
indexdbTransaksi.create(total, items)
  ├─ if (isPostgresConfigured)
  │     → enqueueUpsert('sales', data)   // ke Dexie queue
  └─ (offlineDB as any).sales.put(...)   // ke Dexie (satu-satunya storage)
      → mark sync_status = 'created'
      → SyncService sync → Supabase → markAsSynced
```

### 3.2 Membaca data (mis. tampilkan semua produk)
```
indexdbBarang.getAllBarang()
  ├─ if (isPostgresConfigured)     → supabase.select() → return datanya langsung
  └─ FALLBACK: (offlineDB as any).products.toArray()  // sumber utama offline-first
```

### 3.3 Startup aplikasi
```
main.tsx
  → migrateLegacyToDexie()         // migrasi IndexedDB legacy → Dexie (satu kali)
  → <App /> render
  → SettingsPage mount
    → DatabaseService.init()       // print mode DB
    → SyncService.start()          // loop 30 detik sync ke Supabase
    → SupabaseSyncCard mount       // tampilkan pending counts di UI
```

---

## 4. Tabel & Mapping (12 tabel)

| IndexedDB legacy (lama) | Dexie table (baru) | Tabel Supabase |
|---|---|---|
| `barangDB` / `barang` | `products` | `products` |
| `transaksiDB` / `transaksi` / `sales` | `sales` | `sales` |
| `customerDB` | `customers` | `customers` |
| `supplierDB` | `suppliers` | `suppliers` |
| `debtDB` | `debts` | `debts` |
| `discountDB` | `discounts` | `discounts` |
| `restockDB` | `restocks` | `restocks` |
| `returDB` | `returs` | `returs` |
| `expenseDB` | `expenses` | `expenses` |
| `userDB` | `users` | `users` |
| `categoryDB` | `categories` | `categories` |

> ⚠️ Catatan: Dexie juga memiliki tabel `transactions` (digunakan oleh `OfflineFirstAdapter` legacy) dan `sales` (sumber utama UI). Kedatabel disinkronkan ke Supabase.

---

## 5. Cara Debug

| Masalah | Cara Debug |
|---|---|
| Data tidak sync ke Supabase | Buka konsol → cek log `🟢 PG: ... diantrekan untuk sinkronisasi.` dan `🟢 PG → Supabase OK`. Pastikan `isPostgresConfigured = true`. |
| Data tidak muncul setelah offline lama | Buka **Settings → kartu sync** → lihat `Antrian Pending`. Klik `Sync Sekarang`. |
| IndexedDB legacy masih ada | Buka DevTools → Application → IndexedDB → lihat `barangDB`, dll. Mereka tidak lagi dipakai — boleh dihapus manual. |
| Build error / lint | `npm run lint` |

---

## 6. Prinsip Pengembangan (AGENTS.md)

- **Satu jalur saja:** semua `indexdb*` membaca & menulis lewat Dexie. **Jangan** menambah IndexedDB store baru.
- **Tulis async + try-catch:** semue operasi ke Supabase (langsung maupun via syncQueue) wajib dibungkinkan `try-catch`.
- **Loading state:** semua aksi Save/Delete/Update wajib pakai `isLoading` + disable tombol.
- **Immutability:** `syncQueue` dan `SyncService` membuat objek baru, jangan memutasi data langsung.
- **No unnecessary changes:** jangan refactor `initDb`/`getObjectStore` legacy yang masih ada — biarkan (mereka tidak dipanggil untuk operasi utama lagi).

---

## 7. File Penting (Quick Reference)

```
src/
├── main.tsx                    # startup + migrasi
├── lib/
│   ├── dexieDb.ts              # schema Dexie (12 tabel)
│   ├── syncQueue.ts            # enqueueUpsert / enqueueDelete
│   ├── migrateLegacy.ts        # migrasi satu kali → Dexie
│   ├── supabaseClient.ts       # isPostgresConfigured, clearSupabaseConfig
│   ├── indexdbBarang.ts        # facade → Dexie 'products'
│   ├── indexdbTransaksi.ts     # facade → Dexie 'sales'
│   ├── indexdbCustomer.ts      # facade → Dexie 'customers'
│   ├── indexdbSupplier.ts      # facade → Dexie 'suppliers'
│   ├── indexdbDebt.ts          # facade → Dexie 'debts'
│   ├── indexdbDiscount.ts      # facade → Dexie 'discounts'
│   ├── indexdbRestock.ts       # facade → Dexie 'restocks'
│   ├── indexdbRetur.ts         # facade → Dexie 'returs'
│   ├── indexdbExpense.ts       # facade → Dexie 'expenses'
│   ├── indexdbCategory.ts      # facade → Dexie 'categories'
│   └── indexdbUser.ts          # facade → Dexie 'users'
├── services/
│   └── sync/SyncService.ts     # sync loop 30 detik → Supabase
└── components/sync/
    └── SupabaseSyncCard.tsx    # UI konfigurasi di Pengaturan
```

---

*Kode telah dianalisis mandiri, aman, dan mematuhi batas cakupan logika.*