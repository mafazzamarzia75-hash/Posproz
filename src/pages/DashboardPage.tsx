/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, TrendingUp, ArrowUpRight, AlertCircle, Users, BarChart3, RefreshCw } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Product } from '@/interfaces';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi';
import { indexdbCustomer } from '@/lib/indexdbCustomer';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [totalOmzetHariIni, setTotalOmzetHariIni] = useState(0);
  const [totalTransaksiHariIni, setTotalTransaksiHariIni] = useState(0);
  const [totalProduk, setTotalProduk] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);

      // ✅ Ambil data langsung dari IndexedDB — sumber kebenaran tunggal
      const [allProducts, allTransactions, allCustomers] = await Promise.all([
        indexdbBarang.getAllBarang(),
        indexdbTransaksi.getAll(),
        indexdbCustomer.getAll()
      ]);

      // ✅ Hitung total produk dari jumlah aktual array (bukan count() yang bisa stale)
      const jumlahProduk = allProducts.length;

      // ✅ Filter transaksi HARI INI saja (bukan semua transaksi)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const transaksiHariIni = allTransactions.filter((trx: any) => {
        if (!trx.created_at) return false;
        // created_at bisa berupa ISO string atau timestamp number
        const trxDate = new Date(trx.created_at);
        const trxStr = `${trxDate.getFullYear()}-${String(trxDate.getMonth() + 1).padStart(2, '0')}-${String(trxDate.getDate()).padStart(2, '0')}`;
        return trxStr === todayStr;
      });

      const omzetHariIni = transaksiHariIni.reduce(
        (sum: number, trx: any) => sum + (Number(trx.total) || 0),
        0
      );

      // ✅ Produk stok menipis (stok <= 5)
      const mapped = allProducts.map((p: any) => ({
        ...p,
        sku: p.sku || p.barcode || '',
        priceRetail: p.priceRetail || p.price || 0,
        priceWholesale: p.priceWholesale || p.wholesale_price || 0,
      }));
      const stokMenipis = mapped
        .filter((p: any) => (p.stock ?? 0) <= 5)
        .sort((a: any, b: any) => (a.stock ?? 0) - (b.stock ?? 0));

      setTotalProduk(jumlahProduk);
      setTotalOmzetHariIni(omzetHariIni);
      setTotalTransaksiHariIni(transaksiHariIni.length);
      setTotalCustomers(allCustomers.length);
      setLowStockProducts(stokMenipis);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard loadStats error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Load saat mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ✅ Refresh otomatis saat tab/halaman kembali aktif (pindah dari halaman lain)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadStats();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadStats]);

  // ✅ Kartu statistik dengan navigasi
  const stats = [
    {
      label: 'PENJUALAN HARI INI',
      value: isLoading ? '...' : formatCurrency(totalOmzetHariIni),
      icon: <TrendingUp size={24} />,
      color: 'text-[#4F46E5]',
      bg: 'bg-[#4F46E5]/10',
      onClick: () => navigate('/pos'),
    },
    {
      label: 'TRANSAKSI HARI INI',
      value: isLoading ? '...' : `${totalTransaksiHariIni} Pesanan`,
      icon: <ShoppingCart size={24} />,
      color: 'text-[#3B82F6]',
      bg: 'bg-[#3B82F6]/10',
      onClick: () => navigate('/history'),
    },
    {
      label: 'TOTAL VARIAN PRODUK',
      value: isLoading ? '...' : `${totalProduk.toLocaleString('id-ID')} Item`,
      icon: <Package size={24} />,
      color: 'text-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      onClick: () => navigate('/inventory'),
    },
    {
      label: 'TOTAL PELANGGAN',
      value: isLoading ? '...' : `${totalCustomers.toLocaleString('id-ID')} Orang`,
      icon: <Users size={24} />,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      onClick: () => navigate('/customers'),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Beranda</h1>
          <p className="text-sm text-slate-500 font-medium">Ringkasan operasional toko hari ini</p>
          {lastUpdated && !isLoading && (
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Diperbarui {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {/* ✅ Tombol refresh manual */}
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-sm disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards — sekarang bisa diklik dan navigasi ke halaman terkait */}
      <div className="space-y-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            onClick={stat.onClick}
            className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center justify-between shadow-sm active:scale-98 transition-transform cursor-pointer hover:border-indigo-200 hover:shadow-md"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className={cn('text-2xl font-black tracking-tight', stat.color)}>
                {stat.value}
              </p>
            </div>
            <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', stat.bg, stat.color)}>
              {isLoading ? (
                <RefreshCw size={20} className="animate-spin opacity-50" />
              ) : (
                stat.icon
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stok Menipis */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">Stok Menipis</h3>
              {lowStockProducts.length > 0 && (
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                  {lowStockProducts.length} produk perlu restock
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => navigate('/inventory')}
            className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline uppercase tracking-wider"
          >
            Lihat Semua <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="border-t border-slate-50">
          {isLoading ? (
            <div className="p-10 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-slate-300" />
            </div>
          ) : lowStockProducts.length > 0 ? (
            <div className="p-4 space-y-3">
              {lowStockProducts.slice(0, 5).map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => navigate('/inventory')}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-100">
                      {p.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        SKU: {p.sku || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-black text-sm',
                      p.stock === 0 ? 'text-red-600' : 'text-red-500'
                    )}>
                      {p.stock} pcs
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      {p.stock === 0 ? 'Habis' : 'Sisa Stok'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-slate-300">
              <Package size={48} className="opacity-20 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">
                Stok barang aman
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/history')}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pelanggan</span>
        </button>
        <button 
          onClick={() => navigate('/reports')}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center">
            <BarChart3 size={24} />
          </div>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Laba Rugi</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;