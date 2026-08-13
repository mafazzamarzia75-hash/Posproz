/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ShoppingBag, Printer, History, Search, ChevronRight, Calendar, ArrowLeft } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { printerService } from '@/services/hardware/PrinterService';
import { motion, AnimatePresence } from 'motion/react';

// ✅ Interface khusus dari IndexedDB (format penyimpanan sebenarnya)
interface DbTransactionItem {
  product_name: string;
  qty: number;
  price_at_sale: number;
  quantity?: number;
  jumlah?: number;
  price?: number;
  harga?: number;
  harga_jual?: number;
}

interface DbTransaction {
  id: string;
  items: DbTransactionItem[];
  total: number;
  customerName?: string;
  created_at: number;
  is_synced: number;
}

const HistoryPage: React.FC = () => {
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [selectedTrx, setSelectedTrx] = useState<DbTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { storeInfo } = useSettingsStore();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await indexdbTransaksi.getAll();
      setTransactions(data || []);
    } catch (err) {
      console.error("Error load transaksi:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (trxId: string) => {
    try {
      const trx = await indexdbTransaksi.getById(trxId);
      if (!trx || !trx.items) {
        alert("Data transaksi tidak ditemukan.");
        return;
      }

      // Hitung subtotal dari items jika data lama tidak punya field subtotal
      const trxSubtotal = trx.subtotal ?? trx.items.reduce((acc: number, item: DbTransactionItem) => {
        const qty = Number(item.qty || item.quantity || item.jumlah) || 1;
        const harga = Number(item.price_at_sale || item.price || item.harga || item.harga_jual) || 0;
        return acc + (qty * harga);
      }, 0);
      const trxDiscount = trx.discountAmount ?? Math.max(0, trxSubtotal - trx.total);

      await printerService.printReceipt({
        title: storeInfo.name,
        address: storeInfo.address,
        phone: storeInfo.phone,
        transactionId: trx.id,
        customerName: trx.customerName,
        items: trx.items,
        subtotal: trxSubtotal,
        discountAmount: trxDiscount,
        total: trx.total,
        footer: storeInfo.footer
      });
      alert("Struk berhasil dikirim ke printer (Reprint)");
    } catch (error) {
      console.error(error);
      alert("Gagal mencetak ulang struk.");
    }
  };

  // ✅ Helper: ambil qty dengan fallback ke berbagai nama field
  const getItemQty = (item: any): number => {
    const qty = Number(item?.qty ?? item?.quantity ?? item?.jumlah ?? 1);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  };

  // ✅ Helper: ambil harga dengan fallback ke berbagai nama field
  const getItemPrice = (item: any): number => {
    const price = Number(item?.price_at_sale ?? item?.price ?? item?.harga ?? item?.harga_jual ?? 0);
    return Number.isFinite(price) && price >= 0 ? price : 0;
  };

  const filteredTransactions = transactions.filter(t => 
    t.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Riwayat</h1>
          <p className="text-sm text-slate-500 font-medium">Data transaksi penjualan yang telah dilakukan</p>
        </div>
        <div className="relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10B981] transition-colors" size={18} />
           <input 
             type="text"
             placeholder="Cari ID Transaksi..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#10B981] outline-none transition-all font-bold text-sm text-slate-700"
           />
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-4">
             <div className="w-12 h-12 border-4 border-slate-100 border-t-[#10B981] rounded-full animate-spin"></div>
             <p className="text-xs font-black uppercase tracking-widest leading-none">Memuat Data...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-4">
             <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200">
                <History size={40} />
             </div>
             <p className="text-xs font-black uppercase tracking-widest leading-none">Tidak ada transaksi ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredTransactions.map((trx) => (
              <div 
                key={trx.id} 
                className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer group active:bg-slate-100/50"
                onClick={async () => {
                   const detail = await indexdbTransaksi.getById(trx.id);
                   setSelectedTrx(detail);
                }}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-bold group-hover:bg-white group-hover:text-[#10B981] shadow-inner transition-all">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">{trx.id}</h3>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-tighter">
                          <Calendar size={10} /> 
                          {new Date(trx.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                       </span>
                       <span className={cn(
                         "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                         trx.is_synced ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                       )}>
                         {trx.is_synced ? 'Synced' : 'Local'}
                       </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-lg tracking-tighter">{formatCurrency(trx.total)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Lunas</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReprint(trx.id);
                    }}
                    className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 shadow-sm transition-all active:scale-90"
                    title="Cetak Ulang Struk"
                  >
                    <Printer size={20} />
                  </button>
                  <ChevronRight size={20} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedTrx && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden border border-white"
            >
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedTrx(null)} className="p-2 -ml-2 text-white/40 hover:text-white"><ArrowLeft size={20}/></button>
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] leading-none mb-1">Detail Transaksi</p>
                      <h3 className="text-xl font-black tracking-tight">{selectedTrx.id}</h3>
                    </div>
                 </div>
                 <button 
                   onClick={() => handleReprint(selectedTrx.id)}
                   className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95"
                 >
                   <Printer size={20} />
                 </button>
              </div>

              <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
                  <div className="space-y-4">
                    {(selectedTrx.items || []).map((item: any, idx: number) => {
                      const qty = getItemQty(item);
                      const price = getItemPrice(item);
                      return (
                        <div key={idx} className="flex justify-between items-start group">
                           <div className="flex-1 pr-4">
                              <p className="font-black text-slate-800 text-sm leading-snug truncate uppercase">{item.product_name || item.name || item.nama || 'Produk'}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{qty} x {formatCurrency(price)}</p>
                           </div>
                           <p className="font-black text-slate-700 text-sm">{formatCurrency(qty * price)}</p>
                        </div>
                      );
                    })}
                 </div>

                 <div className="pt-6 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-slate-400">
                       <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Subtotal</span>
                       <span className="font-bold text-sm tracking-tighter">{formatCurrency(selectedTrx.total)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">Total Pembayaran</span>
                       <span className="text-2xl font-black text-[#10B981] tracking-tighter">{formatCurrency(selectedTrx.total)}</span>
                    </div>
                 </div>

                 <div className="bg-slate-50 rounded-3xl p-6 text-center space-y-2 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Informasi Waktu</p>
                    <p className="font-black text-slate-700 text-xs uppercase">{new Date(selectedTrx.created_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
                 </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-50">
                 <button 
                   onClick={() => setSelectedTrx(null)}
                   className="w-full py-4 bg-white border border-slate-100 rounded-2xl font-black text-sm text-slate-400 uppercase tracking-[0.2em] hover:bg-slate-50 transition-colors shadow-sm"
                 >
                   Tutup Detail
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HistoryPage;