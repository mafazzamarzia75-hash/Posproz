/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Example: Integration OfflineFirstDB dengan Inventory Page
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Cloud, CloudOff, Wifi, Loader } from 'lucide-react';
import { offlineDB, Product } from '@/lib/dexieDb';
import { createProduct } from '@/lib/entityBuilders';
import { syncService } from '@/services/sync/SyncService';
import { useOfflineFirst, useSyncNow } from '@/hooks/useOfflineFirst';

/**
 * EXAMPLE: Offline-First Inventory Integration
 * 
 * Ini adalah contoh bagaimana mengintegrasikan sistem offline-first
 * ke dalam page yang sudah ada.
 * 
 * Langkah:
 * 1. Ganti query dari supabase langsung dengan offlineDB
 * 2. Pakai createProduct() saat create new item
 * 3. Pakai updateEntity() saat update item
 * 4. Display sync status menggunakan hooks
 */

export function OfflineFirstInventoryExample() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Umum',
    priceRetail: 0,
    priceWholesale: 0,
    priceCost: 0,
    stock: 0,
  });

  // Use offline-first hooks
  const { isOnline, isSyncing, pendingItems } = useOfflineFirst();
  const { syncNow, isSyncing: manualSyncing } = useSyncNow();

  // Load products from offline DB
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        // Query semua products dari IndexedDB (bukan dari Supabase!)
        const allProducts = await offlineDB.products.toArray();
        setProducts(allProducts);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Handle add product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Gunakan createProduct builder untuk generate UUID + sync_status
      const newProduct = createProduct({
        sku: formData.sku,
        name: formData.name,
        category: formData.category,
        priceRetail: formData.priceRetail,
        priceWholesale: formData.priceWholesale,
        priceCost: formData.priceCost,
        stock: formData.stock,
      });

      // Save ke IndexedDB (tidak langsung ke Supabase!)
      await offlineDB.products.put(newProduct);

      // Update UI
      setProducts([...products, newProduct]);
      setFormData({
        sku: '',
        name: '',
        category: 'Umum',
        priceRetail: 0,
        priceWholesale: 0,
        priceCost: 0,
        stock: 0,
      });

      console.log('✅ Product created locally:', newProduct);
      // Jika device online, akan auto-sync dalam beberapa detik
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  // Handle update product
  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const product = await offlineDB.products.get(id);
      if (!product) return;

      const updated = {
        ...product,
        ...updates,
        sync_status: product.sync_status === 'synced' ? 'updated' : product.sync_status,
        updated_at: Date.now(),
      };

      await offlineDB.products.put(updated);
      setProducts(products.map((p) => (p.id === id ? updated : p)));

      console.log('✅ Product updated locally:', updated);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  // Handle delete product (soft delete)
  const handleDeleteProduct = async (id: string) => {
    try {
      const product = await offlineDB.products.get(id);
      if (!product) return;

      // Mark as deleted (tidak langsung delete)
      await offlineDB.products.put({
        ...product,
        sync_status: 'deleted',
        updated_at: Date.now(),
      });

      // Remove dari UI
      setProducts(products.filter((p) => p.id !== id));
      console.log('✅ Product marked as deleted:', id);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  return (
    <div className="space-y-6 p-6" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* ===== SYNC STATUS BAR ===== */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <>
                <Cloud size={20} style={{ color: 'var(--color-success)' }} />
                <span className="font-semibold">🟢 Online</span>
              </>
            ) : (
              <>
                <CloudOff size={20} style={{ color: 'var(--color-warning)' }} />
                <span className="font-semibold">🔴 Offline</span>
              </>
            )}

            {isSyncing && <Loader size={16} className="animate-spin" style={{ color: 'var(--color-info)' }} />}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span style={{ color: 'var(--color-text-secondary)' }}>Pending: </span>
              <strong style={{ color: 'var(--color-primary-600)' }}>{pendingItems}</strong>
            </div>

            <button
              onClick={syncNow}
              disabled={!isOnline || manualSyncing}
              className="px-4 py-2 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: isOnline && !manualSyncing ? 'var(--color-primary-600)' : 'var(--color-bg-tertiary)',
                color: isOnline && !manualSyncing ? 'white' : 'var(--color-text-secondary)',
                cursor: isOnline && !manualSyncing ? 'pointer' : 'not-allowed',
              }}
            >
              {manualSyncing ? '🔄 Syncing...' : '📤 Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== OFFLINE WARNING ===== */}
      {!isOnline && (
        <div className="flex gap-3 rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 p-4">
          <AlertCircle size={20} style={{ color: 'var(--color-warning)' }} />
          <div>
            <strong>You are offline</strong>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Changes are saved locally and will sync when you're back online.
            </p>
          </div>
        </div>
      )}

      {/* ===== ADD PRODUCT FORM ===== */}
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border-light)' }}>
        <h3 className="text-lg font-bold mb-4">Add New Product</h3>

        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="SKU"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="px-3 py-2 rounded-lg border"
              style={{
                borderColor: 'var(--color-border-light)',
                backgroundColor: 'var(--color-bg-elevated)',
              }}
            />
            <input
              type="text"
              placeholder="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 rounded-lg border"
              style={{
                borderColor: 'var(--color-border-light)',
                backgroundColor: 'var(--color-bg-elevated)',
              }}
            />
          </div>

          <input
            type="number"
            placeholder="Price (Retail)"
            value={formData.priceRetail}
            onChange={(e) => setFormData({ ...formData, priceRetail: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border"
            style={{
              borderColor: 'var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}
          />

          <button
            type="submit"
            className="w-full py-2 rounded-lg font-semibold text-white transition-all"
            style={{
              backgroundColor: 'var(--color-primary-600)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-primary-700)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-primary-600)')
            }
          >
            ➕ Add Product
          </button>
        </form>
      </div>

      {/* ===== PRODUCTS LIST ===== */}
      <div className="rounded-lg border" style={{ borderColor: 'var(--color-border-light)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
          <h3 className="text-lg font-bold">Products ({products.length})</h3>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <Loader className="animate-spin mx-auto mb-2" />
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No products yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
            {products.map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold">{product.name}</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    SKU: {product.sku} • Stock: {product.stock}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor:
                          product.sync_status === 'synced'
                            ? 'var(--color-success)'
                            : product.sync_status === 'created'
                              ? 'var(--color-info)'
                              : 'var(--color-warning)',
                        color: 'white',
                      }}
                    >
                      {product.sync_status}
                    </span>
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                    >
                      {new Date(product.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleUpdateProduct(product.id, {
                        stock: product.stock + 1,
                      })
                    }
                    className="px-3 py-1 rounded text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-success)' }}
                  >
                    Stock +1
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="px-3 py-1 rounded text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-error)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== DEBUG INFO ===== */}
      <details
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <summary className="cursor-pointer font-semibold">🐛 Debug Info</summary>
        <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <div>Online: {isOnline ? '✅' : '❌'}</div>
          <div>Syncing: {isSyncing ? '🔄' : '✓'}</div>
          <div>Pending: {pendingItems}</div>
          <div>Products: {products.length}</div>
          <pre className="mt-2 bg-black text-green-400 p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(
              {
                isOnline,
                isSyncing,
                manualSyncing,
                pendingItems,
                productCount: products.length,
                syncStatuses: {
                  synced: products.filter((p) => p.sync_status === 'synced').length,
                  created: products.filter((p) => p.sync_status === 'created').length,
                  updated: products.filter((p) => p.sync_status === 'updated').length,
                  deleted: products.filter((p) => p.sync_status === 'deleted').length,
                },
              },
              null,
              2
            )}
          </pre>
        </div>
      </details>
    </div>
  );
}

export default OfflineFirstInventoryExample;
