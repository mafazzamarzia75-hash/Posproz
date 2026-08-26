/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dexie Database Schema untuk Offline-First
 */

import Dexie, { Table } from 'dexie';

/**
 * Sync Status untuk setiap data
 * - 'synced': Data sudah tersimpan di Supabase
 * - 'created': Data baru, belum disinkronisasi ke Supabase
 * - 'updated': Data sudah ada, telah diupdate, belum disinkronisasi
 * - 'deleted': Data sudah dihapus, belum disinkronisasi
 */
export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted';

/**
 * Base interface untuk semua entitas yang disinkronisasi
 */
export interface SyncableEntity {
  id: string; // UUID
  sync_status: SyncStatus;
  updated_at: number; // timestamp in milliseconds
  created_at?: number; // timestamp in milliseconds
  synced_at?: number; // timestamp terakhir sinkronisasi
}

/**
 * Product/Barang Schema
 */
export interface Product extends SyncableEntity {
  sku: string;
  name: string;
  category: string;
  priceRetail: number;
  priceWholesale: number;
  priceCost: number;
  stock: number;
  supplierId?: string;
  supplierName?: string;
  description?: string;
  barcode?: string;
  image_url?: string;
}

/**
 * Customer Schema
 */
export interface Customer extends SyncableEntity {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  credit_limit?: number;
  credit_used?: number;
  notes?: string;
}

/**
 * Supplier Schema
 */
export interface Supplier extends SyncableEntity {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  contact_person?: string;
  notes?: string;
  is_active: boolean;
}

/**
 * Transaction/Transaksi Schema
 */
export interface Transaction extends SyncableEntity {
  transaction_type: 'penjualan' | 'pembelian' | 'retur' | 'adjustment';
  transaction_date: number; // timestamp
  customer_id?: string;
  supplier_id?: string;
  items: TransactionItem[];
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  notes?: string;
  cashier_id?: string;
  is_draft: boolean;
}

export interface TransactionItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  subtotal: number;
}

/**
 * Restock Schema (Masuk)
 */
export interface Restock extends SyncableEntity {
  restock_date: number;
  supplier_id: string;
  items: RestockItem[];
  total_amount: number;
  notes?: string;
  warehouse_id?: string;
}

export interface RestockItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/**
 * Retur Schema
 */
export interface Retur extends SyncableEntity {
  retur_date: number;
  retur_type: 'customer' | 'supplier';
  reference_id?: string; // transaction_id atau restock_id
  items: ReturItem[];
  total_amount: number;
  reason?: string;
  notes?: string;
}

export interface ReturItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/**
 * Dexie Database Class
 */
export class OfflineFirstDB extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  suppliers!: Table<Supplier>;
  transactions!: Table<Transaction>;
  restocks!: Table<Restock>;
  returs!: Table<Retur>;
  debts!: Table<SyncableEntity & Record<string, any>>;
  discounts!: Table<SyncableEntity & Record<string, any>>;
  expenses!: Table<SyncableEntity & Record<string, any>>;
  users!: Table<SyncableEntity & Record<string, any>>;
  categories!: Table<SyncableEntity & Record<string, any>>;
  sales!: Table<SyncableEntity & Record<string, any>>;

  constructor() {
    super('PosPro_OfflineDB');
    this.version(1).stores({
      // Primary key = id, indexed: sync_status & updated_at untuk query sinkronisasi
      products: 'id, sync_status, updated_at, category, sku',
      customers: 'id, sync_status, updated_at, phone, email',
      suppliers: 'id, sync_status, updated_at, email',
      transactions: 'id, sync_status, updated_at, transaction_date, customer_id',
      restocks: 'id, sync_status, updated_at, restock_date, supplier_id',
      returs: 'id, sync_status, updated_at, retur_date',
    });
    this.version(2).stores({
      products: 'id, sync_status, updated_at, category, sku',
      customers: 'id, sync_status, updated_at, phone, email',
      suppliers: 'id, sync_status, updated_at, email',
      transactions: 'id, sync_status, updated_at, transaction_date, customer_id',
      restocks: 'id, sync_status, updated_at, restock_date, supplier_id',
      returs: 'id, sync_status, updated_at, retur_date',
      debts: 'id, sync_status, updated_at',
      discounts: 'id, sync_status, updated_at',
      expenses: 'id, sync_status, updated_at',
      users: 'id, sync_status, updated_at',
      categories: 'id, sync_status, updated_at',
      sales: 'id, sync_status, updated_at',
    });
  }

  /**
   * Daftar semua tabel yang disinkronisasi
   */
  static readonly SYNC_TABLES = [
    'products', 'customers', 'suppliers', 'transactions', 'restocks', 'returs',
    'debts', 'discounts', 'expenses', 'users', 'categories', 'sales',
  ] as const;

  /**
   * Getter instance agar offlineDB.SYNC_TABLES valid (mengakses static member)
   */
  get SYNC_TABLES() {
    return OfflineFirstDB.SYNC_TABLES;
  }

  /**
   * Dapatkan semua data yang belum disinkronisasi
   */
  async getPendingSyncData(table: (typeof OfflineFirstDB.SYNC_TABLES)[number]) {
    return (this as any)[table]
      .where('sync_status')
      .anyOf(['created', 'updated', 'deleted'])
      .toArray();
  }

  /**
   * Update sync status setelah sinkronisasi berhasil
   */
  async markAsSynced(
    table: (typeof OfflineFirstDB.SYNC_TABLES)[number],
    id: string
  ) {
    await (this as any)[table].update(id, {
      sync_status: 'synced',
      synced_at: Date.now(),
      updated_at: Date.now(),
    } as any);
  }

  /**
   * Update sync status untuk multiple items
   */
  async markMultipleAsSynced(
    table: (typeof OfflineFirstDB.SYNC_TABLES)[number],
    ids: string[]
  ) {
    await Promise.all(
      ids.map((id) =>
        (this as any)[table].update(id, {
          sync_status: 'synced',
          synced_at: Date.now(),
          updated_at: Date.now(),
        } as any)
      )
    );
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const counts = await Promise.all(
      OfflineFirstDB.SYNC_TABLES.map((table) =>
        (this as any)[table]
          .where('sync_status')
          .anyOf(['created', 'updated', 'deleted'])
          .count()
      )
    );
    const total = counts.reduce((a, b) => a + b, 0);
    const result: Record<string, number> = { total };
    OfflineFirstDB.SYNC_TABLES.forEach((table, i) => {
      result[table] = counts[i];
    });
    return result;
  }
}

// Export singleton instance
export const offlineDB = new OfflineFirstDB();
