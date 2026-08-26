/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ IndexedDB, Firestore & PostgreSQL-enabled Service untuk Data Pelanggan (Customer)
 * Menyimpan data pelanggan dan riwayat transaksi per pelanggan secara luring & daring
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from './legacyCloudDisabled';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalSpent: number;
  totalTransactions: number;
  lastTransaction: number | null;
  notes: string;
  created_at: number;
  updated_at: number;
}

class IndexDBCustomer {
  private dbName: string = "customerDB";
  private storeName: string = "customers";
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
        console.error("IndexedDB customerDB error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error("Database customer not initialized.");
    }
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  private mapFromPostgres(c: any): Customer {
    return {
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      totalSpent: Number(c.total_spent ?? 0),
      totalTransactions: Number(c.total_transactions ?? 0),
      lastTransaction: c.last_transaction ? new Date(c.last_transaction).getTime() : null,
      notes: c.notes || '',
      created_at: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
      updated_at: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
    };
  }

  private mapToPostgres(c: Customer): any {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      total_spent: c.totalSpent,
      total_transactions: c.totalTransactions,
      last_transaction: c.lastTransaction ? new Date(c.lastTransaction).toISOString() : null,
      notes: c.notes,
      updated_at: new Date(),
    };
  }

  async getAll(): Promise<Customer[]> {
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'customers'));
        const fbCustomers = querySnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            totalSpent: Number(data.totalSpent ?? 0),
            totalTransactions: Number(data.totalTransactions ?? 0),
            lastTransaction: data.lastTransaction ? Number(data.lastTransaction) : null,
            notes: data.notes || '',
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Customer;
        });

        if (fbCustomers.length > 0) {
          // Sync senyap ke local Dexie
          for (const c of fbCustomers) {
            await (offlineDB as any).customers.put({ ...c, sync_status: 'synced', updated_at: Date.now() });
          }
          return fbCustomers;
        }
      } catch (err) {
        console.error("Firebase GetAll Customers Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) return data.map(c => this.mapFromPostgres(c));
      } catch (err) {
        console.error("PG GetAll Customers Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).customers.toArray();
  }

  async getById(id: string): Promise<Customer | undefined> {
    if (isFirebaseConfigured) {
      try {
        const docSnap = await getDoc(doc(db, 'customers', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: data.id,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            totalSpent: Number(data.totalSpent ?? 0),
            totalTransactions: Number(data.totalTransactions ?? 0),
            lastTransaction: data.lastTransaction ? Number(data.lastTransaction) : null,
            notes: data.notes || '',
            created_at: Number(data.created_at || Date.now()),
            updated_at: Number(data.updated_at || Date.now()),
          } as Customer;
        }
      } catch (err) {
        console.error("Firebase Get Customer Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) return this.mapFromPostgres(data);
      } catch (err) {
        console.error("PG Get Customer Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    return (offlineDB as any).customers.get(id);
  }

  async search(query: string): Promise<Customer[]> {
    const all = await this.getAll();
    const q = query.toLowerCase().trim();
    return all.filter(
      (c: Customer) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(query)
    );
  }

  async save(customer: Customer): Promise<void> {
    if (!customer.id) {
      throw new Error("Customer id is required");
    }

    const freshCustomer = {
      ...customer,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      totalSpent: Number(customer.totalSpent || 0),
      totalTransactions: Number(customer.totalTransactions || 0),
      created_at: customer.created_at || Date.now(),
      updated_at: Date.now(),
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'customers', freshCustomer.id), freshCustomer);
        console.log(`🟢 [Firebase]: Customer saved.`);
      } catch (err) {
        console.error("Firebase Save Customer Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `customers/${freshCustomer.id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueUpsert('customers', this.mapToPostgres(freshCustomer));
        console.log(`🟢 PG: Customer diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Save Customer Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    await (offlineDB as any).customers.put({ ...freshCustomer, sync_status: 'updated', updated_at: Date.now() });
  }

  async delete(id: string): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        console.log(`🟢 [Firebase]: Customer deleted.`);
      } catch (err) {
        console.error("Firebase Delete Customer Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('customers', id);
        console.log(`🟢 PG: Customer diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Customer Error:", err);
      }
    }

    if (!isPostgresConfigured) {
      await (offlineDB as any).customers.delete(id);
    }
  }

  /**
   * ✅ Update statistik customer setelah transaksi
   */
  async updateStats(id: string, totalAmount: number): Promise<void> {
    const customer = await this.getById(id);
    if (!customer) return;

    await this.save({
      ...customer,
      totalSpent: (customer.totalSpent || 0) + totalAmount,
      totalTransactions: (customer.totalTransactions || 0) + 1,
      lastTransaction: Date.now(),
    });
  }

  async count(): Promise<number> {
    // ✅ Satu jalur: hitung dari Dexie
    return (offlineDB as any).customers.count();
  }

  async clearAll(): Promise<void> {
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).customers.clear();
  }
}

export const indexdbCustomer = new IndexDBCustomer();