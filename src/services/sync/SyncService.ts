/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Sync Service - Sinkronisasi IndexedDB dengan Supabase
 */

import { supabase, isPostgresConfigured } from '@/lib/supabaseClient';
import { offlineDB, SyncStatus } from '@/lib/dexieDb';
import { offlineDetector } from './OfflineDetector';

export type TableName = (typeof offlineDB.SYNC_TABLES)[number];

export interface SyncResult {
  table: TableName;
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface SyncStats {
  isOnline: boolean;
  isSyncing: boolean;
  pendingItems: number;
  lastSyncTime?: number;
  results?: SyncResult[];
}

/**
 * Sync Service untuk manage sinkronisasi data
 */
class SyncService {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs = 30000; // Sync setiap 30 detik
  private syncListeners: Set<(stats: SyncStats) => void> = new Set();
  private currentSyncPromise: Promise<SyncResult[]> | null = null;

  constructor() {
    // 🔴 GUARD: Jika Supabase tidak dikonfigurasi, jangan mulai sync sama sekali
    // Mencegah error backend dari placeholder URL & request yang tidak perlu
    if (!isPostgresConfigured) {
      console.log('ℹ️ [SyncService]: Supabase tidak dikonfigurasi — sinkronisasi cloud dinonaktifkan.');
      return;
    }

    // Subscribe ke offline detector
    offlineDetector.subscribe((isOnline) => {
      if (isOnline) {
        console.log('🔄 Device online, starting sync...');
        this.startPeriodicSync();
      } else {
        console.log('⏸️ Device offline, pausing sync...');
        this.stopPeriodicSync();
      }
    });

    // 🔴 NON-BLOCKING: Tunda sync pertama agar tidak memblokir render awal aplikasi
    // SyncService.sync() memproses 12 tabel secara berurutan ke Supabase — sangat berat
    // saat startup. Delay 3 detik memberi waktu UI untuk render terlebih dahulu.
    if (offlineDetector.getStatus()) {
      setTimeout(() => {
        this.startPeriodicSync();
      }, 3000);
    }
  }

  /**
   * Subscribe ke sync status updates
   */
  subscribe(callback: (stats: SyncStats) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify sync listeners
   */
  private notifySyncListeners() {
    this.broadcastStats();
  }

  /**
   * Broadcast current sync stats
   */
  private async broadcastStats() {
    const stats = await this.getSyncStats();
    this.syncListeners.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Get current sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    const stats = await offlineDB.getSyncStats();
    return {
      isOnline: offlineDetector.getStatus(),
      isSyncing: this.isSyncing,
      pendingItems: stats.total,
      lastSyncTime: this.lastSyncTime || undefined,
    };
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error);
    }, this.syncIntervalMs);
    // Sync immediately
    this.sync().catch(console.error);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Main sync function - sync semua tables
   */
  async sync(): Promise<SyncResult[]> {
    // 🔴 GUARD: Jangan sync jika Supabase tidak dikonfigurasi
    if (!isPostgresConfigured) {
      return [];
    }

    if (!offlineDetector.getStatus()) {
      console.warn('⚠️ Device offline, cannot sync');
      return [];
    }

    if (this.isSyncing) {
      console.warn('⚠️ Sync already in progress');
      return [];
    }

    this.isSyncing = true;
    this.notifySyncListeners();

    try {
      const tables: TableName[] = [...offlineDB.SYNC_TABLES];
      const results: SyncResult[] = [];

      for (const table of tables) {
        try {
          const result = await this.syncTable(table);
          results.push(result);
          console.log(`✅ ${table}: ${result.successful}/${result.total} synced`);
        } catch (error) {
          console.error(`❌ Error syncing ${table}:`, error);
          results.push({
            table,
            total: 0,
            successful: 0,
            failed: 0,
            errors: [{ id: '', error: String(error) }],
          });
        }
      }

      this.lastSyncTime = Date.now();
      this.notifySyncListeners();

      return results;
    } finally {
      this.isSyncing = false;
      this.notifySyncListeners();
    }
  }

