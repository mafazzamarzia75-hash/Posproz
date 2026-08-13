/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ DATABASE SERVICE UNTUK APLIKASI POS - WEB ONLY
 * ✅ IndexedDB sebagai primary storage
 * ✅ Full Offline support
 */

import { indexdbBarang } from '@/lib/indexdbBarang';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi';
import { indexdbCustomer } from '@/lib/indexdbCustomer';
import { indexdbSupplier } from '@/lib/indexdbSupplier';
import { indexdbCategory } from '@/lib/indexdbCategory';
import { indexdbDebt } from '@/lib/indexdbDebt';
import { indexdbDiscount } from '@/lib/indexdbDiscount';
import { indexdbExpense } from '@/lib/indexdbExpense';
import { indexdbRestock } from '@/lib/indexdbRestock';
import { indexdbRetur } from '@/lib/indexdbRetur';
import { indexdbUser } from '@/lib/indexdbUser';
import { useSettingsStore } from '@/store/useSettingsStore';
import { generateProductId } from '@/lib/utils';
import { generateUUID } from '@/lib/uuidGenerator';
import { IDatabase } from './IDatabase';
import { getDatabaseMode } from '@/lib/supabaseClient';

class DatabaseService {
  private isInitialized = false;
  private db: any = null; // Dummy untuk web platform (tidak digunakan)

