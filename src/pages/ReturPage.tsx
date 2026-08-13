/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ HALAMAN RETUR BARANG
 * Retur Penjualan (customer return) & Retur Pembelian (return ke supplier)
 * - Mengurangi stok untuk retur penjualan
 * - Menambah stok untuk retur pembelian
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Package, Plus, X, CheckCircle2, Truck, Users, RefreshCw, TrendingDown, TrendingUp, History, AlertTriangle } from 'lucide-react';
import { Product } from '@/interfaces';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { indexdbRetur, ReturRecord } from '@/lib/indexdbRetur';
import { indexdbSupplier } from '@/lib/indexdbSupplier';
import { indexdbCustomer } from '@/lib/indexdbCustomer';
import { cn, formatCurrency } from '@/lib/utils';

type ReturType = 'sale_return' | 'purchase_return';

const ReturPage: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returHistory, setReturHistory] = useState<ReturRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form
  const [returType, setReturType] = useState<ReturType>('sale_return');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [returQty, setReturQty] = useState(1);
  const [returPrice, setReturPrice] = useState(0);
  const [reason, setReason] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [stats, setStats] = useState({ saleRefund: 0, purchaseRefund: 0 });

  // Load data
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const [raw, supps, custs, history] = await Promise.all([
          indexdbBarang.getAllBarang(),
          indexdbSupplier.getAll(),
          indexdbCustomer.getAll(),
          indexdbRetur.getAll(),
        ]);
        setAllProducts(raw.map((p: any) => ({ ...p, priceRetail: p.priceRetail || p.price || 0, priceWholesale: p.priceWholesale || p.wholesale_price || 0 })));
        setSuppliers(supps);
        setCustomers(custs);
        setReturHistory(history.slice(0, 50));
        setStats({
          saleRefund: await indexdbRetur.getTotalRefundByType('sale_return'),
          purchaseRefund: await indexdbRetur.getTotalRefundByType('purchase_return'),
        });
      } catch (e) {
        console.error('load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 30);
    const q = search.toLowerCase();
    return allProducts.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 50);
  }, [allProducts, search]);

  const resetForm = () => {
    setSelectedProduct(null);
    setReturQty(1);
    setReturPrice(0);
    setReason('');
    setCustomerName('');
    setTransactionId('');
    setSupplierId('');
    setInvoiceNumber('');
    setNotes('');
    setFormError('');
    setSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { setFormError('Pilih produk terlebih dahulu'); return; }
    if (returQty <= 0) { setFormError('Jumlah retur harus > 0'); return; }
    if (returType === 'sale_return' && !customerName.trim()) { setFormError('Nama pelanggan wajib diisi'); return; }
    if (returType === 'purchase_return' && !supplierId) { setFormError('Supplier wajib dipilih'); return; }

    setFormLoading(true);
    try {
      const product = selectedProduct;
      const stockChange = returType === 'sale_return' ? -returQty : returQty;
      const newStock = Math.max(0, (product.stock || 0) + stockChange);

      if (returType === 'sale_return' && (product.stock || 0) < returQty) {
        setFormError(`Stok tidak mencukupi. Stok saat ini: ${product.stock || 0}`);
        setFormLoading(false);
        return;
      }

      // Update stok
      await indexdbBarang.updateBarang({ ...product, stock: newStock, updated_at: Date.now() });
      setAllProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));

      // Catat retur
      const supplier = suppliers.find(s => s.id === supplierId);
      const record: ReturRecord = {
        id: indexdbRetur.generateId(),
        type: returType,
        productId: product.id || '',
        productName: product.name || '',
        productSku: product.sku || '',
        qty: returQty,
        price: returPrice,
        totalRefund: returPrice * returQty,
        reason,
        customerName: returType === 'sale_return' ? customerName.trim() : '',
        transactionId,
        supplierName: supplier?.name || '',
        supplierId: returType === 'purchase_return' ? supplierId : '',
        invoiceNumber,
        notes,
        created_at: Date.now(),
      };
      await indexdbRetur.add(record);

      setSuccessMsg(`✅ Retur ${returQty} pcs "${product.name}" berhasil! Stok: ${product.stock || 0} → ${newStock}`);
      resetForm();
      setShowForm(false);

      // Refresh history & stats
      const h = await indexdbRetur.getAll();
      setReturHistory(h.slice(0, 50));
      setStats({
        saleRefund: await indexdbRetur.getTotalRefundByType('sale_return'),
        purchaseRefund: await indexdbRetur.getTotalRefundByType('purchase_return'),
      });

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error('Retur error:', e);
      setFormError('Gagal memproses retur');
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Retur Barang</h1>
          <p className="text-sm text-slate-500 font-medium">Retur penjualan & retur pembelian</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) { indexdbRetur.getAll().then(h => setReturHistory(h.slice(0, 50))); } }}
            className="px-5 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-2">
            <History size={16} /> {showHistory ? 'Tutup' : 'Riwayat'}
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} disabled={allProducts.length === 0}
            className="px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-2xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 active:scale-95">
            <Plus size={16} /> Retur Baru
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-[24px] flex items-center gap-4 animate-in zoom-in duration-300">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <p className="font-bold text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Retur Penjualan</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(stats.saleRefund)}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Barang dari pelanggan</p>
          </div>
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500"><TrendingDown size={24} /></div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Retur Pembelian</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(stats.purchaseRefund)}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Barang ke supplier</p>
          </div>
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500"><TrendingUp size={24} /></div>
        </div>
      </div>

      {/* Form Retur */}
      {showForm && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-5 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xl text-slate-800">Form Retur</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>

          {formError && <div className="p-4 bg-red-50 border border-red-100 rounded-[16px] flex items-center gap-3"><AlertTriangle size={16} className="text-red-500 shrink-0" /><p className="text-xs font-bold text-red-600">{formError}</p></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipe Retur */}
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setReturType('sale_return')}
                className={cn("p-4 rounded-2xl border-2 font-black text-sm transition-all", returType === 'sale_return' ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-slate-100 text-slate-400')}>
                <Users size={18} className="mx-auto mb-1" /> Retur Penjualan
              </button>
              <button type="button" onClick={() => setReturType('purchase_return')}
                className={cn("p-4 rounded-2xl border-2 font-black text-sm transition-all", returType === 'purchase_return' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400')}>
                <Truck size={18} className="mx-auto mb-1" /> Retur Pembelian
              </button>
            </div>

            {/* Pilih Produk */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Produk</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk..." className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-sm outline-none" />
              {search && (
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-100 rounded-2xl p-2 bg-white">
                  {filteredProducts.map(p => (
                    <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setReturPrice(p.priceRetail); setSearch(''); }}
                      className={cn("w-full flex items-center gap-3 p-2 rounded-xl text-left text-xs font-bold transition-all", selectedProduct?.id === p.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50')}>
                      <span className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-[8px]">{p.name?.charAt(0)}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-slate-400">Stok: {p.stock || 0}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="p-3 bg-blue-50 rounded-2xl flex items-center gap-3">
                  <span className="font-black text-sm text-blue-700 flex-1">{selectedProduct.name} (Stok: {selectedProduct.stock})</span>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="text-red-400 text-[10px] font-bold">Ganti</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Jumlah</label>
                <input type="number" min={1} value={returQty} onChange={e => setReturQty(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Harga @</label>
                <input type="number" min={0} value={returPrice} onChange={e => setReturPrice(Math.max(0, Number(e.target.value) || 0))} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
              </div>
            </div>

            {/* Field spesifik berdasarkan tipe */}
            {returType === 'sale_return' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Pelanggan</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama pelanggan" list="customer-list" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                  <datalist id="customer-list">{customers.map(c => <option key={c.id} value={c.name || c.nama || ''} />)}</datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ID Transaksi (opsional)</label>
                  <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="TRX-..." className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none">
                    <option value="">— Pilih Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">No. Faktur</label>
                  <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="FKT-..." className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alasan Retur</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Rusak, kadaluarsa, salah, dll..." className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
            </div>

            {/* Preview */}
            {selectedProduct && returQty > 0 && (
              <div className="p-4 bg-amber-50 rounded-[20px] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {returType === 'sale_return' ? '🔄 Dikembalikan pelanggan' : '🔄 Dikembalikan ke supplier'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                    Stok: <span className="text-slate-600">{selectedProduct.stock || 0}</span> → <span className={cn("font-black", returType === 'sale_return' ? 'text-red-600' : 'text-emerald-600')}>
                      {Math.max(0, (selectedProduct.stock || 0) + (returType === 'sale_return' ? -returQty : returQty))}
                    </span>
                  </p>
                </div>
                <p className="font-black text-lg text-amber-700">{formatCurrency(returPrice * returQty)}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 bg-slate-50 text-slate-600 py-4 rounded-2xl font-black text-sm">Batal</button>
              <button type="submit" disabled={formLoading || !selectedProduct}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed active:scale-95">
                {formLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                Proses Retur
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Riwayat */}
      {showHistory && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500"><History size={20} /></div>
            <h3 className="font-black text-lg text-slate-800">Riwayat Retur</h3>
          </div>
          {returHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm">Belum Ada Retur</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
              {returHistory.map(r => (
                <div key={r.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-[20px]">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    r.type === 'sale_return' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500')}>
                    {r.type === 'sale_return' ? <Users size={18} /> : <Truck size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-800 truncate">{r.productName} x{r.qty}</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {r.type === 'sale_return' ? `Pelanggan: ${r.customerName}` : `Supplier: ${r.supplierName}`}
                      {' • '}{formatDate(r.created_at)}
                    </p>
                    {r.reason && <p className="text-[9px] text-slate-400 italic">{r.reason}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm text-amber-600">{formatCurrency(r.totalRefund)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReturPage;