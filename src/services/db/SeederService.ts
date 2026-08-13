/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbProvider } from './DatabaseService';
import defaultData from './DefaultData.json';

export class SeederService {
  static async seedIfEmpty(): Promise<void> {
    const db = await dbProvider.getInstance();
    const result = await db.query('SELECT COUNT(*) as count FROM products');
    const count = (result as any).values[0].count;

    if (count === 0) {
      console.log("Database is empty, seeding default data...");
      await db.transaction(async (t) => {
          // ✅ data.products karena JSON punya wrapper { data: { products: [...] } }
          const products = (defaultData as any).data?.products || (defaultData as any).products || [];
          for (const p of products) {
          // Map fields from JSON to DB
          const updatedAt = new Date(p.updatedAt).getTime();
          await t.execute(
            'INSERT INTO products (id, sku, name, category, priceRetail, priceWholesale, stock, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [p.id, p.barcode || p.id, p.name, p.category, p.price, p.wholesale_price, p.stock, updatedAt]
          );
        }
      });
      console.log("Seeding complete.");
    }
  }
}