  constructor() {}

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // ✅ Web browser - mode database dipilih otomatis:
      // - Dengan Supabase → offline-first (Dexie + sinkronisasi cloud)
      // - Tanpa Supabase → IndexedDB murni
      const mode = getDatabaseMode();
      console.log(`✅ Berjalan di browser — mode database: ${mode === 'offline-first-dexie' ? 'Offline-First (Dexie + Supabase)' : 'IndexedDB murni'}`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Gagal inisialisasi Database:", error);
      return false;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // ✅ Tabel Produk
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        sku TEXT DEFAULT '',
        barcode TEXT DEFAULT '',
        category TEXT DEFAULT 'Umum',
        priceRetail INTEGER DEFAULT 0,
        priceWholesale INTEGER DEFAULT 0,
        priceCost INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ✅ Tabel Transaksi
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        total INTEGER DEFAULT 0,
        customerName TEXT DEFAULT '',
        payment_method TEXT DEFAULT 'cash',
        cash_amount INTEGER DEFAULT 0,
        change_amount INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_synced INTEGER DEFAULT 0
      );
    `);

    // ✅ Tabel Item Transaksi
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        qty INTEGER DEFAULT 1,
        price_at_sale INTEGER DEFAULT 0,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);

    // ✅ Tabel Pengaturan
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT DEFAULT ''
      );
    `);

    // ✅ Index untuk kecepatan query
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_transaction_date ON transactions(created_at);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_product_sku ON products(sku);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_transaction_items_trx ON transaction_items(transaction_id);`);
  }

  private async checkNeedMigration(): Promise<boolean> {
    if (!this.db) return false;
    
    // ✅ Optimasi: pakai query cepat, langsung return
    const res = await this.db.query("SELECT COUNT(*) as count FROM products");
    const count = res.values?.[0]?.count || 0;
    
    if (count === 0) {
      console.log("🌱 Database produk kosong — akan diisi dari IndexedDB default");
      // ✅ Di browser, data default sudah diisi oleh IndexedDB seed.
      // Jangan lakukan insert lagi di sini untuk menghindari duplikasi.
    }
    
    return false;
  }

  // ⛔ Method insertDefaultData tidak lagi digunakan
  // Data default sudah di-handle oleh IndexedDB seed di indexdbBarang
  private async insertDefaultData(): Promise<void> {
    // No-op — seed data via IndexedDB
    return;
  }

  private async doMigration(): Promise<void> {
    if (!this.db) return;

    // ✅ Migrasi Produk
    const products = await indexdbBarang.getAllBarang();
    for (const p of products) {
      await this.db.run(`
        INSERT OR IGNORE INTO products 
        (id, name, sku, barcode, category, priceRetail, priceWholesale, priceCost, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.id,
        p.name,
        p.sku || p.barcode || '',
        p.barcode || p.sku || '',
        p.category || 'Umum',
        p.priceRetail || p.price || 0,
        p.priceWholesale || p.wholesale_price || 0,
        p.priceCost || p.cost_price || p.capitalPrice || 0,
        p.stock || 0
      ]);
    }

    // ✅ Migrasi Transaksi
    const transactions = await indexdbTransaksi.getAll();
    for (const trx of transactions) {
      await this.db.run(`
        INSERT OR IGNORE INTO transactions 
        (id, total, customerName, created_at, is_synced)
        VALUES (?, ?, ?, ?, ?)
      `, [
        trx.id,
        trx.total || 0,
        trx.customerName || '',
        trx.created_at,
        trx.is_synced ? 1 : 0
      ]);

      if (trx.items && Array.isArray(trx.items)) {
        for (const item of trx.items) {
          await this.db.run(`
            INSERT OR IGNORE INTO transaction_items 
            (id, transaction_id, product_id, product_name, qty, price_at_sale)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            `${trx.id}-${item.product_id || item.id}`,
            trx.id,
            item.product_id || item.id || '',
            item.product_name || item.name || item.nama || '',
            item.qty || item.quantity || 1,
            item.price_at_sale || item.price || 0
          ]);
        }
      }
    }
  }

  async backupToJSON(): Promise<any> {
    await this.init(); // Ensure DB is initialized

    let products: any[] = [];
    let transactions: any[] = [];
    let customers: any[] = [];
    let suppliers: any[] = [];
    let categories: any[] = [];
    let debts: any[] = [];
    let discounts: any[] = [];
    let expenses: any[] = [];
    let restocks: any[] = [];
    let returs: any[] = [];
    let users: any[] = [];
    let settingsData: any = {};

    if (this.db && false) {
      // Fetch from SQLite for native platforms
      const productRes = await this.db.query("SELECT * FROM products");
      products = productRes.values || [];

      const transactionRes = await this.db.query("SELECT * FROM transactions");
      transactions = transactionRes.values || [];

      // Fetch transaction items for each transaction
      for (const trx of transactions) {
        const itemsRes = await this.db.query("SELECT * FROM transaction_items WHERE transaction_id = ?", [trx.id]);
        trx.items = itemsRes.values || [];
      }

      const settingsRes = await this.db.query("SELECT key, value FROM settings");
      if (settingsRes.values) {
        settingsRes.values.forEach((s: any) => {
          settingsData[s.key] = JSON.parse(s.value);
        });
      }
    } else {
      // Fallback to IndexedDB for browser development
      products = await indexdbBarang.getAllBarang();
      transactions = await indexdbTransaksi.getAll();
      customers = await indexdbCustomer.getAll();
      suppliers = await indexdbSupplier.getAll();
      categories = await indexdbCategory.getAll();
      debts = await indexdbDebt.getAll();
      discounts = await indexdbDiscount.getAll();
      expenses = await indexdbExpense.getAll();
      restocks = await indexdbRestock.getAll();
      returs = await indexdbRetur.getAll();
      users = await indexdbUser.getAll();

      const settings = useSettingsStore.getState();
      settingsData = {
        storeInfo: settings.storeInfo,
        printer: null // Printer is not stored in settings store
      };
    }

    return {
      version: 1,
      exported_at: new Date().toISOString(),
      products,
      transactions,
      customers,
      suppliers,
      categories,
      debts,
      discounts,
      expenses,
      restocks,
      returs,
      users,
      settings: settingsData.storeInfo ? { storeInfo: settingsData.storeInfo, printer: null } : settingsData
    };
  }

  async restoreFromJSON(data: any): Promise<boolean> {
    try {
      // ✅ Restore Produk
      if (data.products && Array.isArray(data.products)) {
        await indexdbBarang.clearAll();
        for (const p of data.products) {
          await indexdbBarang.updateBarang(p);
        }
      }

      // ✅ Restore Transaksi
      if (data.transactions && Array.isArray(data.transactions)) {
        await indexdbTransaksi.clearAll();
        for (const trx of data.transactions) {
          await indexdbTransaksi.createRaw(trx);
        }
      }

      // ✅ Restore Customers
      if (data.customers && Array.isArray(data.customers)) {
        await indexdbCustomer.clearAll();
        for (const c of data.customers) {
          await indexdbCustomer.save(c);
        }
      }

      // ✅ Restore Suppliers
      if (data.suppliers && Array.isArray(data.suppliers)) {
        await indexdbSupplier.clearAll();
        for (const s of data.suppliers) {
          await indexdbSupplier.save(s);
        }
      }

      // ✅ Restore Categories
      if (data.categories && Array.isArray(data.categories)) {
        await indexdbCategory.clearAll();
        for (const cat of data.categories) {
          await indexdbCategory.add(cat);
        }
      }

      // ✅ Restore Debts
      if (data.debts && Array.isArray(data.debts)) {
        await indexdbDebt.clearAll();
        for (const d of data.debts) {
          await indexdbDebt.save(d);
        }
      }

      // ✅ Restore Discounts
      if (data.discounts && Array.isArray(data.discounts)) {
        await indexdbDiscount.clearAll();
        for (const d of data.discounts) {
          await indexdbDiscount.save(d);
        }
      }

      // ✅ Restore Expenses
      if (data.expenses && Array.isArray(data.expenses)) {
        await indexdbExpense.clearAll();
        for (const e of data.expenses) {
          await indexdbExpense.save(e);
        }
      }

      // ✅ Restore Restocks
      if (data.restocks && Array.isArray(data.restocks)) {
        await indexdbRestock.clearAll();
        for (const r of data.restocks) {
          await indexdbRestock.add(r);
        }
      }

      // ✅ Restore Returs
      if (data.returs && Array.isArray(data.returs)) {
        await indexdbRetur.clearAll();
        for (const r of data.returs) {
          await indexdbRetur.add(r);
        }
      }

      // ✅ Restore Users
      if (data.users && Array.isArray(data.users)) {
        await indexdbUser.clearAll();
        for (const u of data.users) {
          await indexdbUser.save(u);
        }
      }

      // ✅ Restore Pengaturan (hanya storeInfo, printer tidak disimpan di store)
      if (data.settings?.storeInfo) {
        useSettingsStore.getState().updateStoreInfo(data.settings.storeInfo);
      }

      return true;
    } catch (e) {
      console.error("Restore error:", e);
      return false;
    }
  }

  async resetTransactionData(): Promise<boolean> {
    try {
      // ✅ HAPUS SEMUA DATA TRANSAKSI SAJA
      await indexdbTransaksi.clearAll();

      if (this.db && false) {
        await this.db.execute("DELETE FROM transactions;");
        await this.db.execute("DELETE FROM transaction_items;");
        await this.db.execute("VACUUM;");
      }

      return true;
    } catch (e) {
      console.error("Reset transaksi error:", e);
      return false;
    }
  }

  // ✅ BACKWARD COMPATIBLE EXPORT
  async exportData(): Promise<string> {
    const data = await this.backupToJSON();
    return JSON.stringify(data, null, 2);
  }

  async importData(json: string): Promise<boolean> {
    try {
      const data = JSON.parse(json);
      return this.restoreFromJSON(data);
    } catch (e) {
      console.error("Import error:", e);
      return false;
    }
  }

  // ✅ FUNGSI IMPORT PRODUK MASSAL - Sync ke IndexedDB DAN SQLite
  async importProducts(products: any[]): Promise<{ success: number; error: number; total: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        let finalProductId = product.id;

        // Jika ID produk kosong dari file import, atau jika ada duplikat
        // maka generate ID baru. Prioritaskan SKU/Barcode jika ada.
        if (!finalProductId || (this.db && false && (await this.productExistsInSql(finalProductId)))) {
          // Coba generate ID deterministik dari SKU/Barcode
          const tempId = generateProductId(product.sku, product.barcode);
          
          // Periksa apakah ID yang digenerate ini sudah ada
          if (await indexdbBarang.getBarang(tempId) || (this.db && false && (await this.productExistsInSql(tempId)))) {
            // Jika ID deterministik juga konflik, gunakan UUID fallback
            finalProductId = `prod_autogen_${generateUUID()}`;
          } else {
            finalProductId = tempId;
          }
        }

        // Update produk dengan ID final (bisa jadi ID asli, ID dari SKU/Barcode, atau ID UUID baru)
        const productToSave = { ...product, id: finalProductId };

        // ✅ Simpan ke IndexedDB (sumber data utama di browser)
        await indexdbBarang.updateBarang(productToSave);

        // ✅ Simpan ke SQLite (jika platform native)
        if (this.db && false) {
          await this.db.run(`
            INSERT OR REPLACE INTO products 
            (id, name, sku, barcode, category, priceRetail, priceWholesale, stock, min_stock, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            productToSave.id,
            productToSave.name,
            productToSave.sku || ".",
            productToSave.barcode || ".",
            productToSave.category || "Umum",
            productToSave.priceRetail || 0,
            productToSave.priceWholesale || 0,
            productToSave.stock || 0,
            productToSave.min_stock || 0,
            productToSave.updated_at || Date.now()
          ]);
        }

        successCount++;
      } catch (err) {
        errorCount++;
        console.error("❌ Error import produk:", product?.name || product?.id, err);
      }
    }

    console.log(`✅ Import selesai: ${successCount} berhasil, ${errorCount} gagal dari ${products.length} total`);

    return {
      success: successCount,
      error: errorCount,
      total: successCount + errorCount
    };
  }

  // ✅ SINKRONISASI DUA ARAH: IndexedDB ↔ SQLite
  // Strategi: updated_at lebih baru = menang (last-write-wins)
  async syncDatabases(
    onProgress?: (step: string, current: number, total: number) => void
  ): Promise<{
    platform: 'browser' | 'native';
    products: { idbToSql: number; sqlToIdb: number; conflicts: number };
    transactions: { idbToSql: number; sqlToIdb: number };
    errors: string[];
  }> {
    const errors: string[] = [];
    const result = {
      platform: false ? 'native' as const : 'browser' as const,
      products: { idbToSql: 0, sqlToIdb: 0, conflicts: 0 },
      transactions: { idbToSql: 0, sqlToIdb: 0 },
      errors,
    };

    // ✅ Di browser tidak ada SQLite — sync hanya dalam IndexedDB (no-op)
    if (!false || !this.db) {
      console.log('ℹ️ Berjalan di browser, SQLite tidak tersedia. Sync tidak diperlukan.');
      return result;
    }

    await this.init();

    // ─────────────────────────────────────────────
    // FASE 1: SYNC PRODUK
    // ─────────────────────────────────────────────
    try {
      onProgress?.('Membaca data produk dari IndexedDB...', 0, 100);
      const idbProducts = await indexdbBarang.getAllBarang();

      onProgress?.('Membaca data produk dari SQLite...', 10, 100);
      const sqlRes = await this.db.query('SELECT * FROM products');
      const sqlProducts: any[] = sqlRes.values || [];

      // Buat map by id untuk lookup O(1)
      const idbMap = new Map(idbProducts.map((p: any) => [p.id, p]));
      const sqlMap = new Map(sqlProducts.map((p: any) => [p.id, p]));

      const totalProducts = new Set([...idbMap.keys(), ...sqlMap.keys()]).size;
      let processed = 0;

      // ── IDB → SQL: produk di IDB yang lebih baru atau belum ada di SQL ──
      for (const [id, idbP] of idbMap) {
        try {
          const sqlP = sqlMap.get(id);
          const idbTime = typeof idbP.updated_at === 'number'
            ? idbP.updated_at
            : new Date(idbP.updated_at || 0).getTime();
          const sqlTime = sqlP
            ? (typeof sqlP.updated_at === 'number'
                ? sqlP.updated_at
                : new Date(sqlP.updated_at || 0).getTime())
            : -1;

          if (!sqlP || idbTime > sqlTime) {
            // IDB lebih baru → tulis ke SQL
            await this.db!.run(
              `INSERT OR REPLACE INTO products
               (id, name, sku, barcode, category, priceRetail, priceWholesale, stock, min_stock, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                idbP.id,
                idbP.name || '',
                idbP.sku || idbP.barcode || '',
                idbP.barcode || idbP.sku || '',
                idbP.category || 'Umum',
                idbP.priceRetail || idbP.price || 0,
                idbP.priceWholesale || idbP.wholesale_price || 0,
                idbP.stock || 0,
                idbP.min_stock || 0,
                idbTime,
              ]
            );
            result.products.idbToSql++;
            if (sqlP) result.products.conflicts++; // ada di keduanya tapi IDB menang
          }
        } catch (e: any) {
          errors.push(`Produk IDB→SQL [${id}]: ${e?.message}`);
        }

        processed++;
        onProgress?.(
          `Sinkronisasi produk IDB → SQLite (${processed}/${totalProducts})...`,
          10 + Math.floor((processed / totalProducts) * 35),
          100
        );
      }

      // ── SQL → IDB: produk di SQL yang lebih baru atau belum ada di IDB ──
      processed = 0;
      for (const [id, sqlP] of sqlMap) {
        try {
          const idbP = idbMap.get(id);
          const sqlTime = typeof sqlP.updated_at === 'number'
            ? sqlP.updated_at
            : new Date(sqlP.updated_at || 0).getTime();
          const idbTime = idbP
            ? (typeof idbP.updated_at === 'number'
                ? idbP.updated_at
                : new Date(idbP.updated_at || 0).getTime())
            : -1;

          if (!idbP || sqlTime > idbTime) {
            // SQL lebih baru → tulis ke IDB
            await indexdbBarang.updateBarang({
              id: sqlP.id,
              name: sqlP.name || '',
              sku: sqlP.sku || sqlP.barcode || '',
              barcode: sqlP.barcode || sqlP.sku || '',
              category: sqlP.category || 'Umum',
              priceRetail: sqlP.priceRetail || 0,
              priceWholesale: sqlP.priceWholesale || 0,
              stock: sqlP.stock || 0,
              min_stock: sqlP.min_stock || 0,
              updated_at: sqlTime,
            });
            result.products.sqlToIdb++;
          }
        } catch (e: any) {
          errors.push(`Produk SQL→IDB [${id}]: ${e?.message}`);
        }

        processed++;
        onProgress?.(
          `Sinkronisasi produk SQLite → IDB (${processed}/${sqlMap.size})...`,
          45 + Math.floor((processed / sqlMap.size) * 25),
          100
        );
      }
    } catch (e: any) {
      errors.push(`Fase produk: ${e?.message}`);
    }

    // ─────────────────────────────────────────────
    // FASE 2: SYNC TRANSAKSI
    // ─────────────────────────────────────────────
    try {
      onProgress?.('Membaca transaksi dari IndexedDB...', 70, 100);
      const idbTrx = await indexdbTransaksi.getAll();

      onProgress?.('Membaca transaksi dari SQLite...', 75, 100);
      const sqlTrxRes = await this.db.query('SELECT * FROM transactions');
      const sqlTrx: any[] = sqlTrxRes.values || [];

      const idbTrxMap = new Map(idbTrx.map((t: any) => [t.id, t]));
      const sqlTrxMap = new Map(sqlTrx.map((t: any) => [t.id, t]));

      // ── IDB → SQL: transaksi di IDB yang belum ada di SQL ──
      let processed = 0;
      for (const [id, trx] of idbTrxMap) {
        if (!sqlTrxMap.has(id)) {
          try {
            await this.db!.run(
              `INSERT OR IGNORE INTO transactions
               (id, total, customerName, payment_method, cash_amount, change_amount, created_at, is_synced)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                trx.id,
                trx.total || 0,
                trx.customerName || '',
                trx.payment_method || 'cash',
                trx.cash_amount || 0,
                trx.change_amount || 0,
                trx.created_at,
                trx.is_synced ? 1 : 0,
              ]
            );
            // Sync items juga
            if (trx.items && Array.isArray(trx.items)) {
              for (const item of trx.items) {
                await this.db!.run(
                  `INSERT OR IGNORE INTO transaction_items
                   (id, transaction_id, product_id, product_name, qty, price_at_sale)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    `${trx.id}-${item.product_id || item.id || Math.random()}`,
                    trx.id,
                    item.product_id || item.id || '',
                    item.product_name || item.name || '',
                    item.qty || item.quantity || 1,
                    item.price_at_sale || item.price || 0,
                  ]
                );
              }
            }
            result.transactions.idbToSql++;
          } catch (e: any) {
            errors.push(`Transaksi IDB→SQL [${id}]: ${e?.message}`);
          }
        }
        processed++;
        onProgress?.(
          `Sinkronisasi transaksi IDB → SQLite (${processed}/${idbTrxMap.size})...`,
          75 + Math.floor((processed / Math.max(idbTrxMap.size, 1)) * 12),
          100
        );
      }

      // ── SQL → IDB: transaksi di SQL yang belum ada di IDB ──
      processed = 0;
      for (const [id, trx] of sqlTrxMap) {
        if (!idbTrxMap.has(id)) {
          try {
            // Ambil items dari SQL
            const itemsRes = await this.db!.query(
              'SELECT * FROM transaction_items WHERE transaction_id = ?',
              [id]
            );
            const items = (itemsRes.values || []).map((item: any) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              qty: item.qty,
              price_at_sale: item.price_at_sale,
            }));

            await indexdbTransaksi.createRaw({
              id: trx.id,
              total: trx.total || 0,
              customerName: trx.customerName || '',
              payment_method: trx.payment_method || 'cash',
              cash_amount: trx.cash_amount || 0,
              change_amount: trx.change_amount || 0,
              created_at: trx.created_at,
              is_synced: !!trx.is_synced,
              items,
            });
            result.transactions.sqlToIdb++;
          } catch (e: any) {
            errors.push(`Transaksi SQL→IDB [${id}]: ${e?.message}`);
          }
        }
        processed++;
        onProgress?.(
          `Sinkronisasi transaksi SQLite → IDB (${processed}/${sqlTrxMap.size})...`,
          87 + Math.floor((processed / Math.max(sqlTrxMap.size, 1)) * 12),
          100
        );
      }
    } catch (e: any) {
      errors.push(`Fase transaksi: ${e?.message}`);
    }

    onProgress?.('Sinkronisasi selesai!', 100, 100);
    console.log('✅ Sync result:', result);
    return result;
  }

  private async productExistsInSql(id: string): Promise<boolean> {
    if (!this.db) return false;
    const res = await this.db.query("SELECT COUNT(*) as count FROM products WHERE id = ?", [id]);
    return (res.values?.[0]?.count || 0) > 0;
  }

  // ✅ BACKWARD COMPATIBLE DENGAN DATABASE LAMA
  async getInstance(): Promise<this> {
    await this.init();
    return this;
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.db) return { values: [] };
    return this.db.query(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    if (!this.db) return;
    return this.db.run(sql, params);
  }

  async transaction(callback: (tx: any) => Promise<void>): Promise<void> {
    if (!this.db) return;
    
    await this.db.execute("BEGIN TRANSACTION;");
    try {
      await callback({
        execute: async (sql: string, params?: any[]) => {
          return this.db?.run(sql, params);
        }
      });
      await this.db.execute("COMMIT;");
    } catch (e) {
      await this.db.execute("ROLLBACK;");
      throw e;
    }
  }

  async deduplicateProducts(): Promise<{ removed: number; kept: number }> {
    if (!this.db || !false) {
      return { removed: 0, kept: await this.countProducts() };
    }

    let removedCount = 0;
    const keptIds = new Set<string>();

    try {
      const productsRes = await this.db.query("SELECT * FROM products ORDER BY updated_at DESC");
      const products: any[] = productsRes.values || [];

      const skuMap = new Map<string, any>();

      for (const p of products) {
        const key = (p.sku || p.barcode || '').toString().trim();
        if (!key) {
          // If no SKU/barcode, cannot deduplicate, keep it.
          if (!keptIds.has(p.id)) {
            keptIds.add(p.id);
          }
          continue;
        }

        if (skuMap.has(key)) {
          // Duplicate found, remove the older one (current 'p' is older due to DESC sort).
          await this.db.run("DELETE FROM products WHERE id = ?", [p.id]);
          removedCount++;
        } else {
          skuMap.set(key, p);
          keptIds.add(p.id);
        }
      }

      return { removed: removedCount, kept: keptIds.size };
    } catch (e) {
      console.error("Error deduplicating SQLite products:", e);
      throw e;
    }
  }

  async countProducts(): Promise<number> {
    if (!this.db || !false) {
      return 0;
    }
    const res = await this.db.query("SELECT COUNT(*) as count FROM products");
    return res.values?.[0]?.count || 0;
  }

  async migrateProductIds(): Promise<{ migrated: number; skipped: number }> {
    if (!this.db || !false) {
      return { migrated: 0, skipped: 0 };
    }

    let migratedCount = 0;
    let skippedCount = 0;

    try {
      const productsRes = await this.db.query("SELECT id, name, sku, barcode, category, priceRetail, priceWholesale, stock, min_stock, updated_at FROM products");
      const products: any[] = productsRes.values || [];

      for (const p of products) {
        const currentId = p.id;
        const sku = (p.sku || p.barcode || '').toString().trim();

        if (typeof currentId === 'string' && currentId.startsWith('prod_')) {
          skippedCount++;
          continue;
        }
        let newId: string;

        if (!sku) {
          // Generate a unique ID for products without SKU/barcode
          newId = `prod_no_sku_${generateUUID()}`;
        } else {
          newId = `prod_${sku.toLowerCase().replace(/[^a-z0-9\-_]/g, ".")}`;
        }

        if (currentId !== newId) {
          const existingWithNewIdRes = await this.db.query("SELECT id FROM products WHERE id = ?", [newId]);
          const existingWithNewId = existingWithNewIdRes.values?.[0];

          if (existingWithNewId) {
            // If a product with the new ID already exists, delete the old one
            await this.db.run("DELETE FROM products WHERE id = ?", [currentId]);
          } else {
            // Update the product with the new ID
            await this.db.run(
              `UPDATE products SET id = ? WHERE id = ?`,
              [newId, currentId]
            );
          }
          migratedCount++;
        }
      }
      return { migrated: migratedCount, skipped: skippedCount };
    } catch (e) {
      console.error("Error migrating SQLite product IDs:", e);
      throw e;
    }
  }
}

export const databaseService = new DatabaseService();
export const dbProvider = databaseService; // ✅ Backward Compatible
