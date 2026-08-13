/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QueryResult {
  values: any[];
  columns?: string[];
}

// Note: Kontrak standar untuk akses database lintas platform
export interface IDatabase {
  init(): Promise<void>;
  execute(query: string, params?: any[]): Promise<any>;
  query(query: string, params?: any[]): Promise<QueryResult>;
  transaction(callback: (db: IDatabase) => Promise<void>): Promise<void>;
}
