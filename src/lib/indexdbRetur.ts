/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB, Firestore & PostgreSQL-enabled Service untuk Retur Barang
 * Mencatat retur penjualan (customer return) dan retur pembelian (return ke supplier)
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from './legacyCloudDisabled';

export interface ReturRecord {
  id: string;
  type: 'sale_return' | 'purchase_return';  // Retur penjualan / retur pembelian
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  price: number;           // Harga saat retur
  totalRefund: number;     // qty * price
  reason: string;          // Alasan retur
  // Untuk retur penjualan
  customerName: string;
  transactionId: string;
  // Untuk retur pembelian
  supplierName: string;
  supplierId: string;
  invoiceNumber: string;
  notes: string;
  created_at: number;
}

class IndexDBRetur {
  private dbName: string = "returDB";
  private storeName: string = "returs";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("productId", "productId", { unique: false });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        console.error("IndexedDB returDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("Database retur belum diinisialisasi.");
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async add(record: ReturRecord): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'returs', record.id), record);
        console.log(`🟢 [Firebase]: Retur saved.`);
      } catch (err) {
        console.error("Firebase Save Retur Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `returs/${record.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('returs', record);
        console.log(`🟢 PG: Retur diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Retur Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).returs.put({ ...record, sync_status: 'created', updated_at: Date.now() });
  }

  async getAll(): Promise<ReturRecord[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'returs'));
        const fbReturs = querySnapshot.docs.map(d => d.data() as ReturRecord);
        if (fbReturs.length > 0) {
          for (const r of fbReturs) {
            await (offlineDB as any).returs.put({ ...r, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbReturs.sort((a, b) => b.created_at - a.created_at);
        }
      } catch (err) {
        console.error("Firebase GetAll Returs Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('returs')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as ReturRecord[];
      } catch (err) {
        console.error("PG GetAll Returs Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    const all = await (offlineDB as any).returs.toArray();
    return all.sort((a: any, b: any) => b.created_at - a.created_at);
  }

  async getByType(type: 'sale_return' | 'purchase_return'): Promise<ReturRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.type === type);
  }

  async getByProductId(productId: string): Promise<ReturRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.productId === productId);
  }

  async getTotalRefundByType(type: 'sale_return' | 'purchase_return'): Promise<number> {
    const items = await this.getByType(type);
    return items.reduce((sum, r) => sum + r.totalRefund, 0);
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'returs', id));
        console.log(`🟢 [Firebase]: Retur deleted.`);
      } catch (err) {
        console.error("Firebase Delete Retur Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `returs/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('returs', id);
        console.log(`🟢 PG: Retur diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Retur Error:", err);
      }
    }

    // ✅ Satu jalur: hapus dari Dexie
    await (offlineDB as any).returs.delete(id);
  }

  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).returs.clear();
  }

  generateId(): string {
    return `retur_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const indexdbRetur = new IndexDBRetur();