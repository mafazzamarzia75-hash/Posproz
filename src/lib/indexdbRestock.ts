/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB, Firestore & PostgreSQL-enabled Service untuk Riwayat Restock / Masuk Barang
 * Mencatat setiap kali stok produk ditambahkan (restock)
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export interface RestockRecord {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  priceBuy: number;       // Harga beli per item (opsional)
  totalCost: number;      // qty * priceBuy
  stockBefore: number;
  stockAfter: number;
  supplierId: string;     // ID Supplier
  supplierName: string;   // Nama Supplier (denormalisasi)
  invoiceNumber: string;  // Nomor Faktur / Nota
  notes: string;
  created_at: number;
}

class IndexDBRestock {
  private dbName: string = "restockDB";
  private storeName: string = "restocks";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    // ✅ Gunakan versi 2 untuk menambah index supplierId
    const DB_VERSION = 2;

    this.initPromise = new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("productId", "productId", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
          store.createIndex("supplierId", "supplierId", { unique: false });
          store.createIndex("invoiceNumber", "invoiceNumber", { unique: false });
        } else {
          // ✅ Upgrade from v1 to v2: tambah index jika belum ada
          try { db.deleteObjectStore(this.storeName); } catch {}
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("productId", "productId", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
          store.createIndex("supplierId", "supplierId", { unique: false });
          store.createIndex("invoiceNumber", "invoiceNumber", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        console.error("IndexedDB restockDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("Database restock belum diinisialisasi.");
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  /**
   * ✅ Catat restock baru
   */
  async add(record: RestockRecord): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'restocks', record.id), record);
        console.log(`🟢 [Firebase]: Restock saved.`);
      } catch (err) {
        console.error("Firebase Save Restock Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `restocks/${record.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('restocks', record);
        console.log(`🟢 PG: Restock diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Restock Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).restocks.put({ ...record, sync_status: 'created', updated_at: Date.now() });
  }

  /**
   * ✅ Ambil semua riwayat restock, diurutkan terbaru
   */
  async getAll(): Promise<RestockRecord[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'restocks'));
        const fbRestocks = querySnapshot.docs.map(d => d.data() as RestockRecord);
        if (fbRestocks.length > 0) {
          for (const r of fbRestocks) {
            await (offlineDB as any).restocks.put({ ...r, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbRestocks.sort((a, b) => b.created_at - a.created_at);
        }
      } catch (err) {
        console.error("Firebase GetAll Restocks Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('restocks')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as RestockRecord[];
      } catch (err) {
        console.error("PG GetAll Restocks Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    const all = await (offlineDB as any).restocks.toArray();
    return all.sort((a: any, b: any) => b.created_at - a.created_at);
  }

  /**
   * ✅ Ambil riwayat restock untuk produk tertentu
   */
  async getByProductId(productId: string): Promise<RestockRecord[]> {
    const all = await this.getAll();
    return all.filter(r => r.productId === productId);
  }

  /**
   * ✅ Ambil riwayat restock hari ini
   */
  async getToday(): Promise<RestockRecord[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const all = await this.getAll();
    return all.filter(r => r.created_at >= todayStart.getTime());
  }

  /**
   * ✅ Hitung total biaya restock hari ini
   */
  async getTodayTotalCost(): Promise<number> {
    const today = await this.getToday();
    return today.reduce((sum, r) => sum + r.totalCost, 0);
  }

  /**
   * ✅ Hapus semua riwayat restock
   */
  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).restocks.clear();
  }

  generateId(): string {
    return `restock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const indexdbRestock = new IndexDBRestock();