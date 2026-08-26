/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB, Firestore & PostgreSQL-enabled Service untuk Diskon & Promo
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from './legacyCloudDisabled';

export interface Discount {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'nominal';
  value: number;
  minPurchase: number;
  maxDiscount: number;
  isActive: boolean;
  usageLimit: number;
  usageCount: number;
  validFrom: number;
  validUntil: number;
  created_at: number;
  updated_at: number;
}

export interface ActiveDiscount {
  discountId: string;
  code: string;
  type: 'percentage' | 'nominal';
  value: number;
  name: string;
}

class IndexDBDiscount {
  private dbName: string = "discountDB";
  private storeName: string = "discounts";
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("code", "code", { unique: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => {
        console.error("discountDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getAll(): Promise<Discount[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'discounts'));
        const fbDiscounts = querySnapshot.docs.map(d => d.data() as Discount);
        if (fbDiscounts.length > 0) {
          for (const d of fbDiscounts) {
            await (offlineDB as any).discounts.put({ ...d, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbDiscounts;
        }
      } catch (err) {
        console.error("Firebase GetAll Discounts Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('discounts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) return data as Discount[];
      } catch (err) {
        console.error("PG GetAll Discounts Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).discounts.toArray();
  }

  async save(d: Discount): Promise<void> {
    const freshDiscount = { ...d, updated_at: Date.now() };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'discounts', freshDiscount.id), freshDiscount);
        console.log(`🟢 [Firebase]: Discount saved.`);
      } catch (err) {
        console.error("Firebase Save Discount Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `discounts/${freshDiscount.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('discounts', freshDiscount);
        console.log(`🟢 PG: Discount diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Discount Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).discounts.put({ ...freshDiscount, sync_status: 'updated', updated_at: Date.now() });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'discounts', id));
        console.log(`🟢 [Firebase]: Discount deleted.`);
      } catch (err) {
        console.error("Firebase Delete Discount Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `discounts/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('discounts', id);
        console.log(`🟢 PG: Discount diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Discount Error:", err);
      }
    }

    if (!isPostgresConfigured) {
      await (offlineDB as any).discounts.delete(id);
    }
  }

  /** Validasi kode diskon: cek apakah aktif, masih berlaku, belum melebihi limit */
  async validateCode(code: string, total: number): Promise<{ valid: boolean; discount?: ActiveDiscount; error?: string }> {
    await this.initDb();
    const all = await this.getAll();
    const d = all.find(x => x.code.toUpperCase() === code.toUpperCase().trim());

    if (!d) return { valid: false, error: 'Kode diskon tidak ditemukan' };
    if (!d.isActive) return { valid: false, error: 'Kode diskon sudah tidak aktif' };
    if (d.validUntil < Date.now()) return { valid: false, error: 'Kode diskon sudah kedaluwarsa' };
    if (d.validFrom > Date.now()) return { valid: false, error: 'Kode diskon belum berlaku' };
    if (d.usageLimit > 0 && d.usageCount >= d.usageLimit) return { valid: false, error: 'Kode diskon sudah habis digunakan' };
    if (total < d.minPurchase) return { valid: false, error: `Minimal belanja ${d.minPurchase.toLocaleString('id-ID')}` };

    const rawDiscount = d.type === 'percentage' ? Math.round(total * d.value / 100) : d.value;
    const diskonFinal = d.maxDiscount > 0 ? Math.min(rawDiscount, d.maxDiscount) : rawDiscount;

    return {
      valid: true,
      discount: {
        discountId: d.id,
        code: d.code,
        type: d.type,
        value: diskonFinal,
        name: d.name,
      }
    };
  }

  /** Tambah pemakaian kode diskon */
  async incrementUsage(id: string): Promise<void> {
    const all = await this.getAll();
    const d = all.find(x => x.id === id);
    if (d) {
      d.usageCount = (d.usageCount || 0) + 1;
      await this.save(d);
    }
  }

  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).discounts.clear();
  }

  generateId(): string { return `disc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
}

export const indexdbDiscount = new IndexDBDiscount();