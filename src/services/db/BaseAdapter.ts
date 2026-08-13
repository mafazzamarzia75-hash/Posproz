/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDatabase, QueryResult } from './IDatabase';

export interface HealthStatus {
  connected: boolean;
  lastError?: string;
  retryCount: number;
}

export abstract class BaseAdapter implements IDatabase {
  protected isConnected = false;
  protected lastError?: string;
  protected retryCount = 0;
  protected readonly MAX_RETRIES = 3;
  protected readonly RETRY_DELAY_MS = 300;

  protected logger(level: 'info' | 'warn' | 'error', message: string, ...args: any[]) {
    const prefix = `[${this.constructor.name}]`;
    if (level === 'info') console.info(prefix, message, ...args);
    if (level === 'warn') console.warn(prefix, message, ...args);
    if (level === 'error') console.error(prefix, message, ...args);
  }

  async retry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        this.retryCount = 0;
        return result;
      } catch (err: any) {
        this.retryCount = attempt;
        this.lastError = err?.message || String(err);
        this.logger('warn', `${context} gagal (percobaan ${attempt}/${this.MAX_RETRIES}):`, this.lastError);
        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
        }
      }
    }
    throw new Error(`${context} gagal setelah ${this.MAX_RETRIES}x percobaan. Last error: ${this.lastError}`);
  }

  health(): HealthStatus {
    return {
      connected: this.isConnected,
      lastError: this.lastError,
      retryCount: this.retryCount
    };
  }

  abstract init(): Promise<void>;
  abstract execute(query: string, params?: any[]): Promise<any>;
  abstract query(query: string, params?: any[]): Promise<QueryResult>;
  abstract transaction(callback: (db: IDatabase) => Promise<void>): Promise<void>;
}

