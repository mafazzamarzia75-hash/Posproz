/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ HALAMAN HUTANG PIUTANG
 * - Piutang: Pelanggan yang berutang ke toko
 * - Hutang: Toko yang berutang ke supplier
 * - Terintegrasi dengan data pelanggan & supplier yang sudah ada
 * - Riwayat pembayaran
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, RefreshCw, X, CheckCircle2, Calendar, User, Truck, DollarSign, TrendingUp, TrendingDown, Wallet, Filter, Edit3, Trash2, Users, Package, ArrowRight, Phone, MapPin, Clock, Ban, FileText } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { indexdbDebt, Debt } from '@/lib/indexdbDebt';
import { indexdbCustomer } from '@/lib/indexdbCustomer';
import { indexdbSupplier } from '@/lib/indexdbSupplier';

const DebtPage: React.FC = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'receivable' | 'payable'>('all');

  // ✅ Form state
  const [formType, setFormType] = useState<'receivable' | 'payable'>('receivable');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [formPaidAmount, setFormPaidAmount] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSource, setFormSource] = useState<'manual' | 'customer' | 'supplier'>('manual');

  const loadDebts = useCallback(async () => {
    try {
      setIsLoading(true);
      let data: Debt[];

      if (search.trim()) {
        data = await indexdbDebt.search(search);
      } else if (filterType !== 'all') {
        data = await indexdbDebt.getByType(filterType);
      } else {
        data = await indexdbDebt.getAll();
      }

      if (filterStatus !== 'all') {
        data = data.filter(d => d.status === filterStatus);
      }

      setDebts(data.sort((a, b) => b.created_at - a.created_at));
      setTotalReceivable(await indexdbDebt.getTotalReceivable());
      setTotalPayable(await indexdbDebt.getTotalPayable());
    } catch (e) {
      console.error('Load debts error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterType, filterStatus]);

  useEffect(() => {
    (async () => {
      try {
        const [custs, supps] = await Promise.all([
          indexdbCustomer.getAll(),
          indexdbSupplier.getAll(),
        ]);
        setCustomers(custs);
        setSuppliers(supps);
      } catch { /* noop */ }
    })();
    loadDebts();
  }, [loadDebts]);

  const resetForm = () => {
    setFormType('receivable');
    setFormCustomerName('');
    setFormSupplierName('');
    setFormAmount('');
    setFormDescription('');
    setFormDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setFormPaidAmount('');
    setFormError('');
    setEditingDebt(null);
    setFormSource('manual');
  };

  const openAddModal = (type?: 'receivable' | 'payable') => {
    resetForm();
    if (type) setFormType(type);
    setShowModal(true);
  };

  const openEditModal = (d: Debt) => {
    setEditingDebt(d);
    setFormType(d.type);
    setFormCustomerName(d.customerName || '');
    setFormSupplierName(d.supplierName || '');
    setFormAmount(d.amount.toString());
    setFormDescription(d.description);
    setFormDueDate(new Date(d.dueDate).toISOString().split('T')[0]);
    setFormPaidAmount(d.paidAmount.toString());
    setFormError('');
    setFormSource('manual');
    setShowModal(true);
  };

  const selectCustomer = (name: string) => {
    setFormCustomerName(name);
    setFormSource('customer');
  };

  const selectSupplier = (name: string) => {
    setFormSupplierName(name);
    setFormSource('supplier');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return; // 🔴 Cegah double submit
    if (!formAmount || Number(formAmount) <= 0) {
      setFormError('Jumlah harus lebih dari 0');
      return;
    }
    if (formType === 'receivable' && !formCustomerName.trim()) {
      setFormError('Nama pelanggan wajib diisi untuk piutang');
      return;
    }
    if (formType === 'payable' && !formSupplierName.trim()) {
      setFormError('Nama supplier wajib diisi untuk hutang');
      return;
    }

    setFormSaving(true);
    try {
      const now = Date.now();
      const amount = Number(formAmount);
      const paid = Number(formPaidAmount) || 0;
      const status: 'unpaid' | 'partial' | 'paid' = paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

      const debt: Debt = {
        id: editingDebt?.id || indexdbDebt.generateId(),
        type: formType,
        customerName: formCustomerName.trim(),
        supplierName: formSupplierName.trim(),
        amount,
        paidAmount: paid,
        description: formDescription.trim(),
        dueDate: new Date(formDueDate).getTime(),
        status,
        created_at: editingDebt?.created_at || now,
        updated_at: now,
      };

      await indexdbDebt.save(debt);
      setShowModal(false);
      resetForm();
      await loadDebts();
    } catch (e) {
      console.error('Save debt error:', e);
      setFormError('Gagal menyimpan');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data ini?')) return;
    try {
      await indexdbDebt.delete(id);
      await loadDebts();
    } catch (e) {
      console.error('Delete debt error:', e);
      alert('Gagal menghapus data. Silakan coba lagi.');
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const today = new Date();

  // Filter untuk tab
  const filteredByTab = useMemo(() => {
    if (activeTab === 'all') return debts;
    return debts.filter(d => d.type === activeTab);
  }, [debts, activeTab]);

  const overdueCount = useMemo(() =>
    debts.filter(d => d.status !== 'paid' && new Date(d.dueDate) < today).length,
  [debts]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hutang & Piutang</h1>
          <p className="text-sm text-slate-500 font-medium">
            Piutang pelanggan: {formatCurrency(totalReceivable)} • Hutang supplier: {formatCurrency(totalPayable)}
            {overdueCount > 0 && <span className="text-red-500 ml-2">• {overdueCount} jatuh tempo</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openAddModal('receivable')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black text-xs transition-all shadow-sm flex items-center gap-2 active:scale-95">
            <Plus size={16} /> Piutang
          </button>
          <button onClick={() => openAddModal('payable')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-2xl font-black text-xs transition-all shadow-sm flex items-center gap-2 active:scale-95">
            <Plus size={16} /> Hutang
          </button>
        </div>
      </div>

      {/* Tab: Semua / Piutang / Hutang */}
      <div className="flex gap-2">
        {[
          { id: 'all' as const, label: 'Semua', icon: <Wallet size={14} /> },
          { id: 'receivable' as const, label: 'Piutang', icon: <TrendingUp size={14} /> },
          { id: 'payable' as const, label: 'Hutang', icon: <TrendingDown size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setFilterType(tab.id === 'all' ? 'all' : tab.id); }}
            className={cn("flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-sm",
              activeTab === tab.id
                ? tab.id === 'receivable' ? 'bg-emerald-500 text-white' : tab.id === 'payable' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'
                : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
            )}>
            {tab.icon} {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        {/* Search */}
        <div className="relative w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." className="w-full bg-white border border-slate-100 pl-9 pr-3 py-3 rounded-2xl font-bold text-xs text-slate-700 outline-none shadow-sm" />
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw size={32} className="animate-spin text-slate-300" /></div>
      ) : filteredByTab.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 flex flex-col items-center text-slate-300">
          <Wallet size={64} className="opacity-20 mb-6" />
          <p className="text-lg font-black text-slate-400 mb-2">Belum ada catatan</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-6">Catat piutang pelanggan atau hutang ke supplier</p>
          <div className="flex gap-3">
            <button onClick={() => openAddModal('receivable')} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-sm flex items-center gap-2"><Plus size={16} /> Catat Piutang</button>
            <button onClick={() => openAddModal('payable')} className="bg-red-500 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-sm flex items-center gap-2"><Plus size={16} /> Catat Hutang</button>
          </div>
        </div>
      ) : (
        /* Daftar */
        <div className="space-y-3">
          {filteredByTab.map(d => {
            const remaining = d.amount - d.paidAmount;
            const isOverdue = d.status !== 'paid' && new Date(d.dueDate) < today;
            const progress = d.amount > 0 ? (d.paidAmount / d.amount * 100) : 0;

            return (
              <div key={d.id} className={cn("bg-white p-5 rounded-[24px] border shadow-sm transition-all hover:shadow-md",
                isOverdue ? 'border-red-200' : d.status === 'paid' ? 'border-emerald-200' : 'border-slate-100'
              )}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    d.type === 'receivable' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                  )}>
                    {d.type === 'receivable' ? <User size={20} /> : <Truck size={20} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-base text-slate-800">
                        {d.type === 'receivable' ? d.customerName : d.supplierName}
                      </h3>
                      {/* Status badge */}
                      <span className={cn("px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
                        d.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                        d.status === 'partial' ? 'bg-amber-50 text-amber-600' :
                        isOverdue ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'
                      )}>
                        {isOverdue && d.status !== 'paid' ? '🔴 Telat' :
                         d.status === 'paid' ? '✅ Lunas' :
                         d.status === 'partial' ? '⏳ Sebagian' : '⏸️ Belum'}
                      </span>
                      <span className={cn("px-2.5 py-1 rounded-full text-[8px] font-black",
                        d.type === 'receivable' ? 'bg-emerald-50/50 text-emerald-500' : 'bg-red-50/50 text-red-500'
                      )}>
                        {d.type === 'receivable' ? 'Piutang' : 'Hutang'}
                      </span>
                    </div>

                    {d.description && <p className="text-xs text-slate-500 font-bold mt-1">{d.description}</p>}

                    {/* Progress bar */}
                    {d.status !== 'paid' && d.status !== 'unpaid' && (
                      <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", d.type === 'receivable' ? 'bg-emerald-400' : 'bg-red-400')}
                          style={{ width: `${progress}%` }} />
                      </div>
                    )}

                    {/* Detail */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold">
                      <span className={cn("text-sm font-black", d.type === 'receivable' ? 'text-emerald-600' : 'text-red-600')}>
                        {formatCurrency(remaining)}
                      </span>
                      {d.paidAmount > 0 && (
                        <span className="text-slate-400">Dibayar: {formatCurrency(d.paidAmount)}</span>
                      )}
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        Jatuh tempo: {formatDate(d.dueDate)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditModal(d)} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all active:scale-90" title="Edit"><Edit3 size={15} /></button>
                    <button onClick={() => handleDelete(d.id)} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-90" title="Hapus"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredByTab.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredByTab.length} catatan</p>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black tracking-tight">{editingDebt ? 'Edit' : 'Catat Baru'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {formType === 'receivable' ? 'Piutang Pelanggan' : 'Hutang ke Supplier'}
                </p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><X size={20} /></button>
            </div>

            {formError && <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-[16px] flex items-center gap-3"><X size={16} className="text-red-500 shrink-0" /><p className="text-xs font-bold text-red-600">{formError}</p></div>}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Tipe */}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setFormType('receivable')} className={cn("p-4 rounded-2xl border-2 font-black text-sm transition-all", formType === 'receivable' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400')}>
                  <Users size={18} className="mx-auto mb-1" /> Piutang
                </button>
                <button type="button" onClick={() => setFormType('payable')} className={cn("p-4 rounded-2xl border-2 font-black text-sm transition-all", formType === 'payable' ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 text-slate-400')}>
                  <Truck size={18} className="mx-auto mb-1" /> Hutang
                </button>
              </div>

              {/* Nama */}
              {formType === 'receivable' ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Pelanggan <span className="text-red-500">*</span></label>
                  <input type="text" value={formCustomerName} onChange={e => setFormCustomerName(e.target.value)} placeholder="Ketik atau pilih dari daftar..." list="customer-debt-list" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                  <datalist id="customer-debt-list">
                    {customers.map(c => <option key={c.id} value={c.name || c.nama || ''} />)}
                  </datalist>
                  {/* Quick select dari customer yang sudah ada */}
                  {customers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {customers.slice(0, 10).map(c => (
                        <button key={c.id} type="button" onClick={() => selectCustomer(c.name || c.nama || '')}
                          className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold hover:bg-emerald-100 transition-all">
                          {c.name || c.nama}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Supplier <span className="text-red-500">*</span></label>
                  <input type="text" value={formSupplierName} onChange={e => setFormSupplierName(e.target.value)} placeholder="Ketik atau pilih dari daftar..." list="supplier-debt-list" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                  <datalist id="supplier-debt-list">
                    {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                  {suppliers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suppliers.slice(0, 10).map(s => (
                        <button key={s.id} type="button" onClick={() => selectSupplier(s.name)}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold hover:bg-red-100 transition-all">
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Jumlah */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Jumlah <span className="text-red-500">*</span></label>
                  <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="100000" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sudah Dibayar</label>
                  <input type="number" value={formPaidAmount} onChange={e => setFormPaidAmount(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
                </div>
              </div>

              {/* Keterangan */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Keterangan</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Misal: Pembelian barang bulan Mei" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
              </div>

              {/* Jatuh Tempo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Jatuh Tempo</label>
                <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none" />
              </div>

              {/* Preview */}
              {formAmount && Number(formAmount) > 0 && (
                <div className={cn("p-4 rounded-[20px] flex items-center justify-between",
                  formType === 'receivable' ? 'bg-emerald-50' : 'bg-red-50')}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sisa:</span>
                  <span className={cn("font-black text-lg", formType === 'receivable' ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCurrency(Number(formAmount) - (Number(formPaidAmount) || 0))}
                  </span>
                </div>
              )}

              {/* Tombol */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 bg-slate-50 text-slate-600 py-4 rounded-2xl font-black text-sm">Batal</button>
                <button type="submit" disabled={formSaving} className="flex-1 bg-[#10B981] text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-green-100 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {formSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                  {formSaving ? 'Menyimpan...' : (editingDebt ? 'Simpan' : 'Tambah')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtPage;