/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Note: Definisi struktur data inti untuk aplikasi POS
export interface Product {
  id: string; // UUID
  sku: string;
  name: string;
  priceRetail: number;    // Harga Eceran
  priceWholesale: number; // Harga Grosir
  priceCost: number;      // Harga Modal / pokok pembelian
  pricePromo: number;     // Harga Promo (0 = tidak ada promo)
  stock: number;
  category: string;
  supplierId: string;     // ID Supplier (optional = empty string)
  supplierName: string;   // ✅ Nama Supplier (denormalisasi agar terbawa saat restore)
  updated_at: number;
}

// Note: Definisi item di keranjang dengan dukungan override manual
export interface CartItem extends Product {
  quantity: number;
  customPrice?: number;   // Digunakan jika user edit harga manual
  customQuantity?: number; 
}

export interface Transaction {
  id: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  createdAt: number;
  isSynced: number; // 0 for false, 1 for true
}

export type PriceMode = 'RETAIL' | 'WHOLESALE';