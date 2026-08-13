/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbProvider } from './DatabaseService';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
  id: string;
  total: number;
  created_at: number;
  is_synced: number;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  qty: number;
  price_at_sale: number;
  product_name?: string;
}

export class TransactionService {
  static async create(total: number, items: { product_id: string; qty: number; price_at_sale: number }[]): Promise<string> {
    const db = await dbProvider.getInstance();
    const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = Date.now();

    await db.transaction(async (t: any) => {
      await t.execute(
        'INSERT INTO transactions (id, total, created_at, is_synced) VALUES (?, ?, ?, ?)',
        [transactionId, total, now, 0]
      );

      for (const item of items) {
        const itemId = uuidv4();
        await t.execute(
          'INSERT INTO transaction_items (id, transaction_id, product_id, qty, price_at_sale) VALUES (?, ?, ?, ?, ?)',
          [itemId, transactionId, item.product_id, item.qty, item.price_at_sale]
        );

        // Update stock
        await t.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.qty, item.product_id]
        );
      }
    });

    return transactionId;
  }

  static async getAll(): Promise<Transaction[]> {
    const db = await dbProvider.getInstance();
    const result = await db.query('SELECT * FROM transactions ORDER BY created_at DESC');
    return (result as any).values || [];
  }

  static async getById(id: string): Promise<Transaction | null> {
    const db = await dbProvider.getInstance();
    const transactions = (await db.query('SELECT * FROM transactions WHERE id = ?', [id]) as any).values || [];
    
    if (transactions.length === 0) return null;
    
    const transaction = transactions[0];
    const items = (await db.query(`
      SELECT ti.*, p.name as product_name 
      FROM transaction_items ti 
      LEFT JOIN products p ON ti.product_id = p.id 
      WHERE ti.transaction_id = ?
    `, [id]) as any).values || [];
    
    return { ...transaction, items };
  }
}
