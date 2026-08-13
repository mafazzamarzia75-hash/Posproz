/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB & Firestore-enabled Service untuk Data Supplier
 * Menyimpan data pemasok barang secara offline & online
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebaseClient';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
  npwp: string;           // ✅ Nomor Pokok Wajib Pajak
  notes: string;
  productCount: number;
  totalPurchases: number;
  created_at: number;
  updated_at: number;
}

class IndexDBSupplier {
  private dbName: string = "supplierDB";
  private storeName: string = "suppliers";
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
          store.createIndex("name", "name", { unique: false });
          store.createIndex("phone", "phone", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        console.error("IndexedDB supplierDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error("Database supplier not initialized.");
    }
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async getAll(): Promise<Supplier[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'suppliers'));
        const fbSuppliers = querySnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            contactPerson: data.contactPerson || '',
            npwp: data.npwp || '',
            notes: data.notes || '',
            productCount: Number(data.productCount ?? 0),
            totalPurchases: Number(data.totalPurchases ?? 0),
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Supplier;
        });

        if (fbSuppliers.length > 0) {
          // Sync senyap ke local Dexie
          for (const s of fbSuppliers) {
            await (offlineDB as any).suppliers.put({ ...s, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbSuppliers;
        }
      } catch (err) {
        console.error("Firebase GetAll Suppliers Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) return data as Supplier[];
      } catch (err) {
        console.error("PG GetAll Suppliers Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).suppliers.toArray();
  }

  async getById(id: string): Promise<Supplier | undefined> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'suppliers', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            contactPerson: data.contactPerson || '',
            npwp: data.npwp || '',
            notes: data.notes || '',
            productCount: Number(data.productCount ?? 0),
            totalPurchases: Number(data.totalPurchases ?? 0),
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Supplier;
        }
      } catch (err) {
        console.error("Firebase Get Supplier Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) return data as Supplier;
      } catch (err) {
        console.error("PG Get Supplier Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).suppliers.get(id);
  }

  async save(supplier: Supplier): Promise<void> {
    if (!supplier.id) {
      throw new Error("Supplier id is required");
    }

    const freshSupplier = {
      ...supplier,
      phone: supplier.phone || '',
      address: supplier.address || '',
      contactPerson: supplier.contactPerson || '',
      npwp: supplier.npwp || '',
      notes: supplier.notes || '',
      productCount: Number(supplier.productCount || 0),
      totalPurchases: Number(supplier.totalPurchases || 0),
      created_at: supplier.created_at || Date.now(),
      updated_at: Date.now(),
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'suppliers', freshSupplier.id), freshSupplier);
        console.log(`🟢 [Firebase]: Supplier saved.`);
      } catch (err) {
        console.error("Firebase Save Supplier Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `suppliers/${freshSupplier.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('suppliers', freshSupplier);
        console.log(`🟢 PG: Supplier diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Supplier Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).suppliers.put({ ...freshSupplier, sync_status: 'updated', updated_at: Date.now() });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
        console.log(`🟢 [Firebase]: Supplier deleted.`);
      } catch (err) {
        console.error("Firebase Delete Supplier Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('suppliers', id);
        console.log(`🟢 PG: Supplier diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Supplier Error:", err);
      }
    }

    // ✅ Satu jalur: hapus dari Dexie
    await (offlineDB as any).suppliers.delete(id);
  }

  async search(query: string): Promise<Supplier[]> {
    const all = await this.getAll();
    const q = query.toLowerCase().trim();
    return all.filter(
      (s: Supplier) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(query) ||
        s.npwp?.includes(query) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
    );
  }

  async count(): Promise<number> {
    // ✅ Satu jalur: hitung dari Dexie
    return (offlineDB as any).suppliers.count();
  }

  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).suppliers.clear();
  }
}

export const indexdbSupplier = new IndexDBSupplier();
