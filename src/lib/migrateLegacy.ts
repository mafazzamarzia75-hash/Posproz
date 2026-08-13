/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 Migrasi Satu Kali: IndexedDB Legacy → Dexie (PosPro_OfflineDB)
 * Menyalin semua data dari database IndexedDB lama ke Dexie,
 * sehingga aplikasi hanya memakai SATU jalur penyimpanan (Dexie).
 * Aman dijalankan berulang (idempotent) — data yang sudah ada di Dexie tidak ditimpa.
 */

import { offlineDB } from './dexieDb';

// Mapping: nama store IndexedDB legacy → nama tabel Dexie
const LEGACY_STORES: Record<string, string> = {
  barangDB: 'products',
  transaksiDB: 'sales',
  customerDB: 'customers',
  supplierDB: 'suppliers',
  debtDB: 'debts',
  discountDB: 'discounts',
  expenseDB: 'expenses',
  userDB: 'users',
  categoryDB: 'categories',
  restockDB: 'restocks',
  returDB: 'returs',
};

/**
 * Baca semua data dari satu store IndexedDB legacy.
 */
function readLegacyStore(dbName: string, storeName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result || []);
      };
      getAll.onerror = () => {
        db.close();
        reject(getAll.error);
      };
    };
  });
}

/**
 * Jalankan migrasi. Mengembalikan jumlah item yang disalin per tabel.
 */
export async function migrateLegacyToDexie(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  for (const [legacyDb, dexieTable] of Object.entries(LEGACY_STORES)) {
    try {
      // Nama store di IndexedDB legacy = nama tabel (kecuali barangDB → 'barang')
      const legacyStore = legacyDb === 'barangDB' ? 'barang' : dexieTable;
      const items = await readLegacyStore(legacyDb, legacyStore);
      let copied = 0;

      for (const item of items) {
        if (!item || item.id === undefined) continue;
        const existing = await (offlineDB as any)[dexieTable].get(item.id);
        if (existing) continue; // Jangan timpa data yang sudah ada di Dexie

        // Kategori legacy memakai 'name' sebagai kunci → set id = name
        const record = dexieTable === 'categories'
          ? { id: item.name ?? item.id, name: item.name ?? item.id, sync_status: 'created', updated_at: Date.now() }
          : { ...item, sync_status: 'created', updated_at: item.updated_at ?? Date.now() };

        await (offlineDB as any)[dexieTable].put(record);
        copied++;
      }

      result[dexieTable] = copied;
      if (copied > 0) {
        console.log(`🔄 Migrasi: ${legacyDb} → ${dexieTable}: ${copied} item disalin.`);
      }
    } catch (e) {
      console.error(`❌ Migrasi ${legacyDb} gagal:`, e);
      result[dexieTable] = 0;
    }
  }

  return result;
}