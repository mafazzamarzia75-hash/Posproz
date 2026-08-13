/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CartItem } from '@/interfaces';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('Rp', 'Rp ');
}

export const cn = (...classes: (string | boolean | undefined | null)[]): string =>
  classes.filter(Boolean).join(' ');

export function generateProductId(sku: string, prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const skuPart = (sku || prefix || 'PRD').slice(0, 4).toUpperCase();
  return `${skuPart}_${timestamp}${random}`;
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * ✅ Mendapatkan harga efektif untuk item di keranjang.
 * Prioritas:
 * 1. customPrice (manual override dari user)
 * 2. pricePromo (jika > 0) — PROMO PER PRODUK
 * 3. priceWholesale (jika mode grosir)
 * 4. priceRetail (default)
 */
export function getEffectiveItemPrice(
  item: { customPrice?: number; pricePromo?: number; priceWholesale: number; priceRetail: number },
  isWholesaleMode: boolean
): number {
  if (item.customPrice !== undefined) {
    return item.customPrice;
  }
  if (item.pricePromo && item.pricePromo > 0) {
    return item.pricePromo;
  }
  if (isWholesaleMode) {
    return item.priceWholesale;
  }
  return item.priceRetail;
}

/**
 * ✅ Mendapatkan subtotal untuk item (harga efektif × quantity)
 */
export function getEffectiveItemSubtotal(
  item: CartItem,
  isWholesaleMode: boolean
): number {
  return getEffectiveItemPrice(item, isWholesaleMode) * item.quantity;
}

/**
 * ✅ Download file utility — digunakan oleh ReportPage
 */
export async function downloadFile(filename: string, content: Blob | string, type: 'xlsx' | 'text' | 'json'): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type: 'text/csv;charset=utf-8;' }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
