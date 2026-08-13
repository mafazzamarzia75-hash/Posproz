/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * OfflineFirst Database Adapter Implementation
 */

import { offlineDB, Product, Customer, Supplier, Transaction, Restock, Retur, SyncStatus } from '@/lib/dexieDb';
import { syncService } from '@/services/sync/SyncService';
import { createProduct, createCustomer, createSupplier, updateEntity } from '@/lib/entityBuilders';
import { generateUUID } from '@/lib/uuidGenerator';

/**
 * Product Adapter - Specialized untuk Products table
 */
export class ProductAdapter {
  async getAll(): Promise<Product[]> {
    try {
      // Pull latest dari server di background jika online
      if (navigator.onLine) {
        syncService.pullFromSupabase('products').catch(console.error);
      }
      return await offlineDB.products.toArray();
    } catch (error) {
      console.error('Error getting all products:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Product | undefined> {
    return offlineDB.products.get(id);
  }

  async create(data: Omit<Product, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Product> {
    const product = createProduct(data);
    await offlineDB.products.put(product);

    if (navigator.onLine) {
      syncService.syncTableOnly('products').catch(console.error);
    }

    return product;
  }

  async update(id: string, data: Partial<Product>): Promise<Product | undefined> {
    const existing = await offlineDB.products.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.products.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('products').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const product = await offlineDB.products.get(id);
    if (!product) return;

    await offlineDB.products.put({
      ...product,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('products').catch(console.error);
    }
  }

  async getByCategory(category: string): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter((p) => p.category === category);
  }

  async getBySupplier(supplierId: string): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter((p) => p.supplierId === supplierId);
  }

  async getLowStock(threshold: number = 10): Promise<Product[]> {
    const all = await this.getAll();
    return all.filter((p) => p.stock < threshold);
  }

  async getPendingSyncs(): Promise<Product[]> {
    return (await offlineDB.getPendingSyncData('products')) as Product[];
  }

  async createBatch(items: Omit<Product, 'id' | 'sync_status' | 'updated_at' | 'created_at'>[]): Promise<Product[]> {
    const products = items.map(createProduct);
    await offlineDB.products.bulkPut(products);

    if (navigator.onLine) {
      syncService.syncTableOnly('products').catch(console.error);
    }

    return products;
  }
}

/**
 * Customer Adapter
 */
export class CustomerAdapter {
  async getAll(): Promise<Customer[]> {
    try {
      if (navigator.onLine) {
        syncService.pullFromSupabase('customers').catch(console.error);
      }
      return await offlineDB.customers.toArray();
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Customer | undefined> {
    return offlineDB.customers.get(id);
  }

  async create(data: Omit<Customer, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Customer> {
    const customer = createCustomer(data);
    await offlineDB.customers.put(customer);

    if (navigator.onLine) {
      syncService.syncTableOnly('customers').catch(console.error);
    }

    return customer;
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer | undefined> {
    const existing = await offlineDB.customers.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.customers.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('customers').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const customer = await offlineDB.customers.get(id);
    if (!customer) return;

    await offlineDB.customers.put({
      ...customer,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('customers').catch(console.error);
    }
  }

  async getByPhone(phone: string): Promise<Customer | undefined> {
    const all = await this.getAll();
    return all.find((c) => c.phone === phone);
  }

  async getByEmail(email: string): Promise<Customer | undefined> {
    const all = await this.getAll();
    return all.find((c) => c.email === email);
  }

  async getByCity(city: string): Promise<Customer[]> {
    const all = await this.getAll();
    return all.filter((c) => c.city === city);
  }
}

/**
 * Supplier Adapter
 */
export class SupplierAdapter {
  async getAll(): Promise<Supplier[]> {
    try {
      if (navigator.onLine) {
        syncService.pullFromSupabase('suppliers').catch(console.error);
      }
      return await offlineDB.suppliers.toArray();
    } catch (error) {
      console.error('Error getting all suppliers:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Supplier | undefined> {
    return offlineDB.suppliers.get(id);
  }

  async create(data: Omit<Supplier, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Supplier> {
    const supplier = createSupplier(data);
    await offlineDB.suppliers.put(supplier);

    if (navigator.onLine) {
      syncService.syncTableOnly('suppliers').catch(console.error);
    }

    return supplier;
  }

  async update(id: string, data: Partial<Supplier>): Promise<Supplier | undefined> {
    const existing = await offlineDB.suppliers.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.suppliers.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('suppliers').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const supplier = await offlineDB.suppliers.get(id);
    if (!supplier) return;

    await offlineDB.suppliers.put({
      ...supplier,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('suppliers').catch(console.error);
    }
  }

  async getActive(): Promise<Supplier[]> {
    const all = await this.getAll();
    return all.filter((s) => s.is_active === true);
  }

  async getByEmail(email: string): Promise<Supplier | undefined> {
    const all = await this.getAll();
    return all.find((s) => s.email === email);
  }
}

/**
 * Transaction Adapter
 */
export class TransactionAdapter {
  async getAll(): Promise<Transaction[]> {
    try {
      if (navigator.onLine) {
        syncService.pullFromSupabase('transactions').catch(console.error);
      }
      return await offlineDB.transactions.toArray();
    } catch (error) {
      console.error('Error getting all transactions:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Transaction | undefined> {
    return offlineDB.transactions.get(id);
  }

  async create(data: Omit<Transaction, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Transaction> {
    const transaction: Transaction = {
      id: generateUUID(),
      sync_status: 'created',
      updated_at: Date.now(),
      created_at: Date.now(),
      ...data,
    };
    await offlineDB.transactions.put(transaction);

    if (navigator.onLine) {
      syncService.syncTableOnly('transactions').catch(console.error);
    }

    return transaction;
  }

  async update(id: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const existing = await offlineDB.transactions.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.transactions.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('transactions').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const transaction = await offlineDB.transactions.get(id);
    if (!transaction) return;

    await offlineDB.transactions.put({
      ...transaction,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('transactions').catch(console.error);
    }
  }

  async getByCustomer(customerId: string): Promise<Transaction[]> {
    const all = await this.getAll();
    return all.filter((t) => t.customer_id === customerId);
  }

  async getByDate(startDate: number, endDate: number): Promise<Transaction[]> {
    const all = await this.getAll();
    return all.filter((t) => t.transaction_date >= startDate && t.transaction_date <= endDate);
  }

  async getByType(type: string): Promise<Transaction[]> {
    const all = await this.getAll();
    return all.filter((t) => t.transaction_type === (type as any));
  }

  async getTotalRevenue(): Promise<number> {
    const all = await this.getAll();
    return all
      .filter((t) => t.transaction_type === 'penjualan' && t.sync_status === 'synced')
      .reduce((sum, t) => sum + t.total_amount, 0);
  }
}

/**
 * Restock Adapter
 */
export class RestockAdapter {
  async getAll(): Promise<Restock[]> {
    try {
      if (navigator.onLine) {
        syncService.pullFromSupabase('restocks').catch(console.error);
      }
      return await offlineDB.restocks.toArray();
    } catch (error) {
      console.error('Error getting all restocks:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Restock | undefined> {
    return offlineDB.restocks.get(id);
  }

  async create(data: Omit<Restock, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Restock> {
    const restock: Restock = {
      id: generateUUID(),
      sync_status: 'created',
      updated_at: Date.now(),
      created_at: Date.now(),
      ...data,
    };
    await offlineDB.restocks.put(restock);

    if (navigator.onLine) {
      syncService.syncTableOnly('restocks').catch(console.error);
    }

    return restock;
  }

  async update(id: string, data: Partial<Restock>): Promise<Restock | undefined> {
    const existing = await offlineDB.restocks.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.restocks.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('restocks').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const restock = await offlineDB.restocks.get(id);
    if (!restock) return;

    await offlineDB.restocks.put({
      ...restock,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('restocks').catch(console.error);
    }
  }

  async getBySupplier(supplierId: string): Promise<Restock[]> {
    const all = await this.getAll();
    return all.filter((r) => r.supplier_id === supplierId);
  }

  async getByDate(startDate: number, endDate: number): Promise<Restock[]> {
    const all = await this.getAll();
    return all.filter((r) => r.restock_date >= startDate && r.restock_date <= endDate);
  }

  async getTotalExpense(): Promise<number> {
    const all = await this.getAll();
    return all
      .filter((r) => r.sync_status === 'synced')
      .reduce((sum, r) => sum + r.total_amount, 0);
  }
}

/**
 * Retur Adapter
 */
export class ReturAdapter {
  async getAll(): Promise<Retur[]> {
    try {
      if (navigator.onLine) {
        syncService.pullFromSupabase('returs').catch(console.error);
      }
      return await offlineDB.returs.toArray();
    } catch (error) {
      console.error('Error getting all returs:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Retur | undefined> {
    return offlineDB.returs.get(id);
  }

  async create(data: Omit<Retur, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Promise<Retur> {
    const retur: Retur = {
      id: generateUUID(),
      sync_status: 'created',
      updated_at: Date.now(),
      created_at: Date.now(),
      ...data,
    };
    await offlineDB.returs.put(retur);

    if (navigator.onLine) {
      syncService.syncTableOnly('returs').catch(console.error);
    }

    return retur;
  }

  async update(id: string, data: Partial<Retur>): Promise<Retur | undefined> {
    const existing = await offlineDB.returs.get(id);
    if (!existing) return undefined;

    const updated = updateEntity(existing, data);
    await offlineDB.returs.put(updated);

    if (navigator.onLine) {
      syncService.syncTableOnly('returs').catch(console.error);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const retur = await offlineDB.returs.get(id);
    if (!retur) return;

    await offlineDB.returs.put({
      ...retur,
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });

    if (navigator.onLine) {
      syncService.syncTableOnly('returs').catch(console.error);
    }
  }

  async getByType(type: 'customer' | 'supplier'): Promise<Retur[]> {
    const all = await this.getAll();
    return all.filter((r) => r.retur_type === type);
  }

  async getByDate(startDate: number, endDate: number): Promise<Retur[]> {
    const all = await this.getAll();
    return all.filter((r) => r.retur_date >= startDate && r.retur_date <= endDate);
  }
}

/**
 * Export singletons untuk global use
 */
export const productAdapter = new ProductAdapter();
export const customerAdapter = new CustomerAdapter();
export const supplierAdapter = new SupplierAdapter();
export const transactionAdapter = new TransactionAdapter();
export const restockAdapter = new RestockAdapter();
export const returAdapter = new ReturAdapter();
