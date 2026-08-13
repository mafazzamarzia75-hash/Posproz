/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Halaman Manajemen Supplier (Pemasok)
 * Fitur: Tambah, Edit, Hapus, Cari Supplier
 * Data disimpan di IndexedDB (offline-first)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit3, RefreshCw, Phone, MapPin, User, FileText, Package, ShoppingCart, AlertCircle, X, CheckCircle2, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { indexdbSupplier, Supplier } from '@/lib/indexdbSupplier';
import { generateUUID } from '@/lib/uuidGenerator';

const SupplierPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // ✅ Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formNpwp, setFormNpwp] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadSuppliers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = search.trim()
        ? await indexdbSupplier.search(search)
        : await indexdbSupplier.getAll();
      setSuppliers(data);
    } catch (e) {
      console.error('Load supplier error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // ✅ Debounce search
  useEffect(() => {
    const timer = setTimeout(() => loadSuppliers(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormContact('');
    setFormNpwp('');
    setFormNotes('');
    setFormError('');
    setEditingSupplier(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormPhone(supplier.phone || '');
    setFormAddress(supplier.address || '');
    setFormContact(supplier.contactPerson || '');
    setFormNpwp(supplier.npwp || '');
    setFormNotes(supplier.notes || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return; // 🔴 Cegah double submit

    if (!formName.trim()) {
      setFormError('Nama supplier wajib diisi');
      return;
    }

    setFormSaving(true);
    try {
      const now = Date.now();
      const supplier: Supplier = {
        id: editingSupplier?.id || `sup_${formPhone.trim() || generateUUID().slice(0, 8)}`,
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        contactPerson: formContact.trim(),
        npwp: formNpwp.trim(),
        notes: formNotes.trim(),
        productCount: editingSupplier?.productCount || 0,
        totalPurchases: editingSupplier?.totalPurchases || 0,
        created_at: editingSupplier?.created_at || now,
        updated_at: now,
      };

      await indexdbSupplier.save(supplier);
      setShowModal(false);
      resetForm();
      await loadSuppliers();
    } catch (e) {
      console.error('Save supplier error:', e);
      setFormError('Gagal menyimpan supplier');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus supplier ini? Data tidak dapat dikembalikan.')) return;
    try {
      await indexdbSupplier.delete(id);
      await loadSuppliers();
    } catch (e) {
      console.error('Delete supplier error:', e);
      alert('Gagal menghapus supplier. Silakan coba lagi.');
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Supplier</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola data pemasok barang</p>
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
          placeholder="Cari supplier berdasarkan nama, telepon, NPWP, atau kontak..."
          className="w-full bg-white border border-slate-100 pl-12 pr-4 py-4 rounded-[24px] font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Supplier List / Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-slate-300" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-slate-300">
          <Package size={64} className="opacity-20 mb-6" />
          <p className="text-lg font-black text-slate-400 mb-2">
            {search.trim() ? 'Supplier tidak ditemukan' : 'Belum ada supplier'}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center max-w-xs">
            {search.trim()
              ? 'Coba gunakan kata kunci lain'
              : 'Tambahkan supplier pertama untuk mulai mencatat pemasok barang'}
          </p>
          {!search.trim() && (
            <button
              onClick={openAddModal}
              className="mt-6 bg-[#10B981] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center gap-2 active:scale-95 hover:bg-emerald-600"
            >
              <Plus size={18} />
              Tambah Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Avatar Initials */}
                <div className="w-12 h-12 bg-[#10B981]/10 rounded-2xl flex items-center justify-center text-[#10B981] font-black text-sm shrink-0">
                  {getInitials(supplier.name)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base text-slate-800 truncate">{supplier.name}</h3>
                  
                  <div className="mt-2 space-y-1">
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={12} className="shrink-0" />
                        <span className="font-medium">{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <User size={12} className="shrink-0" />
                        <span className="font-medium">{supplier.contactPerson}</span>
                      </div>
                    )}
                    {supplier.npwp && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Receipt size={12} className="shrink-0" />
                        <span className="font-medium font-mono">{supplier.npwp}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <MapPin size={12} className="shrink-0 mt-0.5" />
                        <span className="font-medium line-clamp-1">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Package size={10} />
                      {supplier.productCount} Produk
                    </span>
                    <span className="flex items-center gap-1">
                      <ShoppingCart size={10} />
                      {supplier.totalPurchases.toLocaleString('id-ID')} Pembelian
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(supplier)}
                    className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90"
                    title="Edit"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
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
      {!isLoading && suppliers.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Total {suppliers.length} supplier
          </p>
        </div>
      )}

      {/* ✅ MODAL TAMBAH/EDIT SUPPLIER */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
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
                  Nama Supplier <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nama pemasok"
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kontak Person</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    value={formContact}
                    onChange={e => setFormContact(e.target.value)}
                    placeholder="Nama sales / penanggung jawab"
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">NPWP</label>
                <div className="relative">
                  <Receipt size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    value={formNpwp}
                    onChange={e => setFormNpwp(e.target.value)}
                    placeholder="XX.XXX.XXX.X-XXX.XXX"
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
                    placeholder="Alamat lengkap supplier"
                    className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Catatan</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-4 top-4 text-slate-300" />
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
                  {formSaving ? 'Menyimpan...' : (editingSupplier ? 'Simpan Perubahan' : 'Tambah Supplier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPage;