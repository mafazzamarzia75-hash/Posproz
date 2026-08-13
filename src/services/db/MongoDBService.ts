/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 MONGODB / MONGOOSE CONNECTION SERVICE (Online Multi-User Database)
 * ✅ Mongoose ODM Integration
 * ✅ Menggunakan Singleton Pattern untuk mencegah kebocoran koneksi
 * ✅ Skema lengkap untuk User, Product, Transaction, dan Setting
 * ✅ Backward-compatible types map
 */

import mongoose, { Schema, Document } from 'mongoose';

// Pastikan module dotenv dimuat jika berjalan secara lokal di Node.js
if (typeof process !== 'undefined' && process.env) {
  // Hanya berjalan di environment Server/Node.js
}

// ==========================================
// 1. INTERFACES & MODEL TYPES
// ==========================================

export interface IUser {
  id: string; // ID kustom (atau _id dari MongoDB)
  username: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'kasir' | 'gudang';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  id: string; 
  name: string;
  sku: string;
  barcode: string;
  category: string;
  priceRetail: number;
  priceWholesale: number;
  priceCost: number;
  stock: number;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionItem {
  productId: string;
  productName: string;
  qty: number;
  priceAtSale: number;
}

export interface ITransaction {
  id: string;
  total: number;
  customerName: string;
  paymentMethod: string;
  cashAmount: number;
  changeAmount: number;
  items: ITransactionItem[];
  createdAt: Date;
  isSynced: boolean;
}

export interface ISetting {
  key: string;
  value: string;
}

// Document wrapper untuk Mongoose
export type UserDocument = IUser & Document;
export type ProductDocument = IProduct & Document;
export type TransactionDocument = ITransaction & Document;
export type SettingDocument = ISetting & Document;

// ==========================================
// 2. MONGOOSE SCHEMA DEFINITIONS
// ==========================================

// --- USER SCHEMA ---
const UserSchema = new Schema<UserDocument>({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'kasir', 'gudang'], default: 'kasir' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// --- PRODUCT SCHEMA ---
const ProductSchema = new Schema<ProductDocument>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, default: '' },
  barcode: { type: String, default: '' },
  category: { type: String, default: 'Umum' },
  priceRetail: { type: Number, default: 0 },
  priceWholesale: { type: Number, default: 0 },
  priceCost: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
}, { timestamps: true });

// --- TRANSACTION SCHEMA ---
const TransactionItemSchema = new Schema<ITransactionItem>({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true, default: 1 },
  priceAtSale: { type: Number, required: true, default: 0 },
}, { _id: false });

