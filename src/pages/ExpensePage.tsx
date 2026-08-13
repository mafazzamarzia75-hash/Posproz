/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Halaman Manajemen Biaya/Pengeluaran (Expenses)
 * Fitur: Tambah, Edit, Hapus, Cari, Filter Kategori & Tanggal
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit3, RefreshCw, AlertCircle, X, CheckCircle2, DollarSign, Calendar, Filter, TrendingDown, Wallet, ReceiptText } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { indexdbExpense, Expense, EXPENSE_CATEGORIES } from '@/lib/indexdbExpense';

const ExpensePage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [totalByCategory, setTotalByCategory] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState(0);

  // ✅ Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Listrik');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      let data: Expense[];
      
      if (search.trim()) {
        data = await indexdbExpense.search(search);
      } else {
        data = await indexdbExpense.getAll();
      }

      // ✅ Filter berdasarkan kategori
      if (filterCategory !== 'Semua') {
        data = data.filter(e => e.category === filterCategory);
      }

      setExpenses(data);

      // ✅ Hitung total per kategori & grand total
      const totals = await indexdbExpense.getTotalByCategory();
      setTotalByCategory(totals);
      
      const all = await indexdbExpense.getAll();
      setGrandTotal(all.reduce((sum, e) => sum + e.amount, 0));
    } catch (e) {
      console.error('Load expenses error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterCategory]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormCategory('Listrik');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormError('');
    setEditingExpense(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormName(expense.name);
    setFormAmount(expense.amount.toString());
    setFormCategory(expense.category);
    setFormDate(new Date(expense.date).toISOString().split('T')[0]);
    setFormNotes(expense.notes || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return; // 🔴 Cegah double submit

    if (!formName.trim()) {
      setFormError('Nama biaya wajib diisi');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      setFormError('Jumlah biaya harus lebih dari 0');
      return;
    }

    setFormSaving(true);
    try {
      const now = Date.now();
      const expenseDate = new Date(formDate).getTime();

      const expense: Expense = {
        id: editingExpense?.id || indexdbExpense.generateId(),
        name: formName.trim(),
        amount: Number(formAmount),
        category: formCategory,
        date: expenseDate,
        notes: formNotes.trim(),
        created_at: editingExpense?.created_at || now,
        updated_at: now,
      };

      await indexdbExpense.save(expense);
      setShowModal(false);
      resetForm();
      await loadExpenses();
    } catch (e) {
      console.error('Save expense error:', e);
      setFormError('Gagal menyimpan biaya');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus biaya ini? Data tidak dapat dikembalikan.')) return;
    try {
      await indexdbExpense.delete(id);
      await loadExpenses();
    } catch (e) {
      console.error('Delete expense error:', e);
      alert('Gagal menghapus biaya. Silakan coba lagi.');
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Biaya</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola pengeluaran operasional toko</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Total Pengeluaran: <span className="text-red-500">{formatCurrency(grandTotal)}</span>
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#10B981] hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          Tambah Biaya
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari biaya..."
            className="w-full bg-white border border-slate-100 pl-12 pr-4 py-4 rounded-[24px] font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-white border border-slate-100 rounded-[24px] px-5 py-4 pr-12 text-sm font-bold text-slate-700 appearance-none cursor-pointer focus:ring-2 focus:ring-[#10B981] outline-none transition-all shadow-sm"
          >
            <option value="Semua">Semua Kategori</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Filter size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Ringkasan per Kategori */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(totalByCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([category, total]) => (
            <div
              key={category}
              onClick={() => setFilterCategory(filterCategory === category ? 'Semua' : category)}
              className={cn(
                "bg-white p-4 rounded-2xl border shadow-sm cursor-pointer transition-all active:scale-95",
                filterCategory === category ? 'border-[#10B981] bg-emerald-50' : 'border-slate-100 hover:border-slate-200'
              )}
            >
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</p>
              <p className="text-sm font-black text-slate-700 mt-1">{formatCurrency(total)}</p>
            </div>
          ))}
      </div>

      {/* Expense List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-slate-300" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-slate-300">
          <Wallet size={64} className="opacity-20 mb-6" />
          <p className="text-lg font-black text-slate-400 mb-2">
            {search.trim() || filterCategory !== 'Semua' ? 'Biaya tidak ditemukan' : 'Belum ada biaya'}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center max-w-xs">
            {search.trim() ? 'Coba gunakan kata kunci lain' : 'Catat biaya operasional toko seperti listrik, sewa, gaji'}
          </p>
          {!search.trim() && filterCategory === 'Semua' && (
            <button onClick={openAddModal} className="mt-6 bg-[#10B981] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95 hover:bg-emerald-600">
              <Plus size={18} />
              Catat Biaya Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                  <TrendingDown size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-800 truncate">{expense.name}</h3>
                    <span className="px-2 py-0.5 bg-slate-50 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                      {expense.category}
                    </span>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-red-500">
                      <DollarSign size={12} className="shrink-0" />
                      <span className="font-black">{formatCurrency(expense.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar size={12} className="shrink-0" />
                      <span className="font-medium">{formatDate(expense.date)}</span>
                    </div>
                    {expense.notes && (
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <ReceiptText size={12} className="shrink-0 mt-0.5" />
                        <span className="font-medium line-clamp-1">{expense.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(expense)}
                    className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90"
                    title="Edit"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total Count */}
      {!isLoading && expenses.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {expenses.length} biaya tercatat
          </p>
        </div>
      )}

      {/* ✅ MODAL TAMBAH/EDIT BIAYA */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {editingExpense ? 'Edit Biaya' : 'Tambah Biaya'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-[16px] flex items-center gap-3">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-600">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Nama Biaya <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Misal: Pembayaran listrik bulan ini"
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tanggal</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan tambahan (opsional)"
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-sm transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 bg-[#10B981] hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formSaving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  {formSaving ? 'Menyimpan...' : (editingExpense ? 'Simpan Perubahan' : 'Tambah Biaya')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensePage;