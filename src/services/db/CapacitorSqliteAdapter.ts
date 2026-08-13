/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ⚠️ DEPRECATED - Web Only Version
 * Capacitor SQLite Adapter tidak digunakan di web development
 */

import { BaseAdapter } from './BaseAdapter';
import { IDatabase, QueryResult } from './IDatabase';

export class CapacitorSqliteAdapter extends BaseAdapter {
  async init(): Promise<void> {
    throw new Error("CapacitorSqliteAdapter tidak tersedia di web platform. Gunakan IndexedDB sebagai alternatif.");
  }

  async execute(query: string, params?: any[]): Promise<void> {
    throw new Error("CapacitorSqliteAdapter tidak tersedia di web platform.");
  }

  async query(query: string, params?: any[]): Promise<QueryResult> {
    throw new Error("CapacitorSqliteAdapter tidak tersedia di web platform.");
  }

  async transaction(callback: (db: IDatabase) => Promise<void>): Promise<void> {
    throw new Error("CapacitorSqliteAdapter tidak tersedia di web platform.");
  }
}
