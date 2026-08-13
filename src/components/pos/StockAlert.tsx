/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Komponen Notifikasi Stok Menipis Realtime
 * Muncul sebagai banner di bagian atas layar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, X, Package, RefreshCw } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { useNavigate } from 'react-router-dom';

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
}

const StockAlert: React.FC = () => {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  const checkStock = useCallback(async () => {
    try {
      setIsLoading(true);
      const allProducts = await indexdbBarang.getAllBarang();
      
      const lowStock = allProducts
        .filter((p: any) => (p.stock ?? 0) <= 5)
        .sort((a: any, b: any) => (a.stock ?? 0) - (b.stock ?? 0))
        .slice(0, 10)
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'Tanpa Nama',
          sku: p.sku || p.barcode || '-',
          stock: p.stock ?? 0,
        }));

      setLowStockItems(lowStock);
      
      // ✅ Sembunyikan banner jika tidak ada stok menipis
      if (lowStock.length === 0) {
        setIsVisible(false);
      }
    } catch (e) {
      console.error('Stock alert check error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStock();

    // ✅ Cek ulang setiap 30 detik
    const interval = setInterval(checkStock, 30000);
    return () => clearInterval(interval);
  }, [checkStock]);

  // ✅ Juga cek saat halaman kembali aktif
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkStock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkStock]);

  if (!isVisible || lowStockItems.length === 0) return null;

  return (
    <div className="animate-in slide-in-from-top-4 duration-500">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-[20px] shadow-xl shadow-red-100 overflow-hidden mb-4">
        <div className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-black text-sm uppercase tracking-tight">
                Stok Menipis! {lowStockItems.length} produk perlu restock
              </p>
              <button
                onClick={() => setIsVisible(false)}
                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center shrink-0 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* ✅ Daftar produk stok menipis */}
            <div className="mt-3 space-y-1.5">
              {lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  onClick={() => { navigate('/inventory'); setIsVisible(false); }}
                  className="flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={12} className="shrink-0 opacity-60" />
                    <span className="text-xs font-bold truncate">{item.name}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase">#{item.sku}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-black shrink-0 ml-2",
                    item.stock === 0 ? "text-red-200" : "text-white"
                  )}>
                    {item.stock} PCS
                  </span>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <button
                  onClick={() => { navigate('/inventory'); setIsVisible(false); }}
                  className="w-full text-center text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white py-1 transition-all"
                >
                  + {lowStockItems.length - 5} produk lainnya — klik lihat semua
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAlert;