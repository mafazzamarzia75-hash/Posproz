/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
   * 🚀 PostgreSQL-enabled Product Database Service
   * Support hybrid cloud-local operation.
   * v2: Menambahkan index untuk pencarian & pagination cepat.
   */

import defaultData from "../services/db/DefaultData.json";
import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, getDoc, deleteDoc } from './legacyCloudDisabled';
import { generateUUID } from './uuidGenerator';

class IndexDBBarang {
  private dbName: string = "barangDB";
  private storeName: string = "barang";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      // 🔴 v2: Tambah index untuk pencarian & pagination cepat tanpa getAll
      const request = indexedDB.open(this.dbName, 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // ✅ Buat store jika belum ada (fresh install)
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
        // ✅ Buat index jika belum ada (upgrade dari v1 → v2)
        // 🔴 PENTING: index harus dibuat untuk database lama, bukan hanya fresh install!
        const store = (event.target as IDBOpenDBRequest).transaction!.objectStore(this.storeName);
        const INDEX_DEFS: Array<[string, string]> = [
          ["sku_idx", "sku"],
          ["barcode_idx", "barcode"],
          ["name_idx", "name"],
          ["category_idx", "category"],
          ["updated_at_idx", "updated_at"],
        ];
        for (const [indexName, keyPath] of INDEX_DEFS) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, keyPath, { unique: false });
          }
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        // ✅ Seed data setelah db siap, jangan blocking resolve
        this.seedData().catch(e => console.warn("seedData non-fatal:", e));
        resolve();
      };
      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private async seedData(): Promise<void> {
    try {
      const total = await this.count();
      if (total > 0 || !defaultData.data.products) return;
      const products = defaultData.data.products;
      for (const p of products) {
        const item = p as any;
        const sku = (item.sku || item.barcode || '').toString().trim();
        const id = item.id || `prod_${sku.toLowerCase().replace(/[^a-z0-9\-_]/g, ".")}`;
        const record = {
          id,
          name: item.name || '',
          sku,
          barcode: item.barcode || sku,
          category: item.category || 'Umum',
          priceRetail: item.priceRetail || item.price || 0,
          priceWholesale: item.priceWholesale || item.wholesale_price || 0,
          priceCost: item.priceCost || item.capitalPrice || 0,
          stock: item.stock || 0,
          min_stock: item.min_stock || 0,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        // ✅ Satu jalur: seed ke Dexie
        await (offlineDB as any).products.put({ ...record, sync_status: 'created', updated_at: Date.now() });

        // Jika Firebase terkonfigurasi pada boot pertama seed, sync ke cloud secara sepihak
        if (isFirebaseConfigured) {
          setDoc(doc(db, 'products', id), record).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Seed error products:", e);
    }
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  private mapFromPostgres(p: any): any {
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category: p.category || 'Umum',
      priceRetail: Number(p.price_retail ?? p.priceRetail ?? 0),
      priceWholesale: Number(p.price_wholesale ?? p.priceWholesale ?? 0),
      priceCost: Number(p.price_cost ?? p.priceCost ?? 0),
      stock: Number(p.stock ?? 0),
      min_stock: Number(p.min_stock ?? 0),
      supplierId: p.supplier_id || p.supplierId || '',
      supplierName: p.supplier_name || p.supplierName || '',
      created_at: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      updated_at: p.updated_at ? new Date(p.updated_at).getTime() : Date.now()
    };
  }

  private mapToPostgres(p: any): any {
    // Hanya kirim field yang terdefinisi agar tidak memicu 400 karena kolom kosong/undefined
    const data: any = {
      id: p.id,
      name: p.name,
      updated_at: new Date()
    };
    if (p.sku !== undefined && p.sku !== null && p.sku !== '') data.sku = p.sku;
    if (p.barcode !== undefined && p.barcode !== null && p.barcode !== '') data.barcode = p.barcode;
    if (p.category !== undefined && p.category !== null && p.category !== '') data.category = p.category;
    if (p.priceRetail !== undefined && p.priceRetail !== null) data.price_retail = p.priceRetail;
    if (p.priceWholesale !== undefined && p.priceWholesale !== null) data.price_wholesale = p.priceWholesale;
    if (p.priceCost !== undefined && p.priceCost !== null) data.price_cost = p.priceCost;
    if (p.stock !== undefined && p.stock !== null) data.stock = p.stock;
    if (p.min_stock !== undefined && p.min_stock !== null) data.min_stock = p.min_stock;
    if (p.supplierId !== undefined && p.supplierId !== null && p.supplierId !== '') data.supplier_id = p.supplierId;
    if (p.supplierName !== undefined && p.supplierName !== null && p.supplierName !== '') data.supplier_name = p.supplierName;
    return data;
  }

  async addBarang(barang: any): Promise<number> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'products', barang.id.toString()), barang);
        console.log(`🟢 [Firebase]: Barang ${barang.name} berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Insert Product Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `products/${barang.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('products', this.mapToPostgres(barang));
        console.log("🟢 PG: Barang diantrekan untuk sinkronisasi.");
      } catch (e) {
        console.error("PG Insert Product Error:", e);
      }
    }
    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).products.put({ ...barang, sync_status: 'created', updated_at: Date.now() });
    return 1;
  }

  async getBarang(id: string | number): Promise<any> {
    // ✅ Satu jalur: baca dari Dexie (PosPro_OfflineDB)
    try {
      const item = await (offlineDB as any).products.get(String(id));
      return item || null;
    } catch (e) {
      console.error("Dexie Get Product Error:", e);
      return null;
    }
  }

  async getAllBarang(): Promise<any[]> {
    // ✅ Satu jalur: baca dari Dexie (PosPro_OfflineDB)
    try {
      return await (offlineDB as any).products.toArray();
    } catch (e) {
      console.error("Dexie GetAll Products Error:", e);
      return [];
    }
  }

  async updateBarang(barang: any): Promise<void> {
    if (!barang.id && barang.id !== 0) {
      throw new Error("updateBarang: id wajib diisi.");
    }
    
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'products', barang.id.toString()), barang);
        console.log(`🟢 [Firebase]: Barang ${barang.name} berhasil di-update.`);
      } catch (err) {
        console.error("Firebase Update Product Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `products/${barang.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('products', this.mapToPostgres(barang));
        console.log("🟢 PG: Barang diantrekan untuk sinkronisasi.");
      } catch (e) {
        console.error("PG Upsert Product Error:", e);
      }
    }
    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).products.put({ ...barang, sync_status: 'updated', updated_at: Date.now() });
  }

  async deleteBarang(id: string | number): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'products', id.toString()));
        console.log(`🟢 [Firebase]: Barang [${id}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete Product Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('products', id.toString());
        console.log("🟢 PG: Barang diantrekan untuk dihapus.");
      } catch (e) {
        console.error("PG Delete Product Error:", e);
      }
    }
    // ✅ Satu jalur: hapus dari Dexie
    await (offlineDB as any).products.delete(String(id));
  }

  async count(): Promise<number> {
    // ✅ Satu jalur: hitung dari Dexie
    try {
      return await (offlineDB as any).products.count();
    } catch (e) {
      console.error("Dexie Count Product Error:", e);
      return 0;
    }
  }

  /**
   * ✅ Ambil halaman produk (sort terbaru dulu).
   * Satu jalur: baca semua dari Dexie lalu slice.
   */
  async getPaged(offset: number, limit: number): Promise<any[]> {
    const list = await this.getAllBarang();
    return list.slice(offset, offset + limit);
  }

  /**
   * ✅ Ambil halaman produk dengan filter kategori.
   */
  async getPagedProducts(offset: number, limit: number, category?: string): Promise<any[]> {
    const list = await this.getAllBarang();
    const filtered = category && category !== 'Semua'
      ? list.filter((p: any) => p.category === category)
      : list;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * ✅ Pencarian cepat (sortir & paginasi hasil).
   * Satu jalur: baca semua dari Dexie lalu filter.
   */
  async searchPaged(query: string, offset: number, limit: number): Promise<any[]> {
    const list = await this.getAllBarang();
    const q = query.toLowerCase().trim();
    const filtered = list.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.includes(query) ||
      p.sku?.includes(query)
    );
    return filtered.slice(offset, offset + limit);
  }

  /**
   * ✅ Dapatkan daftar kategori unik dari Dexie.
   */
  async getAllCategories(): Promise<string[]> {
    const data = await this.getAllBarang();
    const seen = new Set<string>();
    for (const p of data) {
      if (p.category) seen.add(p.category);
    }
    return [...seen];
  }

  async search(query: string): Promise<any[]> {
    return this.searchPaged(query, 0, 100);
  }

  async clearAll(): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        const list = await this.getAllBarang();
        for (const item of list) {
          await deleteDoc(doc(db, 'products', item.id.toString()));
        }
        console.log(`🟢 [Firebase]: Semua produk telah dibersihkan.`);
      } catch (err) {
        console.error("Firebase Clear Product Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const all = await this.getAllBarang();
        for (const p of all) {
          await enqueueDelete('products', p.id.toString());
        }
        console.log("🟢 PG: Semua barang diantrekan untuk dihapus.");
      } catch (e) {
        console.error("PG Clear Products Error:", e);
      }
    }
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).products.clear();
  }

  async migrateIds(): Promise<{ migrated: number; skipped: number }> {
    await this.initDb();
    const all = await this.getAllBarang();
    let migrated = 0;
    let skipped = 0;
    for (const p of all) {
      const sku = (p.sku || p.barcode || '').toString().trim();
      if (typeof p.id === 'string' && p.id.startsWith('prod_')) {
        skipped++;
        continue;
      }
      const newId = sku ? `prod_${sku.toLowerCase().replace(/[^a-z0-9\-_]/g, ".")}` : `prod_no_sku_${generateUUID()}`;
      await this.deleteBarang(p.id);
      await this.updateBarang({ ...p, id: newId });
      migrated++;
    }
    return { migrated, skipped };
  }

  async deduplicateBySku(): Promise<{ removed: number; kept: number }> {
    await this.initDb();
    const all = await this.getAllBarang();
    const byKey = new Map<string, any[]>();
    for (const p of all) {
      const key = (p.sku || p.barcode || '').toString().trim();
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p);
    }
    let removed = 0;
    for (const [, group] of byKey) {
      if (group.length <= 1) continue;
      group.sort((a, b) => b.updated_at - a.updated_at);
      for (let i = 1; i < group.length; i++) {
        await this.deleteBarang(group[i].id);
        removed++;
      }
    }
    return { removed, kept: all.length - removed };
  }
}

export const indexdbBarang = new IndexDBBarang();