  /**
   * Sync single table
   */
  private async syncTable(table: TableName): Promise<SyncResult> {
    const pendingData = await offlineDB.getPendingSyncData(table);

    if (pendingData.length === 0) {
      return { table, total: 0, successful: 0, failed: 0, errors: [] };
    }

    const errors: Array<{ id: string; error: string }> = [];
    let successful = 0;

    // Process each item
    for (const item of pendingData) {
      try {
        const syncStatus = item.sync_status as SyncStatus;

        if (syncStatus === 'deleted') {
          // Handle delete
          await this.deleteFromSupabase(table, item.id);
        } else {
          // Handle create/update via upsert
          await this.upsertToSupabase(table, item);
        }

        // Mark as synced
        await offlineDB.markAsSynced(table, item.id);
        successful++;
      } catch (error) {
        console.error(`Error syncing ${table} item ${item.id}:`, error);
        errors.push({
          id: item.id,
          error: String(error),
        });
      }
    }

    return {
      table,
      total: pendingData.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Upsert data ke Supabase menggunakan .upsert()
   * Upsert akan INSERT jika id tidak ada, atau UPDATE jika id sudah ada
   */
  private async upsertToSupabase(table: TableName, item: any) {
    // Siapkan data untuk upsert
    let dataToUpsert = { ...item };
    delete dataToUpsert.sync_status; // Jangan kirim sync_status ke server

    // Map camelCase local fields -> snake_case Supabase columns
    dataToUpsert = table === 'products'
      ? this.mapProductToPostgres(dataToUpsert)
      : this.mapEntityToPostgres(table, dataToUpsert);

    // Tambahkan server metadata
    dataToUpsert.updated_at = new Date(dataToUpsert.updated_at).toISOString();
    if (dataToUpsert.created_at) {
      dataToUpsert.created_at = new Date(dataToUpsert.created_at).toISOString();
    }
    if (dataToUpsert.synced_at) {
      dataToUpsert.synced_at = new Date(dataToUpsert.synced_at).toISOString();
    }

    const { error } = await supabase
      .from(table)
      .upsert(dataToUpsert, {
        onConflict: 'id', // Gununakan id sebagai unique constraint
      });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
  }

  /**
   * Map camelCase product fields from local Dexie to snake_case Supabase columns.
   * Hanya kirim field yang valid untuk menghindari 400 Bad Request.
   */
  private mapProductToPostgres(product: any): any {
    const data: any = {
      id: product.id,
      name: product.name,
      updated_at: new Date()
    };
    if (product.sku) data.sku = product.sku;
    if (product.barcode) data.barcode = product.barcode;
    if (product.category) data.category = product.category;
    if (product.priceRetail !== undefined && product.priceRetail !== null) data.price_retail = product.priceRetail;
    if (product.priceWholesale !== undefined && product.priceWholesale !== null) data.price_wholesale = product.priceWholesale;
    if (product.priceCost !== undefined && product.priceCost !== null) data.price_cost = product.priceCost;
    if (product.stock !== undefined && product.stock !== null) data.stock = product.stock;
    if (product.min_stock !== undefined && product.min_stock !== null) data.min_stock = product.min_stock;
    if (product.supplierId) data.supplier_id = product.supplierId;
    if (product.supplierName) data.supplier_name = product.supplierName;
    if (product.description) data.description = product.description;
    if (product.image_url) data.image_url = product.image_url;
    if (product.created_at) data.created_at = new Date(product.created_at).toISOString();
    return data;
  }

  private mapProductFromPostgres(product: any): any {
    return {
      ...product,
      priceRetail: Number(product.price_retail ?? product.priceRetail ?? 0),
      priceWholesale: Number(product.price_wholesale ?? product.priceWholesale ?? 0),
      priceCost: Number(product.price_cost ?? product.priceCost ?? 0),
      supplierId: product.supplier_id ?? product.supplierId ?? '',
      supplierName: product.supplier_name ?? product.supplierName ?? '',
      min_stock: Number(product.min_stock ?? 0),
    };
  }

  private mapEntityToPostgres(table: TableName, item: any): any {
    const data = { ...item };
    const fieldMaps: Partial<Record<TableName, Record<string, string>>> = {
      customers: { totalSpent: 'total_spent', totalTransactions: 'total_transactions', lastTransaction: 'last_transaction' },
      suppliers: { contactPerson: 'contact_person', productCount: 'product_count', totalPurchases: 'total_purchases' },
      transactions: { transactionType: 'transaction_type', transactionDate: 'transaction_date', customerId: 'customer_id', supplierId: 'supplier_id', totalAmount: 'total_amount', paidAmount: 'paid_amount', paymentMethod: 'payment_method', isDraft: 'is_draft', isDeleted: 'is_deleted' },
      restocks: { productId: 'product_id', productName: 'product_name', productSku: 'product_sku', priceBuy: 'price_buy', totalCost: 'total_cost', stockBefore: 'stock_before', stockAfter: 'stock_after', supplierId: 'supplier_id', supplierName: 'supplier_name', invoiceNumber: 'invoice_number' },
      returs: { productId: 'product_id', productName: 'product_name', productSku: 'product_sku', totalRefund: 'total_refund', customerName: 'customer_name', transactionId: 'transaction_id', supplierName: 'supplier_name', supplierId: 'supplier_id', invoiceNumber: 'invoice_number' },
      debts: { customerId: 'customer_id', customerName: 'customer_name', supplierId: 'supplier_id', supplierName: 'supplier_name', paidAmount: 'paid_amount', dueDate: 'due_date' },
      discounts: { minPurchase: 'min_purchase', maxDiscount: 'max_discount', isActive: 'is_active', usageLimit: 'usage_limit', usageCount: 'usage_count', validFrom: 'valid_from', validUntil: 'valid_until' },
      users: { isActive: 'is_active' },
      sales: { customerName: 'customer_name', paymentMethod: 'payment_method', paidAmount: 'paid_amount', discountAmount: 'discount_amount' },
    };

    for (const [localKey, serverKey] of Object.entries(fieldMaps[table] || {})) {
      if (data[localKey] !== undefined && data[serverKey] === undefined) {
        data[serverKey] = data[localKey];
      }
      delete data[localKey];
    }
    return data;
  }

  /**
   * Delete data dari Supabase
   */
  private async deleteFromSupabase(table: TableName, id: string) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  }

  /**
   * Manual sync trigger (untuk button atau testing)
   */
  async syncNow(): Promise<SyncResult[]> {
    return this.sync();
  }

  /**
   * Sync specific table only
   */
  async syncTableOnly(table: TableName): Promise<SyncResult> {
    // 🔴 GUARD: Jangan sync jika Supabase tidak dikonfigurasi
    if (!isPostgresConfigured) {
      return { table, total: 0, successful: 0, failed: 0, errors: [] };
    }

    if (!offlineDetector.getStatus()) {
      throw new Error('Device offline');
    }
    return this.syncTable(table);
  }

  /**
   * Pull data dari Supabase ke IndexedDB (untuk sync dari server)
   */
  async pullFromSupabase(table: TableName) {
    // 🔴 GUARD: Jangan pull jika Supabase tidak dikonfigurasi
    if (!isPostgresConfigured) {
      return;
    }

    if (!offlineDetector.getStatus()) {
      console.warn('⚠️ Device offline, cannot pull from server');
      return;
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) throw error;

      if (!data) return;

      // Update local data
      for (const item of data) {
        const localItem = await offlineDB[table].get(item.id);
        const localSyncStatus = localItem?.sync_status as SyncStatus | undefined;
        if (localSyncStatus === 'created' || localSyncStatus === 'updated' || localSyncStatus === 'deleted') {
          continue;
        }

        const localData = table === 'products' ? this.mapProductFromPostgres(item) : { ...item };
        // Convert timestamps
        if (localData.updated_at) {
          localData.updated_at = new Date(localData.updated_at).getTime();
        }
        if (localData.created_at) {
          localData.created_at = new Date(localData.created_at).getTime();
        }
        if (localData.synced_at) {
          localData.synced_at = new Date(localData.synced_at).getTime();
        }

        // Ensure sync_status is synced
        localData.sync_status = 'synced';

        await offlineDB[table].put(localData as any);
      }

      console.log(`✅ Pulled ${data.length} items from ${table}`);
    } catch (error) {
      console.error(`❌ Error pulling from ${table}:`, error);
    }
  }

  /**
   * Clear all pending syncs
   */
  async clearPendingSyncs() {
    await offlineDB.clearSyncedData();
    this.notifySyncListeners();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopPeriodicSync();
    this.syncListeners.clear();
  }
}

// Export singleton instance
export const syncService = new SyncService();