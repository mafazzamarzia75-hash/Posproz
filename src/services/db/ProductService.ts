/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbProvider } from './DatabaseService';
import { Product } from '@/interfaces';
import { v4 as uuidv4 } from 'uuid';

export const ProductService = {
  async getAll(): Promise<Product[]> {
    const db = await dbProvider.getInstance();
    const res = await db.query('SELECT * FROM products ORDER BY updated_at DESC');
    return (res as any).values || [];
  },

  async getPaged(offset: number, limit: number = 100): Promise<Product[]> {
    const db = await dbProvider.getInstance();
    const res = await db.query(
      'SELECT * FROM products ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return (res as any).values || [];
  },

  async getCount(): Promise<number> {
    const db = await dbProvider.getInstance();
    const res = await db.query('SELECT COUNT(*) as total FROM products');
    return (res as any).values?.[0]?.total || 0;
  },

  async search(query: string): Promise<Product[]> {
    const db = await dbProvider.getInstance();
    const searchTerm = `%${query}%`;
    const res = await db.query(
      'SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY name ASC',
      [searchTerm, searchTerm]
    );
    return (res as any).values || [];
  },

  async upsert(product: Partial<Product>) {
    const db = await dbProvider.getInstance();
    const id = product.id || uuidv4();
    const query = `
      INSERT OR REPLACE INTO products (id, sku, name, category, priceRetail, priceWholesale, stock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id, 
      product.sku, 
      product.name,
      product.category || 'Umum',
      product.priceRetail, 
      product.priceWholesale, 
      product.stock, 
      Date.now()
    ];
    return await db.execute(query, params);
  },
  
  async delete(id: string) {
    const db = await dbProvider.getInstance();
    return await db.execute('DELETE FROM products WHERE id = ?', [id]);
  }
};
