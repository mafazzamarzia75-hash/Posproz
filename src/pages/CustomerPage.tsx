/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Halaman Manajemen Pelanggan (Customer)
 * Fitur: Tambah, Edit, Hapus, Cari, Lihat Riwayat Belanja
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit3, RefreshCw, Phone, MapPin, User, ShoppingBag, TrendingUp, Calendar, DollarSign, AlertCircle, X, CheckCircle2, Users, ReceiptText } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { indexdbCustomer, Customer } from '@/lib/indexdbCustomer';
import { generateUUID } from '@/lib/uuidGenerator';

const CustomerPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // ✅ Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = search.trim()
        ? await indexdbCustomer.search(search)
        : await indexdbCustomer.getAll();
      // ✅ Sort: yang terakhir transaksi di atas
      const sorted = data.sort((a, b) => (b.lastTransaction || 0) - (a.lastTransaction || 0));
      setCustomers(sorted);
    } catch (e) {
      console.error('Load customers error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormError('');
    setEditingCustomer(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone || '');
    setFormAddress(customer.address || '');
    setFormNotes(customer.notes || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return; // 🔴 Cegah double submit
    if (!formName.trim()) {
      setFormError('Nama pelanggan wajib diisi');
      return;
    }

    setFormSaving(true);
    try {
      const now = Date.now();
      const customer: Customer = {
        id: editingCustomer?.id || `cust_${formPhone.trim() || generateUUID().slice(0, 8)}`,
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
        totalSpent: editingCustomer?.totalSpent || 0,
        totalTransactions: editingCustomer?.totalTransactions || 0,
        lastTransaction: editingCustomer?.lastTransaction || null,
        created_at: editingCustomer?.created_at || now,
        updated_at: now,
      };

      await indexdbCustomer.save(customer);
      setShowModal(false);
      resetForm();
      await loadCustomers();
    } catch (e) {
      console.error('Save customer error:', e);
      setFormError('Gagal menyimpan pelanggan');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pelanggan ini? Data tidak dapat dikembalikan.')) return;
    try {
      await indexdbCustomer.delete(id);
      await loadCustomers();
    } catch (e) {
      console.error('Delete customer error:', e);
      alert('Gagal menghapus pelanggan. Silakan coba lagi.');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pelanggan</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola data pelanggan dan riwayat belanja</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#10B981] hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          Tambah
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari pelanggan berdasarkan nama atau telepon..."
          className="w-full bg-white border border-slate-100 pl-12 pr-4 py-4 rounded-[24px] font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-slate-300" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-slate-300">
          <Users size={64} className="opacity-20 mb-6" />
          <p className="text-lg font-black text-slate-400 mb-2">
            {search.trim() ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center max-w-xs">
            {search.trim() ? 'Coba gunakan kata kunci lain' : 'Tambahkan pelanggan pertama atau checkout dengan nama pelanggan'}
          </p>
          {!search.trim() && (
            <button onClick={openAddModal} className="mt-6 bg-[#10B981] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95 hover:bg-emerald-600">
              <Plus size={18} />
              Tambah Pelanggan
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => { setSelectedCustomer(customer); setShowDetail(true); }}
              className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center text-[#10B981] font-black text-sm shrink-0">
                  {getInitials(customer.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base text-slate-800 truncate">{customer.name}</h3>
                  
                  <div className="mt-2 space-y-1">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={12} className="shrink-0" />
                        <span className="font-medium">{customer.phone}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <MapPin size={12} className="shrink-0 mt-0.5" />
                        <span className="font-medium line-clamp-1">{customer.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <ShoppingBag size={10} />
                      {customer.totalTransactions} Transaksi
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={10} />
                      {formatCurrency(customer.totalSpent)}
                    </span>
                    {customer.lastTransaction && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Calendar size={10} />
                        {new Date(customer.lastTransaction).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(customer)}
                    className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90"
                    title="Edit"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
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
      {!isLoading && customers.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Total {customers.length} pelanggan
          </p>
        </div>
      )}

      {/* ✅ MODAL DETAIL PELANGGAN */}
      {showDetail && selectedCustomer && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center text-[#10B981] font-black text-lg">
                  {getInitials(selectedCustomer.name)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{selectedCustomer.name}</h3>
                  {selectedCustomer.phone && (
                    <p className="text-xs text-slate-400 font-bold">{selectedCustomer.phone}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-emerald-50/50 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Belanja</p>
                <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(selectedCustomer.totalSpent)}</p>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Transaksi</p>
                <p className="text-lg font-black text-blue-600 mt-1">{selectedCustomer.totalTransactions}</p>
              </div>
            </div>

            {selectedCustomer.address && (
              <div className="mb-4 p-4 bg-slate-50 rounded-2xl flex items-start gap-3">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs font-bold text-slate-600">{selectedCustomer.address}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
              <Calendar size={12} />
              <span>Terakhir belanja: {formatDate(selectedCustomer.lastTransaction)}</span>
            </div>

            {selectedCustomer.notes && (
              <div className="mb-6 p-4 bg-amber-50 rounded-2xl">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Catatan</p>
                <p className="text-xs font-bold text-amber-600">{selectedCustomer.notes}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDetail(false)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-sm transition-all active:scale-95"
              >
                Tutup
              </button>
              <button
                onClick={() => { setShowDetail(false); openEditModal(selectedCustomer); }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95"
              >
                <Edit3 size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL TAMBAH/EDIT PELANGGAN */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
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
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nama pelanggan"
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Telepon</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="0812-3456-7890"
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alamat</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-4 text-slate-300" />
                  <textarea
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    rows={2}
                    placeholder="Alamat pelanggan"
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan</label>
                <div className="relative">
                  <ReceiptText size={16} className="absolute left-4 top-4 text-slate-300" />
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan tambahan (opsional)"
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all resize-none"
                  />
                </div>
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
                  {formSaving ? 'Menyimpan...' : (editingCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPage;