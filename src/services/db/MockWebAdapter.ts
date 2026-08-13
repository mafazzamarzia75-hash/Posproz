/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAdapter } from './BaseAdapter';
import { IDatabase, QueryResult } from './IDatabase';

const DB_NAME = 'pos_ceria_db';
const DB_VERSION = 1;
const STORE_NAME = 'tables';

interface TableData {
  [key: string]: any[];
}

/**
 * MockWebAdapter — Menggunakan IndexedDB sebagai penyimpanan browser.
 * Lebih kuat dan besar daripada localStorage (~5MB).
 * Mendukung data lebih besar dan query sederhana.
 */
export class MockWebAdapter extends BaseAdapter {
  private db: IDBDatabase | null = null;
  private cache: TableData = {};
  private isDirty = false;

  async init(): Promise<void> {
    await this.retry(() => this.openIndexedDB(), 'init IndexedDB');
    await this.loadCache();
    this.isConnected = true;
    this.logger('info', 'MockWebAdapter (IndexedDB) siap.');
  }

  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private async loadCache(): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('data');
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        this.cache = request.result || { products: [], transactions: [], transaction_items: [] };
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveCache(): Promise<void> {
    if (!this.db || !this.isDirty) return;
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(this.cache, 'data');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    this.isDirty = false;
  }

  private getTableName(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('products')) return 'products';
    if (q.includes('transaction_items')) return 'transaction_items';
    if (q.includes('transactions')) return 'transactions';
    return 'unknown';
  }

  async execute(query: string, params: any[] = []): Promise<any> {
    const q = query.toLowerCase().trim();
    const table = this.getTableName(query);

    if (q.startsWith('create table') || q.startsWith('create index') || q.startsWith('pragma')) {
      // Schema operations diabaikan di mock adapter (tidak ada schema enforcement)
      return { changes: 0 };
    }

    if (q.includes('insert') || q.includes('replace')) {
      this.handleInsert(table, params);
    } else if (q.includes('update')) {
      this.handleUpdate(q, params);
    } else if (q.includes('delete')) {
      this.handleDelete(q, table, params);
    } else if (q.includes('vacuum')) {
      // No-op
    } else {
      this.logger('warn', 'Query tidak dikenali di MockWebAdapter:', query.substring(0, 50));
    }

    this.isDirty = true;
    await this.saveCache();
    return { changes: 1 };
  }

  private handleInsert(table: string, params: any[]) {
    if (table === 'products') {
      const columnCount = 8;
      for (let i = 0; i < params.length; i += columnCount) {
        const [id, sku, name, category, priceRetail, priceWholesale, stock, updated_at] = params.slice(i, i + columnCount);
        const index = this.cache.products.findIndex(p => p.id === id || p.sku === sku);
        const newItem = { id, sku, name, category, priceRetail, priceWholesale, stock, updated_at };
        if (index >= 0) this.cache.products[index] = newItem;
        else this.cache.products.push(newItem);
      }
    } else if (table === 'transactions') {
      const columnCount = 4;
      for (let i = 0; i < params.length; i += columnCount) {
        const [id, total, created_at, is_synced] = params.slice(i, i + columnCount);
        this.cache.transactions.push({ id, total, created_at, is_synced });
      }
    } else if (table === 'transaction_items') {
      const columnCount = 5;
      for (let i = 0; i < params.length; i += columnCount) {
        const [id, transaction_id, product_id, qty, price_at_sale] = params.slice(i, i + columnCount);
        this.cache.transaction_items.push({ id, transaction_id, product_id, qty, price_at_sale });
      }
    }
  }

  private handleUpdate(q: string, params: any[]) {
    if (q.includes('products set stock')) {
      const qty = params[0];
      const id = params[1];
      const prod = this.cache.products.find(p => p.id === id);
      if (prod) {
        prod.stock -= qty;
      }
    }
  }

  private handleDelete(q: string, table: string, params: any[]) {
    if (table === 'products' && params.length > 0) {
      this.cache.products = this.cache.products.filter(p => p.id !== params[0]);
    } else {
      this.cache[table] = [];
    }
  }

  async query(query: string, params: any[] = []): Promise<QueryResult> {
    const q = query.toLowerCase();
    const table = this.getTableName(query);
    let result = this.cache[table] || [];

    if (q.includes('count(*)')) {
      return { values: [{ count: result.length }] };
    }

    if (q.includes('where ti.transaction_id = ?')) {
      const trxId = params[0];
      const items = this.cache.transaction_items.filter(it => it.transaction_id === trxId);
      const joined = items.map(it => {
        const prod = this.cache.products.find(p => p.id === it.product_id);
        return { ...it, product_name: prod ? prod.name : 'Unknown' };
      });
      return { values: joined };
    }

    if (q.includes('where id = ?')) {
      return { values: result.filter(r => r.id === params[0]) };
    }

    if (q.includes('order by created_at desc')) {
      return { values: [...result].sort((a, b) => b.created_at - a.created_at) };
    }

    if (q.includes('order by updated_at desc')) {
      return { values: [...result].sort((a, b) => b.updated_at - a.updated_at) };
    }

    return { values: result };
  }

  async transaction(callback: (db: IDatabase) => Promise<void>): Promise<void> {
    // Simpan state sebelum transaksi untuk rollback sederhana
    const backup = JSON.parse(JSON.stringify(this.cache));
    try {
      await callback(this);
      await this.saveCache();
    } catch (e) {
      this.cache = backup;
      this.logger('error', 'Transaction rolled back', e);
      throw e;
    }
  }
}

