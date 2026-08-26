/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ PostgreSQL & Firestore-enabled Service untuk Hutang & Piutang
 * Mencatat utang pelanggan dan piutang ke supplier offline & online
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from './legacyCloudDisabled';

export interface Debt {
  id: string;
  type: 'receivable' | 'payable';  // receivable = piutang (pelanggan utang ke kita), payable = hutang (kita utang ke supplier)
  customerId?: string | null;
  customerName: string;
  supplierId?: string | null;
  supplierName: string;
  amount: number;
  paidAmount: number;
  description: string;
  dueDate: number;
  status: 'unpaid' | 'partial' | 'paid';
  created_at: number;
  updated_at: number;
}

class IndexDBDebt {
  private dbName: string = "debtDB";
  private storeName: string = "debts";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("dueDate", "dueDate", { unique: false });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        console.error("debtDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getAll(): Promise<Debt[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'debts'));
        const fbDebts = querySnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: data.id,
            type: data.type,
            customerId: data.customerId || null,
            customerName: data.customerName || '',
            supplierId: data.supplierId || null,
            supplierName: data.supplierName || '',
            amount: Number(data.amount ?? 0),
            paidAmount: Number(data.paidAmount ?? 0),
            description: data.description || '',
            dueDate: data.dueDate ? Number(data.dueDate) : Date.now(),
            status: data.status || 'unpaid',
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Debt;
        });

        if (fbDebts.length > 0) {
          // Sync senyap ke local Dexie
          for (const d of fbDebts) {
            await (offlineDB as any).debts.put({ ...d, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbDebts;
        }
      } catch (err) {
        console.error("Firebase GetAll Debts Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('debts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) return data as Debt[];
      } catch (err) {
        console.error("PG GetAll Debts Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).debts.toArray();
  }

  async save(d: Debt): Promise<void> {
    const freshDebt = {
      ...d,
      customerId: d.customerId || null,
      supplierId: d.supplierId || null,
      updated_at: Date.now(),
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'debts', freshDebt.id), freshDebt);
        console.log(`🟢 [Firebase]: Debt saved.`);
      } catch (err) {
        console.error("Firebase Save Debt Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `debts/${freshDebt.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('debts', freshDebt);
        console.log(`🟢 PG: Debt diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Debt Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).debts.put({ ...freshDebt, sync_status: 'updated', updated_at: Date.now() });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'debts', id));
        console.log(`🟢 [Firebase]: Debt deleted.`);
      } catch (err) {
        console.error("Firebase Delete Debt Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `debts/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('debts', id);
        console.log(`🟢 PG: Debt diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Debt Error:", err);
      }
    }

    if (!isPostgresConfigured) {
      await (offlineDB as any).debts.delete(id);
    }
  }

  async search(query: string): Promise<Debt[]> {
    const all = await this.getAll();
    const q = query.toLowerCase().trim();
    return all.filter(d =>
      d.customerName.toLowerCase().includes(q) ||
      d.supplierName.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  }

  async getByType(type: 'receivable' | 'payable'): Promise<Debt[]> {
    const all = await this.getAll();
    return all.filter(d => d.type === type).sort((a, b) => b.created_at - a.created_at);
  }

  async getTotalReceivable(): Promise<number> {
    const all = await this.getByType('receivable');
    return all.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
  }

  async getTotalPayable(): Promise<number> {
    const all = await this.getByType('payable');
    return all.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
  }

  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).debts.clear();
  }

  generateId(): string { return `debt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
}

export const indexdbDebt = new IndexDBDebt();
