/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 PostgreSQL-enabled Category Database Service
 */

import { supabase, isPostgresConfigured } from './supabaseClient';
import { enqueueUpsert, enqueueDelete } from './syncQueue';
import { offlineDB } from './dexieDb';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType, collection, getDocs, doc, setDoc, deleteDoc } from './legacyCloudDisabled';

class IndexDBCategory {
  private dbName: string = "categoryDB";
  private storeName: string = "categories";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private initDb(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "name" });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = (event) => {
        this.initPromise = null; // ✅ Reset agar bisa retry
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
    return this.initPromise;
  }

  private getObjectStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error("DB not init");
    return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async getAll(): Promise<string[]> {
    const defaults = ['Makanan', 'Minuman', 'Elektronik', 'Alat Tulis', 'Umum'];
    
    if (isFirebaseConfigured) {
      try {
        const querySnapshot = await getDocs(collection(db, 'categories'));
        const fbNames = querySnapshot.docs.map(d => d.id);
        const mergedFb = [...new Set([...defaults, ...fbNames])].sort();
        // Simpan juga ke local Dexie secara senyap agar data offline tetap memadai
        for (const name of fbNames) {
          await (offlineDB as any).categories.put({ id: name, name, sync_status: 'synced', updated_at: Date.now() });
        }
        return mergedFb;
      } catch (err) {
        console.error("Firebase GetAll Categories Error:", err);
      }
    }

    if (isPostgresConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name')
          .order('name', { ascending: true });
        if (!error && data) {
          const customNames = data.map((c: any) => c.name);
          return [...new Set([...defaults, ...customNames])].sort();
        }
      } catch (err) {
        console.error("PG GetAll Categories Error:", err);
      }
    }

    // ✅ Satu jalur: baca dari Dexie
    const data = await (offlineDB as any).categories.toArray();
    const customNames = data.map((c: any) => c.name || c.id || c);
    const merged = [...new Set([...defaults, ...customNames])].sort();
    return merged;
  }

  async add(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'categories', trimmed), { name: trimmed });
        console.log(`🟢 [Firebase]: Kategori [${trimmed}] berhasil disimpan.`);
      } catch (err) {
        console.error("Firebase Add Category Error:", err);
        handleFirestoreError(err, OperationType.WRITE, `categories/${trimmed}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        // Kategori memakai name sebagai kunci → set id = name agar kompatibel syncQueue
        await enqueueUpsert('categories', { id: trimmed, name: trimmed });
        console.log(`🟢 PG: Kategori [${trimmed}] diantrekan untuk sinkronisasi.`);
      } catch (err) {
        console.error("PG Add Category Error:", err);
      }
    }

    // ✅ Satu jalur: tulis ke Dexie
    try {
      await (offlineDB as any).categories.put({ id: trimmed, name: trimmed, sync_status: 'created', updated_at: Date.now() });
      return true;
    } catch {
      return false;
    }
  }

  async delete(name: string): Promise<boolean> {
    const defaults = ['Makanan', 'Minuman', 'Elektronik', 'Alat Tulis', 'Umum'];
    if (defaults.includes(name)) return false;

    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'categories', name));
        console.log(`🟢 [Firebase]: Kategori [${name}] berhasil dihapus.`);
      } catch (err) {
        console.error("Firebase Delete Category Error:", err);
        handleFirestoreError(err, OperationType.DELETE, `categories/${name}`);
      }
    }

    if (isPostgresConfigured) {
      try {
        await enqueueDelete('categories', name);
        console.log(`🟢 PG: Kategori [${name}] diantrekan untuk dihapus.`);
      } catch (err) {
        console.error("PG Delete Category Error:", err);
      }
    }

    // ✅ Satu jalur: hapus dari Dexie
    await (offlineDB as any).categories.delete(name);
    return true;
  }

  async clearAll(): Promise<void> {
    if (isPostgresConfigured) {
      try {
        const all = await this.getAll();
        for (const name of all) {
          await enqueueDelete('categories', name);
        }
      } catch (e) {
        console.error("PG Clear Categories Error:", e);
      }
    }
    // ✅ Satu jalur: bersihkan Dexie
    await (offlineDB as any).categories.clear();
  }
}

export const indexdbCategory = new IndexDBCategory();
