/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Trash2, CreditCard, Search, ShoppingBag, Package, Plus, Minus, Info, Camera, X } from 'lucide-react';
import ManualEditModal from '@/components/pos/ManualEditModal';
import { PriceModeToggle } from '@/components/pos/PriceModeToggle';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi';
import { CartItem, Product } from '@/interfaces';
import { formatCurrency, cn, generateProductId, getEffectiveItemPrice } from '@/lib/utils';
import CheckoutModal from '@/components/pos/CheckoutModal';
import BarcodeScannerModal from '@/components/pos/BarcodeScannerModal';
import { motion, AnimatePresence } from 'motion/react';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { indexdbSupplier } from '@/lib/indexdbSupplier';
import { indexdbUser } from '@/lib/indexdbUser';

const POSPage: React.FC = () => {
  const { cart, removeFromCart, getTotal, addToCart, clearCart, updateManualQty } = useCartStore();
  const { isWholesaleMode, storeInfo } = useSettingsStore();
  const isAdminUser = indexdbUser.isAdmin();
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [pendingPriceSave, setPendingPriceSave] = useState<{
    item: CartItem;
    newPrice: number;
    priceField: 'priceRetail' | 'priceWholesale';
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartPanelRef = useRef<HTMLDivElement>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');

  // 🔴 Guard anti-duplikat: mencegah addToCart dipicu 2x dalam interval pendek (misal dari scanner + useEffect)
  const lastBarcodeRef = useRef<string | null>(null);
  const lastBarcodeTimeRef = useRef(0);
  const BARCODE_COOLDOWN = 800; // ms: cooldown untuk barcode yang sama
  const isBarcodeInCooldown = (code: string): boolean => {
    const now = Date.now();
    if (code === lastBarcodeRef.current && (now - lastBarcodeTimeRef.current) < BARCODE_COOLDOWN) {
      return true;
    }
    lastBarcodeRef.current = code;
    lastBarcodeTimeRef.current = now;
    return false;
  };
  const [salesCounts, setSalesCounts] = useState<Record<string, number>>({});

  const [showCheckout, setShowCheckout] = useState(false);
  const [showBarcodeNotFound, setShowBarcodeNotFound] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  // ✅ String state untuk input harga — boleh kosong sementara, fallback onBlur
  const [productFormData, setProductFormData] = useState<Partial<any>>({
    name: '', sku: '', priceRetail: '0', priceWholesale: '0', priceCost: '0', pricePromo: '0', stock: '0', category: 'Umum', supplierId: '', supplierName: ''
  });

  // ✅ Data statis — load sekali, filter client-side (NO LAG)
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ LOAD SEMUA DATA SEKALI di awal
  useEffect(() => {
    // 🔴 NON-BLOCKING: Load suppliers di background
    // getAll() bisa fetch ke cloud (Supabase) yang lambat — jangan blokir render produk
    (async () => {
      try {
        const allSuppliers = await indexdbSupplier.getAll();
        setSuppliers(allSuppliers);
      } catch { /* noop */ }
    })();

    (async () => {
      try {
        // Load semua produk
        const raw = await indexdbBarang.getAllBarang();
        const mapped: Product[] = raw.map((p: any) => ({
          ...p,
          id: p.id,
          sku: p.sku || '',
          name: p.name || '',
          priceRetail: p.priceRetail || p.price || 0,
          priceWholesale: p.priceWholesale || p.wholesale_price || 0,
          priceCost: p.priceCost || p.cost_price || 0,
          stock: p.stock || 0,
          category: p.category || 'Umum',
          supplierId: p.supplierId || '',
          supplierName: p.supplierName || '',
          updated_at: p.updated_at || Date.now(),
        }));

        setAllProducts(mapped);

        // Generate categories
        const uniqueCategories = [...new Set(
          mapped
            .map(p => (p.category || '').trim())
            .filter(c => c.length > 0)
        )].sort((a, b) => a.localeCompare(b));
        setCategories(['Semua', ...uniqueCategories]);
      } catch (e) {
        console.error("Initial load error:", e);
      } finally {
        setIsLoading(false);
      }
    })();

    // 🔴 NON-BLOCKING: Hitung jumlah penjualan dari transaksi di background
    // Jangan blokir render produk — getAll() bisa fetch ke cloud (Supabase) yang lambat
    (async () => {
      try {
        const transactions = await indexdbTransaksi.getAll();
        const counts: Record<string, number> = {};

        transactions.forEach((trx: any) => {
          const items = Array.isArray(trx.items) ? trx.items : [];
          items.forEach((item: any) => {
            const key = String(item.id || item.product_id || item.sku || item.barcode || '');
            if (!key) return;
            counts[key] = (counts[key] || 0) + Number(item.quantity || item.qty || 1);
          });
        });

        setSalesCounts(counts);
      } catch (e) {
        console.warn('Failed to load transaction history for best-seller ranking', e);
        setSalesCounts({});
      }
    })();
  }, []);

  // 🔴 Batasi render grid: 50 produk per batch (load more)
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ✅ FILTER CLIENT-SIDE — useMemo, instan
  const filteredProducts = useMemo(() => {
    if (allProducts.length === 0) return [];

    let result = allProducts;
    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.sku || '').toLowerCase().includes(query)
      );
    }

    if (activeCategory !== 'Semua') {
      const catLower = activeCategory.trim().toLowerCase();
      result = result.filter(p =>
        (p.category || '').trim().toLowerCase() === catLower
      );
    }

    const sortByPopularity = (a: Product, b: Product) => {
      const countA = salesCounts[a.id] || 0;
      const countB = salesCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      return (b.updated_at || 0) - (a.updated_at || 0);
    };

    result = [...result].sort(sortByPopularity);
    return result;
  }, [allProducts, search, activeCategory, salesCounts]);

  // ✅ Hanya render `visibleCount` produk pertama (load more)
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  // ✅ Reset visibleCount saat pencarian / kategori berubah
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, activeCategory]);

  const loadMoreProducts = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const focusSearchInput = useCallback(() => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    focusSearchInput();
  }, [focusSearchInput]);

  useEffect(() => {
    if (cart.length > 0) {
      cartPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cart.length]);

  // ✅ Barcode handler — cari di allProducts
  const handleBarcodeScanned = useCallback((code: string) => {
    // 🔴 Guard cooldown: skip jika barcode yang sama baru saja diproses
    if (isBarcodeInCooldown(code)) {
      console.log("⏭️ Barcode di-skip (cooldown POSPage):", code);
      return;
    }

    const found = allProducts.find(p => {
      const barcode = (p as any).barcode || '';
      return (
        p.sku === code ||
        p.sku?.trim()?.toLowerCase() === code.trim().toLowerCase() ||
        barcode === code ||
        barcode?.trim()?.toLowerCase() === code.trim().toLowerCase()
      );
    });

    if (found) {
      addToCart(found);
      setSearch('');
      focusSearchInput();
    } else {
      setNotFoundBarcode(code);
      setShowBarcodeNotFound(true);
      focusSearchInput();
    }
  }, [allProducts, addToCart, focusSearchInput]);

  useBarcodeScanner(handleBarcodeScanned);

  // ✅ Otomatis masukkan ke keranjang & kosongkan input jika pencarian COCOK EKSAK dengan SKU/Barcode
  useEffect(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return;

    const match = allProducts.find(p => {
      const barcode = ((p as any).barcode || '').toString().trim().toLowerCase();
      const sku = (p.sku || '').toString().trim().toLowerCase();
      return sku === trimmed || barcode === trimmed;
    });

    if (match) {
      // 🔴 Guard cooldown: jika barcode ini barusan diproses oleh scanner, skip
      if (isBarcodeInCooldown(trimmed)) {
        console.log("⏭️ Auto-match dari search di-skip (cooldown):", trimmed);
        return;
      }

      addToCart(match);
      setSearch('');
      focusSearchInput();
    }
  }, [search, allProducts, addToCart, focusSearchInput]);

  const handleManualPriceSave = (data: { id: string; quantity: number; price: number; priceField: 'priceRetail' | 'priceWholesale'; }) => {
    if (!isAdminUser) return;
    const item = cart.find((i) => i.id === data.id);
    if (!item) return;

    const currentEffectivePrice = item.customPrice !== undefined ? item.customPrice : (isWholesaleMode ? item.priceWholesale : item.priceRetail);
    if (data.price !== currentEffectivePrice) {
      setPendingPriceSave({ item, newPrice: data.price, priceField: data.priceField });
    }
  };

  const handleConfirmSavePriceInDb = async (shouldSave: boolean) => {
    if (!pendingPriceSave) return;
    const { item, newPrice, priceField } = pendingPriceSave;
    setPendingPriceSave(null);

    if (!shouldSave) return;

    try {
      const productToUpdate = allProducts.find((p) => p.id === item.id) || item;
      const updatedProduct = {
        ...productToUpdate,
        [priceField]: newPrice,
        updated_at: Date.now()
      };
      await indexdbBarang.updateBarang(updatedProduct);
      setAllProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    } catch (error) {
      console.error('Gagal menyimpan harga baru ke database:', error);
      alert('Gagal menyimpan harga baru ke database. Pastikan koneksi dan coba lagi.');
    }
  };

  const handleFinishCheckout = async (customerName: string, paymentMethod?: string, paidAmount?: number, subtotal?: number, discountAmount?: number) => {
    if (cart.length === 0) return;
    try {
      const items = cart.map(i => ({
        product_id: i.id,
        product_name: i.name,
        name: i.name + (Number(i.pricePromo) > 0 && !i.customPrice ? ' (PROMO)' : ''),
        nama: i.name,
        qty: i.quantity,
        quantity: i.quantity,
        // ✅ Gunakan getEffectiveItemPrice untuk menghormati pricePromo per produk
        price_at_sale: getEffectiveItemPrice(i, isWholesaleMode),
        price: getEffectiveItemPrice(i, isWholesaleMode),
        harga: getEffectiveItemPrice(i, isWholesaleMode),
        price_at_cost: i.priceCost || 0,
        price_cost: i.priceCost || 0,
        priceCost: i.priceCost || 0
      }));
      
      // Save Transaction
      await indexdbTransaksi.create(getTotal(), items, customerName, paymentMethod, paidAmount, subtotal, discountAmount);

      // Decrement product stock in DB and local react state
      const updatedProducts = [...allProducts];
      for (const item of cart) {
        const productIndex = updatedProducts.findIndex(p => p.id === item.id);
        if (productIndex !== -1) {
          const product = updatedProducts[productIndex];
          const currentStock = Number(product.stock) || 0;
          const soldQty = Number(item.quantity) || 0;
          const newStock = Math.max(0, currentStock - soldQty);

          // Update in local state copy
          updatedProducts[productIndex] = {
            ...product,
            stock: newStock,
            updated_at: Date.now()
          };

          // Update in database
          try {
            await indexdbBarang.updateBarang({
              ...product,
              stock: newStock,
              updated_at: Date.now()
            });
          } catch (dbErr) {
            console.error(`Gagal update stok barang [${product.name}]:`, dbErr);
          }
        }
      }
      setAllProducts(updatedProducts);
    } catch (error) {
      console.error(error);
      alert("Gagal memproses transaksi.");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 overflow-hidden">
      {/* Product Selection Section */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6">
        {/* Search + Category */}
        <div className="space-y-4">
          <div className="relative w-full group">
            <Search className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
              "text-slate-400 group-focus-within:transition-colors",
              isWholesaleMode ? "group-focus-within:text-orange-500" : "group-focus-within:text-indigo-600"
            )} size={18} />
            <input 
              ref={searchInputRef}
              data-scanner-input="true"
              autoComplete="off"
              spellCheck="false"
              type="text"
              placeholder="Scan Barcode atau Cari Produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim().length > 0) {
                  if (filteredProducts.length > 0) {
                    addToCart(filteredProducts[0]);
                    setSearch('');
                    focusSearchInput();
                  } else {
                    setNotFoundBarcode(search);
                    setShowBarcodeNotFound(true);
                    focusSearchInput();
                  }
                }
              }}
              className={cn(
                "w-full pl-12 pr-12 py-3.5 bg-white border border-slate-100 rounded-[24px] shadow-sm outline-none transition-all font-bold text-sm text-slate-700",
                isWholesaleMode ? "focus:ring-2 focus:ring-orange-500" : "focus:ring-2 focus:ring-indigo-600"
              )}
            />
            <button 
              type="button"
              onClick={() => setShowScanner(true)}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors p-1",
                isWholesaleMode ? "hover:text-orange-500" : "hover:text-indigo-600"
              )}
            >
              <Camera size={20} />
            </button>
          </div>

          {/* Wholesale/Retail Toggle (Grosir/Eceran) - Moved here under search box, above category dropdown */}
          {isAdminUser && (
            <div className="flex justify-start">
              <PriceModeToggle />
            </div>
          )}

          {/* Filter Kategori */}
          <div className="relative">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className={cn(
                "w-full px-5 py-3 rounded-[24px] border shadow-sm outline-none transition-all font-bold text-sm appearance-none cursor-pointer",
                isWholesaleMode
                  ? "bg-orange-50 border-orange-200 text-orange-700 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  : "bg-white border-slate-100 text-slate-700 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
              )}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Semua' ? '📦 Semua Kategori' : `📁 ${cat}`}
                </option>
              ))}
            </select>
            <div className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5",
              isWholesaleMode ? "text-orange-400" : "text-slate-400"
            )}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500 font-black">
            <span>{search.trim() ? 'Menampilkan hasil pencarian' : 'Menampilkan semua produk'}</span>
            <span>{filteredProducts.length} Produk</span>
          </div>
        </div>

        {/* Produk + Keranjang */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* KIRI: Grid Produk — filteredProducts dari useMemo (instan) */}
          <div className="lg:w-[45%] overflow-y-auto pr-2 flex flex-col gap-2 pb-10 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {visibleProducts.map((p) => {
                // 🔴 Boolean murni: Number(0) > 0 = false, Number(undefined) > 0 = false
                // Hindari `0 && ...` yang me-render angka 0 di JSX
                const hasPromo = Number((p as any).pricePromo) > 0;
                const displayPrice = hasPromo 
                  ? Number((p as any).pricePromo) 
                  : (isWholesaleMode ? p.priceWholesale : p.priceRetail);
                const originalPrice = hasPromo ? (isWholesaleMode ? p.priceWholesale : p.priceRetail) : 0;
                
                return (
                <div 
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={cn(
                    "bg-white p-3 rounded-[16px] border transition-all cursor-pointer flex flex-row items-center gap-2 active:scale-[0.99] duration-200",
                    hasPromo 
                      ? "border-rose-200 hover:border-rose-400 hover:shadow-md hover:shadow-rose-100 bg-rose-50/30"
                      : isWholesaleMode
                        ? "hover:border-orange-400 hover:shadow-md hover:shadow-orange-100 border-transparent"
                        : "hover:border-indigo-600 hover:shadow-md hover:shadow-slate-100 border-transparent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-slate-800 uppercase tracking-tight leading-tight truncate">{p.name}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">#{p.sku}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {hasPromo && (
                      <span className="text-[7px] font-black text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider inline-block mb-0.5">Promo</span>
                    )}
                    <span className={cn(
                      "font-black text-xs block whitespace-nowrap",
                      hasPromo ? "text-rose-600" : isWholesaleMode ? "text-orange-500" : "text-indigo-600"
                    )}>
                      {formatCurrency(displayPrice)}
                    </span>
                    {hasPromo && originalPrice > 0 && (
                      <p className="text-[7px] font-bold text-slate-400 line-through leading-tight">
                        {formatCurrency(originalPrice)}
                      </p>
                    )}
                    {!hasPromo && (
                      <p className={cn(
                        "text-[8px] font-bold uppercase leading-tight mt-0.5",
                        isWholesaleMode ? "text-orange-300" : "text-slate-300"
                      )}>
                        {isWholesaleMode ? 'Wholesale' : 'Retail'}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    "shrink-0 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight",
                    p.stock <= 5 ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400"
                  )}>
                    {p.stock}
                  </div>
                </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400 space-y-6 py-20">
                  <div className="p-10 bg-slate-50 rounded-full border border-slate-100 shadow-inner relative">
                    <Package size={56} className="opacity-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-black text-sm text-slate-400 uppercase tracking-widest leading-none">Produk Tidak Ditemukan</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Cari di database lokal tidak menemukan hasil.</p>
                  </div>
                </div>
              )}

              {/* 🔴 Tombol Load More — 50 produk per batch */}
              {visibleProducts.length < filteredProducts.length && (
                <button
                  onClick={loadMoreProducts}
                  className="w-full py-3 mt-2 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-[10px] text-slate-500 uppercase tracking-widest transition-all active:scale-95"
                >
                  Muat Lebih Banyak ({filteredProducts.length - visibleProducts.length} tersisa)
                </button>
              )}
            </>
          )}
          </div>

          {/* KANAN: Keranjang */}
          <div ref={cartPanelRef} className="w-full lg:w-[55%] shrink-0 lg:max-h-[calc(var(--vh,1vh)*100-180px)] min-h-0">
            {cart.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                <div className={cn(
                  "px-4 py-2.5 border-b flex items-center justify-between",
                  isWholesaleMode ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100"
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm",
                      isWholesaleMode ? "bg-orange-500" : "bg-indigo-600"
                    )}>
                      <ShoppingBag size={14} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-black text-xs text-slate-800 tracking-tight uppercase">Keranjang</h3>
                      <p className={cn(
                        "text-[8px] font-bold uppercase tracking-tighter",
                        isWholesaleMode ? "text-orange-600" : "text-emerald-600"
                      )}>
                        {cart.reduce((acc, i) => acc + i.quantity, 0)} item · {formatCurrency(getTotal())}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setShowCheckout(true)}
                      disabled={cart.length === 0}
                      className={cn(
                        "px-3 py-1.5 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                        isWholesaleMode ? "bg-orange-500 hover:bg-orange-600" : "bg-indigo-600 hover:bg-indigo-700"
                      )}
                    >
                      <CreditCard size={12} className="inline mr-1" />
                      Bayar
                    </button>
                    <button 
                      onClick={clearCart}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-50 bg-slate-50/30">
                        <th className="text-left p-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Produk</th>
                        <th className="text-center p-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                        <th className="text-right p-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Harga</th>
                        <th className="text-right p-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                        <th className="text-center p-2 text-[8px] font-black text-slate-400 uppercase tracking-widest"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.id} className={cn(
                          "border-b border-slate-50 transition-colors",
                          item.customPrice ? "bg-emerald-50/30" : "hover:bg-slate-50"
                        )}>
                          <td className="p-2">
                            <p className="font-black text-[10px] text-slate-800 truncate max-w-[140px] uppercase tracking-tight">{item.name}</p>
                            <span className="text-[8px] text-slate-400 font-bold font-mono">#{item.sku}</span>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1 bg-white/80 rounded-lg p-0.5 shadow-sm border border-slate-100">
                              <button 
                                onClick={() => updateManualQty(item.id, item.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center bg-slate-50 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-all font-black text-[9px]"
                              >−</button>
                              <span className="w-4 text-center text-[10px] font-black text-slate-800">{item.quantity}</span>
                              <button 
                                onClick={() => updateManualQty(item.id, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center bg-slate-50 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-all font-black text-[9px]"
                              >+</button>
                            </div>
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                            >
                              {formatCurrency(getEffectiveItemPrice(item, isWholesaleMode))}
                            </button>
                          </td>
                          <td className="p-2 text-right">
                            <span className="text-[10px] font-black text-slate-800">
                              {formatCurrency(getEffectiveItemPrice(item, isWholesaleMode) * item.quantity)}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-slate-200 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50"
                            >
                              <Trash2 size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {cart.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</span>
                      <span className={cn(
                        "text-lg font-black tracking-tighter",
                        isWholesaleMode ? "text-orange-500" : "text-indigo-600"
                      )}>{formatCurrency(getTotal())}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {cart.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center">
                    <ShoppingBag size={24} className="text-slate-200" />
                  </div>
                  <p className="font-black text-xs text-slate-300 uppercase tracking-widest">Keranjang Kosong</p>
                  <p className="text-[9px] font-bold text-slate-200 uppercase tracking-tighter">Klik produk untuk menambah</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCheckout && (
          <CheckoutModal 
            onClose={() => setShowCheckout(false)}
            onConfirm={handleFinishCheckout}
            onManualPriceSave={handleManualPriceSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <BarcodeScannerModal 
            onScan={handleBarcodeScanned}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal Barcode Tidak Ditemukan */}
      <AnimatePresence>
        {showBarcodeNotFound && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-white"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-[32px] flex items-center justify-center text-red-500 mx-auto mb-6">
                  <Search size={36} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Produk Tidak Ditemukan</h3>
                <p className="text-sm text-slate-500 mb-4">Barcode <span className="font-black font-mono bg-slate-100 px-3 py-1 rounded-xl">{notFoundBarcode}</span> tidak terdaftar di database</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apakah anda ingin menambahkan produk baru dengan barcode ini?</p>
              </div>
              <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex gap-4">
                <button 
                  onClick={() => setShowBarcodeNotFound(false)}
                  className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  BATAL
                </button>
                <button 
                  onClick={() => {
                    setShowBarcodeNotFound(false);
                    setSearch(notFoundBarcode);
                    setProductFormData({
                      name: '',
                      sku: notFoundBarcode,
                      priceRetail: 0,
                      priceWholesale: 0,
                      priceCost: 0,
                      stock: 0,
                      category: 'Umum'
                    });
                    setShowAddProduct(true);
                  }}
                  className="flex-[2] py-5 bg-[#10B981] hover:bg-emerald-600 text-white rounded-3xl font-black text-sm transition-all active:scale-95"
                >
                  TAMBAH PRODUK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Tambah Produk */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl animate-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
              <div className="bg-[#10B981] p-6 text-white relative flex-shrink-0">
                <h3 className="text-2xl font-black tracking-tighter uppercase">PRODUK BARU</h3>
                <p className="text-green-50/70 font-bold uppercase tracking-widest text-[10px] mt-1">Tambah produk baru dari barcode scan</p>
                <button onClick={() => setShowAddProduct(false)} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-white/10">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const productData: Product = {
                  id: generateProductId(productFormData.sku, productFormData.sku),
                  sku: productFormData.sku || '',
                  name: productFormData.name || '',
                  priceRetail: Number(productFormData.priceRetail) || 0,
                  priceWholesale: Number(productFormData.priceWholesale) || 0,
                  priceCost: Number(productFormData.priceCost) || 0,
                  pricePromo: Number(productFormData.pricePromo) || 0,
                  stock: Number(productFormData.stock) || 0,
                  category: productFormData.category || 'Umum',
                  supplierId: productFormData.supplierId || '',
                  supplierName: productFormData.supplierName || '',
                  updated_at: Date.now()
                };
                await indexdbBarang.updateBarang(productData);
                // Update local cache
                setAllProducts(prev => [productData, ...prev]);
                // Add kategori baru jika belum ada
                if (productData.category && !categories.includes(productData.category)) {
                  setCategories(prev => [...prev, productData.category].sort());
                }
                setShowAddProduct(false);
                addToCart(productData);
              }} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-5 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-full">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Produk</label>
                      <input 
                        autoFocus
                        required
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        value={productFormData.name}
                        onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">SKU / Barcode</label>
                      <input 
                        required
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 pr-12 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold font-mono text-slate-700 transition-all"
                        value={productFormData.sku}
                        onChange={e => setProductFormData({...productFormData, sku: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori</label>
                      <input 
                        list="kategori-list-pos"
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-bold text-slate-700 transition-all"
                        value={productFormData.category}
                        onChange={e => setProductFormData({...productFormData, category: e.target.value})}
                        placeholder="Ketik nama kategori..."
                      />
                      <datalist id="kategori-list-pos">
                        {['Makanan', 'Minuman', 'Elektronik', 'Alat Tulis', 'Umum'].map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-purple-500">Supplier</label>
                      <select
                        className="w-full bg-purple-50/30 border-2 border-purple-50/50 p-4 rounded-2xl focus:border-purple-500 focus:bg-white outline-none font-bold text-purple-600 transition-all appearance-none cursor-pointer"
                        value={productFormData.supplierId || ''}
                        onChange={e => {
                          const selectedId = e.target.value;
                          const selectedSupplier = suppliers.find(s => s.id === selectedId);
                          setProductFormData({
                            ...productFormData,
                            supplierId: selectedId,
                            supplierName: selectedSupplier?.name || ''
                          });
                        }}
                      >
                        <option value="">— Pilih Supplier —</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">
                        {suppliers.length === 0 ? "Tidak ada supplier tersedia (tambah di halaman Supplier)" : `${suppliers.length} supplier tersedia`}
                      </p>
                    </div>
                    {isAdminUser && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-orange-500">Harga Modal</label>
                        <input 
                          type="text"
                          inputMode="numeric"
                          className="w-full bg-orange-50/30 border-2 border-orange-50/50 p-4 rounded-2xl focus:border-orange-500 focus:bg-white outline-none font-black text-orange-600 transition-all font-sans"
                          value={productFormData.priceCost}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              setProductFormData({...productFormData, priceCost: val});
                            }
                          }}
                          onBlur={() => {
                            if (productFormData.priceCost === '') setProductFormData({...productFormData, priceCost: '0'});
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-emerald-500">Harga Eceran</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-emerald-50/30 border-2 border-emerald-50/50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-black text-emerald-600 transition-all"
                        value={productFormData.priceRetail}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            setProductFormData({...productFormData, priceRetail: val});
                          }
                        }}
                        onBlur={() => {
                          if (productFormData.priceRetail === '') setProductFormData({...productFormData, priceRetail: '0'});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-blue-500">Harga Grosir</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-blue-50/30 border-2 border-blue-50/50 p-4 rounded-2xl focus:border-blue-500 focus:bg-white outline-none font-black text-blue-600 transition-all"
                        value={productFormData.priceWholesale}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            setProductFormData({...productFormData, priceWholesale: val});
                          }
                        }}
                        onBlur={() => {
                          if (productFormData.priceWholesale === '') setProductFormData({...productFormData, priceWholesale: '0'});
                        }}
                      />
                    </div>
                    <div className="space-y-2 col-span-full">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Stok Tersedia</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-50 border-2 border-slate-50 p-4 rounded-2xl focus:border-[#10B981] focus:bg-white outline-none font-black text-slate-700 transition-all"
                        value={productFormData.stock}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            setProductFormData({...productFormData, stock: val});
                          }
                        }}
                        onBlur={() => {
                          if (productFormData.stock === '') setProductFormData({...productFormData, stock: '0'});
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="p-6 flex gap-4 flex-shrink-0 border-t border-slate-100">
                  <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">Batal</button>
                  <button type="submit" className="flex-[2] py-3 bg-[#10B981] text-white font-black rounded-2xl shadow-xl shadow-green-100 active:scale-95 transition-all text-lg uppercase tracking-tighter">SIMPAN & TAMBAH KE KERANJANG</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Edit Modal */}
      <AnimatePresence>
        {selectedItem && (
          <ManualEditModal
            item={selectedItem}
            isWholesaleMode={isWholesaleMode}
            onClose={() => setSelectedItem(null)}
            onSave={(data) => {
              handleManualPriceSave(data);
              setSelectedItem(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingPriceSave && (
          <div className="fixed inset-0 z-[250] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100"
            >
              <div className="mb-4">
                <h3 className="text-xl font-black text-slate-900">Simpan Harga Permanen?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Harga produk <span className="font-black text-slate-800">{pendingPriceSave.item.name}</span> telah diubah menjadi <span className="font-black text-indigo-600">{formatCurrency(pendingPriceSave.newPrice)}</span>.
                  Apakah Anda ingin menyimpan harga ini sebagai harga {pendingPriceSave.priceField === 'priceWholesale' ? 'grosir' : 'eceran'} permanen di database?
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleConfirmSavePriceInDb(false)}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Tidak, hanya untuk transaksi
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSavePriceInDb(true)}
                  className="w-full sm:w-auto py-3 px-4 bg-[#10B981] text-white rounded-2xl font-black hover:bg-emerald-600 transition-all"
                >
                  Ya, simpan permanen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default POSPage;