const TransactionSchema = new Schema<TransactionDocument>({
  id: { type: String, required: true, unique: true },
  total: { type: Number, required: true, default: 0 },
  customerName: { type: String, default: 'Umum' },
  paymentMethod: { type: String, default: 'cash' },
  cashAmount: { type: Number, default: 0 },
  changeAmount: { type: Number, default: 0 },
  items: [TransactionItemSchema],
  isSynced: { type: Boolean, default: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

// --- SETTING SCHEMA ---
const SettingSchema = new Schema<SettingDocument>({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: '' }
});

// ==========================================
// 3. MODEL INITIALIZATION (Avoid Over-Kompilasi)
// ==========================================

export const MongoUser = (mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema)) as mongoose.Model<UserDocument>;
export const MongoProduct = (mongoose.models.Product || mongoose.model<ProductDocument>('Product', ProductSchema)) as mongoose.Model<ProductDocument>;
export const MongoTransaction = (mongoose.models.Transaction || mongoose.model<TransactionDocument>('Transaction', TransactionSchema)) as mongoose.Model<TransactionDocument>;
export const MongoSetting = (mongoose.models.Setting || mongoose.model<SettingDocument>('Setting', SettingSchema)) as mongoose.Model<SettingDocument>;


// ==========================================
// 4. CONNECTION MANAGER (Singleton)
// ==========================================

class MongoDBService {
  private isConnected = false;

  async connect(): Promise<boolean> {
    if (this.isConnected) {
      console.log('🔌 MongoDB: Koneksi sudah aktif (Memakai instansi cached).');
      return true;
    }

    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || 'pos_pintar';

    if (!uri) {
      console.error('❌ MongoDB Error: MONGODB_URI tidak ditemukan di file .env / environment variables!');
      return false;
    }

    try {
      console.log(`🔌 MongoDB: Mencoba menghubungkan ke cluster database...`);
      
      const conn = await mongoose.connect(uri, {
        dbName: dbName,
        // Opsi-opsi optimasi performa Mongoose modern
        autoIndex: true,
      });

      this.isConnected = conn.connection.readyState === 1;
      
      if (this.isConnected) {
        console.log(`🎉 MongoDB Berhasil Online! Terkoneksi ke database: "${dbName}"`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Gagal mengkoneksikan ke MongoDB:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('🔌 MongoDB: Berhasil terputus.');
    } catch (error) {
      console.error('❌ Gagal memutuskan koneksi MongoDB:', error);
    }
  }

  getConnectionState(): string {
    const states: { [key: number]: string } = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };
    return states[mongoose.connection.readyState] || 'Unknown';
  }

  // ==========================================
  // 5. HELPER DATA SYNC (IndexedDB -> MongoDB)
  // ==========================================
  
  /**
   * Helper untuk mengunggah backup data lokal JSON langsung ke MongoDB
   */
  async importBackupToMongo(backupData: { products?: any[]; transactions?: any[]; settings?: any }): Promise<{
    productsSynced: number;
    transactionsSynced: number;
    settingsSynced: number;
  }> {
    await this.connect();
    let pCount = 0;
    let tCount = 0;
    let sCount = 0;

    // 1. Sync Products
    if (backupData.products && Array.isArray(backupData.products)) {
      for (const p of backupData.products) {
        try {
          await MongoProduct.findOneAndUpdate(
            { id: p.id },
            {
              id: p.id,
              name: p.name,
              sku: p.sku || '',
              barcode: p.barcode || '',
              category: p.category || 'Umum',
              priceRetail: p.priceRetail || p.price || 0,
              priceWholesale: p.priceWholesale || p.wholesalePrice || 0,
              priceCost: p.priceCost || p.capitalPrice || 0,
              stock: p.stock || 0,
              minStock: p.min_stock || p.minStock || 0,
            },
            { upsert: true, new: true }
          );
          pCount++;
        } catch (e) {
          console.error(`Gagal sync produk ${p.id} ke MongoDB:`, e);
        }
      }
    }

    // 2. Sync Transactions
    if (backupData.transactions && Array.isArray(backupData.transactions)) {
      for (const t of backupData.transactions) {
        try {
          // Mapping array item dari SQLite / IndexedDB format ke Mongo Schema
          const mappedItems = (t.items || []).map((item: any) => ({
            productId: item.product_id || item.productId || item.id,
            productName: item.product_name || item.productName || item.name || '',
            qty: item.qty || item.quantity || 1,
            priceAtSale: item.price_at_sale || item.priceAtSale || item.price || 0,
          }));

          await MongoTransaction.findOneAndUpdate(
            { id: t.id },
            {
              id: t.id,
              total: t.total || 0,
              customerName: t.customerName || 'Umum',
              paymentMethod: t.payment_method || t.paymentMethod || 'cash',
              cashAmount: t.cash_amount || t.cashAmount || 0,
              changeAmount: t.change_amount || t.changeAmount || 0,
              items: mappedItems,
              isSynced: true,
              createdAt: t.created_at ? new Date(t.created_at) : new Date(),
            },
            { upsert: true, new: true }
          );
          tCount++;
        } catch (e) {
          console.error(`Gagal sync transaksi ${t.id} ke MongoDB:`, e);
        }
      }
    }

    // 3. Sync Settings
    if (backupData.settings) {
      const keys = Object.keys(backupData.settings);
      for (const key of keys) {
        try {
          const valString = JSON.stringify(backupData.settings[key]);
          await MongoSetting.findOneAndUpdate(
            { key: key },
            { key: key, value: valString },
            { upsert: true, new: true }
          );
          sCount++;
        } catch (e) {
          console.error(`Gagal sync setting key [${key}] ke MongoDB:`, e);
        }
      }
    }

    return {
      productsSynced: pCount,
      transactionsSynced: tCount,
      settingsSynced: sCount
    };
  }
}

export const mongoDBService = new MongoDBService();
