/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, Product } from '@/interfaces';
import { useSettingsStore } from './useSettingsStore';

interface CartState {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateManualPrice: (id: string, newPrice: number) => void;
  updateManualQty: (id: string, newQty: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (product) => {
        set((state) => {
          const existing = state.cart.find((item) => item.id === product.id);
          const maxStock = Number(product.stock) || 0;
          if (existing) {
            // 🔴 Batasi qty agar tidak melebihi stok tersedia
            if (maxStock <= 0 || existing.quantity >= maxStock) {
              return state;
            }
            return {
              cart: state.cart.map((item) =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
              ),
            };
          }
          // 🔴 Jangan tambahkan produk dengan stok 0
          if (maxStock === 0) {
            return state;
          }
          return { cart: [...state.cart, { ...product, quantity: 1 }] };
        });
      },

      updateManualPrice: (id, newPrice) => {
        // 🔴 Validasi: harga harus angka finite dan >= 0
        if (!Number.isFinite(newPrice) || newPrice < 0) {
          return;
        }
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id ? { ...item, customPrice: newPrice } : item
          ),
        }));
      },

      updateManualQty: (id, newQty) => {
        set((state) => {
          // 🔴 Validasi: qty harus angka finite
          if (!Number.isFinite(newQty)) {
            return state;
          }
          if (newQty <= 0) {
            return {
              cart: state.cart.filter((item) => item.id !== id)
            };
          }
          // 🔴 Batasi qty agar tidak melebihi stok tersedia
          const item = state.cart.find((i) => i.id === id);
          const maxStock = Number(item?.stock) || 0;
          if (maxStock <= 0) {
            return {
              cart: state.cart.filter((i) => i.id !== id)
            };
          }
          if (newQty > maxStock) {
            return {
              cart: state.cart.map((i) =>
                i.id === id ? { ...i, quantity: maxStock } : i
              ),
            };
          }
          return {
            cart: state.cart.map((item) =>
              item.id === id ? { ...item, quantity: newQty } : item
            ),
          };
        });
      },

      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter((item) => item.id !== id)
      })),

      clearCart: () => set({ cart: [] }),

      getTotal: () => {
        const { cart } = get();
        const { isWholesaleMode } = useSettingsStore.getState();

        return cart.reduce((total, item) => {
          // Prioritas: 1. Manual Override, 2. Harga Promo (jika ada), 3. Grosir Mode, 4. Retail Default
          let price = item.priceRetail;
          if (item.customPrice !== undefined) {
            price = item.customPrice;
          } else if (item.pricePromo && item.pricePromo > 0) {
            price = item.pricePromo;
          } else if (isWholesaleMode) {
            price = item.priceWholesale;
          }
          
          return total + (price * item.quantity);
        }, 0);
      },
    }),
    {
      name: 'pos-cart-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => {
        console.log("✅ Cart berhasil di restore dari localStorage");
      }
    }
  )
);