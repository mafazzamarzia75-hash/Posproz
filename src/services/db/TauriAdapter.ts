/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAdapter } from './BaseAdapter';
import { IDatabase, QueryResult } from './IDatabase';

// Tauri v2 SQLite Plugin API
declare global {
  interface Window {
    __TAURI__: {
      sqlite: {
        open(path: string): Promise<number>;
        close(dbId: number): Promise<void>;
        execute(dbId: number, query: string, params?: any[]): Promise<void>;
        select(dbId: number, query: string, params?: any[]): Promise<any[]>;
      }
    }
  }
}

export class TauriAdapter extends BaseAdapter {
  private dbId: number | null = null;

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.__TAURI__) {
      throw new Error("Tauri runtime tidak tersedia");
    }

    await this.retry(async () => {
      this.dbId = await window.__TAURI__.sqlite.open('poskasir.db');
    }, 'Tauri SQLite Open');

    this.isConnected = true;
    this.logger('info', '✅ Tauri SQLite Native Connected');
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    if (!this.dbId) throw new Error("Database tidak terbuka");
    await window.__TAURI__.sqlite.execute(this.dbId, sql, params || []);
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.dbId) throw new Error("Database tidak terbuka");
    const rows = await window.__TAURI__.sqlite.select(this.dbId, sql, params || []);
    return { values: rows, columns: [] };
  }

  async transaction(callback: (db: IDatabase) => Promise<void>): Promise<void> {
    await this.execute('BEGIN TRANSACTION');
    try {
      await callback(this);
      await this.execute('COMMIT');
    } catch (e) {
      await this.execute('ROLLBACK');
      throw e;
    }
  }
}