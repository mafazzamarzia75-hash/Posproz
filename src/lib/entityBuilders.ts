/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Entity Builders - Helper untuk create entities dengan format yang benar
 */

import { generateUUID } from '@/lib/uuidGenerator';
import {
  Product,
  Customer,
  Supplier,
  Transaction,
  Restock,
  Retur,
  TransactionItem,
  RestockItem,
  ReturItem,
} from '@/lib/dexieDb';

/**
 * Builder untuk Product
 */
export const createProduct = (data: Omit<Product, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Product => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Builder untuk Customer
 */
export const createCustomer = (data: Omit<Customer, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Customer => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Builder untuk Supplier
 */
export const createSupplier = (data: Omit<Supplier, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Supplier => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Builder untuk Transaction
 */
export const createTransaction = (
  data: Omit<Transaction, 'id' | 'sync_status' | 'updated_at' | 'created_at'>
): Transaction => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Builder untuk Restock
 */
export const createRestock = (data: Omit<Restock, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Restock => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Builder untuk Retur
 */
export const createRetur = (data: Omit<Retur, 'id' | 'sync_status' | 'updated_at' | 'created_at'>): Retur => ({
  id: generateUUID(),
  sync_status: 'created',
  updated_at: Date.now(),
  created_at: Date.now(),
  ...data,
});

/**
 * Update entity dengan proper sync_status
 */
export const updateEntity = <T extends { sync_status: string; updated_at: number }>(
  entity: T,
  updates: Partial<T>
): T => {
  return {
    ...entity,
    ...updates,
    sync_status: entity.sync_status === 'synced' ? 'updated' : entity.sync_status,
    updated_at: Date.now(),
  };
};

/**
 * Mark entity as deleted (soft delete)
 */
export const markAsDeleted = <T extends { sync_status: string; updated_at: number }>(entity: T): T => {
  return {
    ...entity,
    sync_status: 'deleted' as any,
    updated_at: Date.now(),
  };
};

/**
 * Batch create products
 */
export const createProductsBatch = (
  items: Omit<Product, 'id' | 'sync_status' | 'updated_at' | 'created_at'>[]
): Product[] => {
  return items.map(createProduct);
};

/**
 * Helper untuk create transaction items dengan calculation
 */
export const createTransactionItem = (
  productId: string,
  quantity: number,
  unitPrice: number,
  discount: number = 0
): TransactionItem => {
  const subtotal = quantity * unitPrice - discount;
  return {
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    discount,
    subtotal,
  };
};

/**
 * Helper untuk create restock items
 */
export const createRestockItem = (
  productId: string,
  quantity: number,
  unitPrice: number
): RestockItem => {
  const subtotal = quantity * unitPrice;
  return {
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    subtotal,
  };
};

/**
 * Helper untuk create retur items
 */
export const createReturItem = (
  productId: string,
  quantity: number,
  unitPrice: number
): ReturItem => {
  const subtotal = quantity * unitPrice;
  return {
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    subtotal,
  };
};

/**
 * Calculate total dari items
 */
export const calculateTotal = (items: { subtotal: number }[]): number => {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
};
