/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Halaman Manajemen Diskon & Promo
 * Fitur: Tambah, Edit, Hapus, Aktif/Nonaktifkan kode diskon
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit3, RefreshCw, AlertCircle, X, CheckCircle2, Percent, Tag, Calendar, ToggleLeft, ToggleRight, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { indexdbDiscount, Discount, ActiveDiscount } from '@/lib/indexdbDiscount';

const DiscountPage: React.FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  // ✅ Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'percentage' | 'nominal'>('percentage');
  const [formValue, setFormValue] = useState('');
  const [formMinPurchase, setFormMinPurchase] = useState('');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formValidFrom, setFormValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [formValidUntil, setFormValidUntil] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadDiscounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await indexdbDiscount.getAll();
      const q = search.toLowerCase().trim();
      const filtered = q ? data.filter(d => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) : data;
      setDiscounts(filtered.sort((a, b) => b.created_at - a.created_at));
    } catch (e) {
      console.error('Load discounts error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => { loadDiscounts(); }, [loadDiscounts]);

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormType('percentage');
    setFormValue('');
    setFormMinPurchase('');
    setFormMaxDiscount('');
    setFormUsageLimit('');
    setFormValidFrom(new Date().toISOString().split('T')[0]);
    setFormValidUntil(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setFormError('');
    setEditingDiscount(null);
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

  const openEditModal = (d: Discount) => {
    setEditingDiscount(d);
    setFormCode(d.code);
    setFormName(d.name);
    setFormType(d.type);
    setFormValue(d.value.toString());
    setFormMinPurchase(d.minPurchase.toString());
    setFormMaxDiscount(d.maxDiscount.toString());
    setFormUsageLimit(d.usageLimit.toString());
    setFormValidFrom(new Date(d.validFrom).toISOString().split('T')[0]);
    setFormValidUntil(new Date(d.validUntil).toISOString().split('T')[0]);
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return; // 🔴 Cegah double submit
    if (!formCode.trim() || !formName.trim() || !formValue) {
      setFormError('Kode, nama, dan nilai diskon wajib diisi');
      return;
    }
    if (Number(formValue) <= 0) {
      setFormError('Nilai diskon harus lebih dari 0');
      return;
    }
    if (formType === 'percentage' && Number(formValue) > 100) {
      setFormError('Diskon persen maksimal 100%');
      return;
    }

    setFormSaving(true);
    try {
      const now = Date.now();
      const discount: Discount = {
        id: editingDiscount?.id || indexdbDiscount.generateId(),
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        type: formType,
        value: Number(formValue),
        minPurchase: Number(formMinPurchase) || 0,
        maxDiscount: Number(formMaxDiscount) || 0,
        isActive: editingDiscount?.isActive ?? true,
        usageLimit: Number(formUsageLimit) || 0,
        usageCount: editingDiscount?.usageCount || 0,
        validFrom: new Date(formValidFrom).getTime(),
        validUntil: new Date(formValidUntil).getTime(),
        created_at: editingDiscount?.created_at || now,
        updated_at: now,
      };

      await indexdbDiscount.save(discount);
      setShowModal(false);
      resetForm();
      await loadDiscounts();
    } catch (e) {
      console.error('Save discount error:', e);
      setFormError('Gagal menyimpan diskon');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus diskon ini?')) return;
    try {
      await indexdbDiscount.delete(id);
      await loadDiscounts();
    } catch (e) {
      console.error('Delete discount error:', e);
      alert('Gagal menghapus diskon. Silakan coba lagi.');
    }
  };

  const handleToggle = async (d: Discount) => {
    try {
      await indexdbDiscount.save({ ...d, isActive: !d.isActive });
      await loadDiscounts();
    } catch (e) {
      console.error('Toggle discount error:', e);
      alert('Gagal mengubah status diskon. Silakan coba lagi.');
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Diskon & Promo</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola kode diskon dan voucher</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {discounts.filter(d => d.isActive).length} aktif dari {discounts.length} kode
          </p>
        </div>
        <button onClick={openAddModal} className="bg-[#10B981] hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95">
          <Plus size={18} strokeWidth={2.5} /> Tambah Diskon
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode atau nama diskon..." className="w-full bg-white border border-slate-100 pl-12 pr-4 py-4 rounded-[24px] font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all shadow-sm" />
        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"><X size={18} /></button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw size={32} className="animate-spin text-slate-300" /></div>
      ) : discounts.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 flex flex-col items-center text-slate-300">
          <Percent size={64} className="opacity-20 mb-6" />
          <p className="text-lg font-black text-slate-400 mb-2">Belum ada diskon</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Buat kode diskon untuk menarik pelanggan</p>
          {!search.trim() && <button onClick={openAddModal} className="mt-6 bg-[#10B981] text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-green-100">Buat Diskon Pertama</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.map(d => (
            <div key={d.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", d.isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300')}>
                  <Tag size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-800">{d.code}</h3>
                    <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase", d.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400')}>
                      {d.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">{d.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400">
                    <span>{d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}</span>
                    {d.minPurchase > 0 && <span>Min. {formatCurrency(d.minPurchase)}</span>}
                    {d.usageLimit > 0 && <span>{d.usageCount}/{d.usageLimit} digunakan</span>}
                    <span>{formatDate(d.validFrom)} - {formatDate(d.validUntil)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(d)} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-all active:scale-90" title={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                    {d.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEditModal(d)} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all active:scale-90"><Edit3 size={15} /></button>
                  <button onClick={() => handleDelete(d.id)} className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-90"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && discounts.length > 0 && <div className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{discounts.length} kode diskon</p></div>}

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight">{editingDiscount ? 'Edit Diskon' : 'Tambah Diskon'}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><X size={20} /></button>
            </div>

            {formError && <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-[16px] flex items-center gap-3"><AlertCircle size={16} className="text-red-500 shrink-0" /><p className="text-xs font-bold text-red-600">{formError}</p></div>}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kode <span className="text-red-500">*</span></label>
                  <input type="text" value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="PROMO10" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 uppercase focus:border-[#10B981] outline-none transition-all" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipe</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all">
                    <option value="percentage">Persen (%)</option>
                    <option value="nominal">Nominal (Rp)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Diskon <span className="text-red-500">*</span></label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Diskon Akhir Tahun" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nilai <span className="text-red-500">*</span></label>
                  <div className="relative">
                    {formType === 'nominal' && <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />}
                    <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder={formType === 'percentage' ? '10' : '50000'} className={cn("w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all", formType === 'nominal' && 'pl-10')} />
                    {formType === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">%</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Min. Belanja</label>
                  <input type="number" value={formMinPurchase} onChange={e => setFormMinPurchase(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Maks. Diskon</label>
                  <input type="number" value={formMaxDiscount} onChange={e => setFormMaxDiscount(e.target.value)} placeholder="0 (tanpa batas)" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batas Pakai</label>
                  <input type="number" value={formUsageLimit} onChange={e => setFormUsageLimit(e.target.value)} placeholder="0 (tanpa batas)" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Berlaku Dari</label>
                  <input type="date" value={formValidFrom} onChange={e => setFormValidFrom(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Berlaku Sampai</label>
                  <input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-sm transition-all active:scale-95">Batal</button>
                <button type="submit" disabled={formSaving} className="flex-1 bg-[#10B981] hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-green-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                  {formSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                  {formSaving ? 'Menyimpan...' : (editingDiscount ? 'Simpan' : 'Tambah')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountPage;