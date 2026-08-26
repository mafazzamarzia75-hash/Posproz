/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { printerService } from '@/services/hardware/PrinterService';
import { formatCurrency, cn, getEffectiveItemPrice } from '@/lib/utils';
import { X, CreditCard, Banknote, Receipt, CheckCircle2, ChevronRight, Edit3, Trash2, Users, Search, Percent, Tag, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ManualEditModal from './ManualEditModal';
import { indexdbCustomer, Customer } from '@/lib/indexdbCustomer';
import { indexdbDiscount, ActiveDiscount } from '@/lib/indexdbDiscount';
import { indexdbDebt } from '@/lib/indexdbDebt';
import { generateUUID } from '@/lib/uuidGenerator';

interface Props {
  onClose: () => void;
  onConfirm: (customerName: string, paymentMethod?: 'cash' | 'debt', paidAmount?: number, subtotal?: number, discountAmount?: number) => void;
  onManualPriceSave?: (data: { id: string; quantity: number; price: number; priceField: 'priceRetail' | 'priceWholesale'; }) => void;
}

const CheckoutModal: React.FC<Props> = ({ onClose, onConfirm, onManualPriceSave }) => {
  const { cart, getTotal, clearCart, removeFromCart } = useCartStore();
  const { isWholesaleMode } = useSettingsStore();
  const [cashAmount, setCashAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debt'>('cash');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [step, setStep] = useState<'review' | 'payment' | 'success'>('review');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [activeDiscount, setActiveDiscount] = useState<ActiveDiscount | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const accent = isWholesaleMode ? 'orange' : 'emerald';
  const accentHex = isWholesaleMode ? '#F97316' : '#10B981';

  const rawTotal = getTotal();
  const discountAmount = activeDiscount?.value || 0;
  const total = Math.max(0, rawTotal - discountAmount);
  const cash = Number(cashAmount) || 0;
  const change = cash - total;

  useEffect(() => {
    if (step === 'payment' && !cashAmount) {
      // setCashAmount(total.toString());
    }
  }, [step]);

  // ✅ Cari customer untuk auto-fill
  useEffect(() => {
    if (!customerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const results = await indexdbCustomer.search(customerSearch);
        setSearchResults(results.slice(0, 6));
      } catch (e) {
        console.error('Search customer error:', e);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // ✅ Handler validasi & aplikasi kode diskon
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    setDiscountError('');
    try {
      const result = await indexdbDiscount.validateCode(discountCode, rawTotal);
      if (result.valid && result.discount) {
        setActiveDiscount(result.discount);
        setDiscountError('');
      } else {
        setActiveDiscount(null);
        setDiscountError(result.error || 'Kode tidak valid');
      }
    } catch (e) {
      console.error('Discount validate error:', e);
      setDiscountError('Gagal validasi kode');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setActiveDiscount(null);
    setDiscountCode('');
    setDiscountError('');
  };

  // ✅ Auto-focus search input ketika modal customer search terbuka
  useEffect(() => {
    if (showCustomerSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showCustomerSearch]);

  // ✅ Auto-simpan atau update customer & increment usage diskon saat transaksi selesai
  const handleFinish = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const name = customerName.trim();
      let finalCustomerId = '';

      // ✅ 1. Simpan/update customer jika ada nama
      if (name) {
        try {
          const all = await indexdbCustomer.getAll();
          const existing = all.find(c =>
            c.name.toLowerCase() === name.toLowerCase() ||
            (customerPhone && c.phone === customerPhone)
          );

          if (existing) {
            await indexdbCustomer.updateStats(existing.id, getTotal());
            finalCustomerId = existing.id;
          } else {
            const now = Date.now();
            const newId = `cust_${customerPhone || generateUUID().slice(0, 8)}`;
            const newCustomer: Customer = {
              id: newId,
              name: name,
              phone: customerPhone || '',
              address: '',
              notes: '',
              totalSpent: getTotal(),
              totalTransactions: 1,
              lastTransaction: now,
              created_at: now,
              updated_at: now,
            };
            await indexdbCustomer.save(newCustomer);
            finalCustomerId = newId;
          }
        } catch (e) {
          console.error('Save customer from checkout error:', e);
        }
      }

      // ✅ 2. Jika Metode Pembayaran adalah "Piutang", catat di Debt Service
      if (paymentMethod === 'debt' && name) {
        const remainingAmount = total - Number(cashAmount || 0);
        if (remainingAmount > 0) {
          try {
            await indexdbDebt.save({
              id: indexdbDebt.generateId(),
              type: 'receivable',
              customerId: finalCustomerId || null,
              customerName: name,
              supplierId: null,
              supplierName: '',
              amount: total,
              paidAmount: Number(cashAmount || 0),
              description: `Belanja POS - sisa tempo Rp ${remainingAmount}`,
              dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // Default 7 hari jatuh tempo
              status: Number(cashAmount || 0) > 0 ? 'partial' : 'unpaid',
              created_at: Date.now(),
              updated_at: Date.now()
            });
            console.log("🟢 [Checkout]: Berhasil mencatat piutang baru untuk pelanggan:", name);
          } catch (err) {
            console.error("Gagal menyimpan data piutang ke database:", err);
          }
        }
      }

      // ✅ 3. Teruskan Konfirmasi Transaksi POS ke Parent Page dengan subtotal & discountAmount
      await onConfirm(
        customerName,
        paymentMethod,
        paymentMethod === 'debt' ? Number(cashAmount || 0) : total,
        rawTotal,
        discountAmount
      );

      // ✅ 4. Increment pemakaian kode diskon
      if (activeDiscount) {
        try {
          await indexdbDiscount.incrementUsage(activeDiscount.discountId);
        } catch (e) {
          console.error('Increment discount usage error:', e);
        }
      }

      setStep('success');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      clearCart();
    }
    onClose();
  };

  const commonAmounts = [10000, 20000, 50000, 100000, 200000];

  const handlePrint = () => {
    const { storeInfo } = useSettingsStore.getState();
    const paidAmount = Number.isFinite(cash) ? cash : 0;
    const changeAmount = Number.isFinite(change) ? Math.max(change, 0) : 0;
    
    printerService.printReceipt({
      title: storeInfo.name,
      address: storeInfo.address,
      phone: storeInfo.phone,
      customerName: customerName || 'Pelanggan Umum',
      items: cart.map(item => ({
        name: item.name + (Number(item.pricePromo) > 0 && !item.customPrice ? ' (PROMO)' : ''),
        price: getEffectiveItemPrice(item, isWholesaleMode),
        quantity: item.quantity
      })),
      subtotal: rawTotal,
      discountAmount: discountAmount,
      total: total,
      cashAmount: paidAmount,
      changeAmount,
      footer: storeInfo.footer
    });
  };

  const btnPrimary = (extra = '') =>
    isWholesaleMode
      ? `bg-orange-500 hover:bg-orange-600 shadow-orange-100 ${extra}`
      : `bg-[#10B981] hover:bg-emerald-600 shadow-green-100 ${extra}`;

  const badgeBg = isWholesaleMode ? 'bg-orange-50' : 'bg-emerald-50';
  const badgeText = isWholesaleMode ? 'text-orange-600' : 'text-emerald-600';
  const borderFocus = isWholesaleMode ? 'focus:border-orange-500' : 'focus:border-[#10B981]';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {step === 'review' ? 'Review Pesanan' : step === 'payment' ? 'Pembayaran' : 'Berhasil!'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              PROSES TRANSAKSI KASIR
            </p>
          </div>
          <button onClick={handleClose} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {step === 'review' && (
            <div className="space-y-6">
               {/* ✅ Input Nama Pelanggan + Pencarian */}
               <div className="space-y-2 relative">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Pelanggan (Opsi)</label>
                   <div className="relative">
                     <input 
                       type="text" 
                       value={customerName}
                       onChange={(e) => {
                         setCustomerName(e.target.value);
                         setCustomerSearch(e.target.value);
                         setShowCustomerSearch(true);
                       }}
                       onFocus={() => { if (customerName) setShowCustomerSearch(true); }}
                       placeholder="Masukkan nama pelanggan..."
                       className={`w-full bg-slate-50 p-4 rounded-[20px] border-2 border-slate-100 ${borderFocus} outline-none transition-all font-bold text-slate-700`}
                     />
                     <button 
                       type="button"
                       onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                       className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#10B981] transition-colors"
                     >
                       <Users size={18} />
                     </button>
                   </div>
                   
                   {/* ✅ Hasil pencarian customer */}
                   {showCustomerSearch && customerSearch.trim() && (
                     <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                       {customerSearchLoading ? (
                         <div className="p-4 text-center text-xs font-bold text-slate-400">Mencari...</div>
                       ) : searchResults.length > 0 ? (
                         searchResults.map(c => (
                           <button
                             key={c.id}
                             type="button"
                             onClick={() => {
                               setCustomerName(c.name);
                               setCustomerPhone(c.phone || '');
                               setCustomerSearch(c.name);
                               setShowCustomerSearch(false);
                             }}
                             className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                           >
                             <div className="font-bold text-sm text-slate-700">{c.name}</div>
                             <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                               {c.phone && <span>📞 {c.phone}</span>}
                               <span>🛒 {c.totalTransactions} transaksi</span>
                               <span>💰 {formatCurrency(c.totalSpent)}</span>
                             </div>
                           </button>
                         ))
                       ) : (
                         <div className="p-4 text-center text-xs font-bold text-slate-400">
                           {customerSearch.trim().length > 0 ? 'Pelanggan baru (akan tersimpan otomatis)' : 'Ketik nama untuk mencari'}
                         </div>
                       )}
                     </div>
                   )}
                  
                   {/* ✅ Input Telepon (untuk customer baru) */}
                   <input 
                     type="text" 
                     value={customerPhone}
                     onChange={(e) => setCustomerPhone(e.target.value)}
                     placeholder="Nomor telepon (opsional)"
                     className={`w-full bg-slate-50 p-3 rounded-[16px] border border-slate-100 ${borderFocus} outline-none transition-all font-bold text-sm text-slate-600 mt-2`}
                   />
                </div>

               {/* ✅ Input Kode Diskon */}
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Kode Diskon (Opsi)</label>
                 <div className="flex gap-2">
                   <div className="relative flex-1">
                     <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                     <input 
                       type="text" 
                       value={discountCode}
                       onChange={(e) => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(''); }}
                       onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDiscount(); }}
                       placeholder="Masukkan kode diskon..."
                       className={`w-full bg-slate-50 p-4 pl-10 rounded-[20px] border-2 border-slate-100 ${borderFocus} outline-none transition-all font-bold text-slate-700 uppercase`}
                       disabled={!!activeDiscount}
                     />
                   </div>
                   {activeDiscount ? (
                     <button
                       onClick={handleRemoveDiscount}
                       className="px-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs hover:bg-red-100 transition-all active:scale-95 whitespace-nowrap"
                     >
                       Hapus
                     </button>
                   ) : (
                     <button
                       onClick={handleApplyDiscount}
                       disabled={discountLoading || !discountCode.trim()}
                       className={`px-6 py-4 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm transition-all active:scale-95 ${btnPrimary()}`}
                     >
                       {discountLoading ? (
                         <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                       ) : (
                         'Pakai'
                       )}
                     </button>
                   )}
                 </div>
                 {discountError && (
                   <p className="text-[10px] font-bold text-red-500 px-1">{discountError}</p>
                 )}
                 {activeDiscount && (
                   <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Percent size={14} className="text-emerald-500" />
                       <span className="text-xs font-black text-emerald-600">{activeDiscount.name}</span>
                     </div>
                     <span className="text-xs font-black text-emerald-600">-{formatCurrency(activeDiscount.value)}</span>
                   </div>
                 )}
               </div>

               <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl group border border-transparent hover:border-slate-200 transition-all">
                      <div className="flex-1 min-w-0 pr-4">
                         <p className="font-black text-slate-800 text-sm truncate uppercase">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                             {item.quantity} x {formatCurrency(getEffectiveItemPrice(item, isWholesaleMode))}
                             {Number(item.pricePromo) > 0 && !item.customPrice && (
                               <span className="text-rose-500 ml-1">Promo</span>
                             )}
                          </p>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="text-right mr-2">
                             <p className="font-black text-slate-700 text-sm">
                                {formatCurrency(getEffectiveItemPrice(item, isWholesaleMode) * item.quantity)}
                             </p>
                         </div>
                         <button 
                           onClick={() => setEditingItem(item)}
                           className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
                         >
                           <Edit3 size={16} />
                         </button>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-6">
               {/* 💳 TOGGLE METODE PEMBAYARAN */}
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Metode Pembayaran</label>
                 <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1.5 rounded-2xl">
                   <button
                     type="button"
                     onClick={() => {
                       setPaymentMethod('cash');
                       setCashAmount('');
                     }}
                     className={cn(
                       "py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all uppercase tracking-wider",
                       paymentMethod === 'cash'
                         ? (isWholesaleMode ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "bg-[#10B981] text-white shadow-md shadow-emerald-500/20")
                         : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                     )}
                   >
                     <Banknote size={16} /> Tunai (Cash)
                   </button>
                   <button
                     type="button"
                     disabled={!customerName.trim()}
                     onClick={() => {
                       if (customerName.trim()) {
                         setPaymentMethod('debt');
                         setCashAmount('');
                       }
                     }}
                     className={cn(
                       "py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all uppercase tracking-wider",
                       paymentMethod === 'debt'
                         ? "bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20"
                         : "text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                     )}
                     title={!customerName.trim() ? "Pilih/Isi nama pelanggan di step review untuk menggunakan piutang." : ""}
                   >
                     <Wallet size={16} /> Piutang (Tempo)
                   </button>
                 </div>
                 {!customerName.trim() && (
                   <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-[10px] uppercase font-bold border border-amber-100/50 flex items-center gap-2">
                     ⚠️ Masukkan nama pelanggan terlebih dahulu untuk memicu opsi Piutang.
                   </div>
                 )}
               </div>

               <div className={cn(
                 "p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden transition-all duration-300",
                 paymentMethod === 'debt' 
                   ? "bg-fuchsia-600 shadow-fuchsia-100" 
                   : (isWholesaleMode ? "bg-orange-500 shadow-orange-100" : "bg-[#10B981] shadow-green-100")
               )}>
                  <Banknote className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 text-center lg:text-left">Tagihan Total</p>
                  <h4 className="text-4xl font-black tracking-tighter text-center lg:text-left">{formatCurrency(total)}</h4>
               </div>

               {paymentMethod === 'cash' ? (
                 <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Uang Tunai Diterima (Rp)</label>
                      <input 
                        type="number" 
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="Masukkan jumlah uang..."
                        className={`w-full bg-slate-50 p-6 rounded-[24px] border-2 border-slate-100 ${borderFocus} outline-none transition-all text-3xl font-black text-slate-800 placeholder:text-slate-200`}
                        autoFocus
                      />
                   </div>

                   <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {commonAmounts.map(amt => (
                        <button 
                          key={amt}
                          type="button"
                          onClick={() => setCashAmount(amt.toString())}
                          className={cn(
                            "py-3 px-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black transition-all active:scale-95",
                            isWholesaleMode
                              ? "text-slate-500 hover:border-orange-400 hover:text-orange-500"
                              : "text-slate-500 hover:border-[#10B981] hover:text-[#10B981]"
                          )}
                        >
                          {amt >= 1000 ? `${amt/1000}rb` : amt}
                        </button>
                      ))}
                      <button 
                        type="button"
                        onClick={() => setCashAmount(total.toString())}
                        className={cn(
                          "py-3 px-2 rounded-xl text-[10px] font-black transition-all active:scale-95",
                          isWholesaleMode
                            ? "bg-orange-50 border border-orange-100 text-orange-600 hover:bg-orange-100"
                            : "bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                        )}
                      >
                        Uang Pas
                      </button>
                   </div>

                   {cash > 0 && (
                     <div className={cn(
                       "p-6 rounded-[24px] border-2 flex justify-between items-center animate-in slide-in-from-top-4 duration-500",
                       change < 0 ? "bg-red-50 border-red-100 text-red-600" : "bg-blue-50 border-blue-100 text-blue-600"
                     )}>
                        <span className="font-black text-xs uppercase tracking-widest">
                           {change < 0 ? 'Kurang Bayar' : 'Uang Kembalian'}
                        </span>
                        <span className="text-2xl font-black tracking-tighter">
                           {formatCurrency(Math.abs(change))}
                        </span>
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Uang Muka / DP Tunai (Rp) - Opsional</label>
                     <input 
                       type="number" 
                       value={cashAmount}
                       onChange={(e) => setCashAmount(e.target.value)}
                       placeholder="Masukkan jumlah DP jika ada..."
                       className="w-full bg-slate-50 p-6 rounded-[24px] border-2 border-slate-100 focus:border-fuchsia-500 outline-none transition-all text-3xl font-black text-slate-800 placeholder:text-slate-200"
                       autoFocus
                     />
                   </div>

                   <div className="p-6 rounded-[24px] bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-700 flex justify-between items-center">
                     <span className="font-black text-xs uppercase tracking-widest">Sisa Piutang Pelanggan</span>
                     <span className="text-2xl font-black tracking-tighter">
                       {formatCurrency(Math.max(0, total - cash))}
                     </span>
                   </div>
                 </div>
               )}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in zoom-in-95 duration-500">
               <div className={cn(
                 "w-24 h-24 rounded-[32px] flex items-center justify-center shadow-inner",
                 isWholesaleMode ? "bg-orange-50 text-orange-500" : "bg-emerald-50 text-[#10B981]"
               )}>
                  <CheckCircle2 size={48} strokeWidth={3} />
               </div>
               <div>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight">Transaksi Berhasil!</h4>
                  <p className="text-sm text-slate-400 font-medium mt-2">Struk belanja sedang dikirim ke printer...</p>
               </div>
               <div className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                     <span>Metode</span>
                     <span className={cn("font-extrabold uppercase", paymentMethod === 'debt' ? "text-fuchsia-600" : "text-slate-800")}>{paymentMethod === 'debt' ? 'Piutang (Tempo)' : 'Tunai'}</span>
                  </div>
                   {paymentMethod === 'debt' && (
                     <>
                       <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest my-2">
                         <span>DP Bayar</span>
                         <span className="text-slate-700 font-bold">{formatCurrency(cash)}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest my-2">
                         <span>Sisa Tempo</span>
                         <span className="text-fuchsia-600 font-bold">{formatCurrency(Math.max(0, total - cash))}</span>
                       </div>
                       <div className="border-t border-slate-200/50 my-3"></div>
                     </>
                   )}
                   <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                     <span>Total</span>
                     <span className="text-xl font-black text-slate-800 tracking-tighter">{formatCurrency(total)}</span>
                   </div>
               </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-50 gap-4 flex flex-col">
          {step === 'review' && (
             <div className="space-y-4">
                {activeDiscount && (
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Subtotal</span>
                    <span className="text-lg font-black text-slate-400 line-through">{formatCurrency(rawTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-2">
                   <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Total</span>
                   <span className={cn(
                     "text-3xl font-black tracking-tighter",
                     isWholesaleMode ? "text-orange-500" : "text-[#10B981]"
                   )}>{formatCurrency(total)}</span>
                </div>
                <button 
                   onClick={() => setStep('payment')}
                   disabled={cart.length === 0}
                   className={`w-full py-5 text-white rounded-3xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed ${btnPrimary()}`}
                >
                   LANJUT KE PEMBAYARAN <ChevronRight size={20}/>
                </button>
             </div>
          )}

          {step === 'payment' && (
            <div className="flex gap-4">
               <button 
                 onClick={() => setStep('review')}
                 className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
               >
                 Kembali
               </button>
               <button 
                 disabled={isSubmitting || (paymentMethod === 'cash' && cash < total)}
                 onClick={handleFinish}
                 className={cn(
                   "flex-[2] py-5 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-3xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group",
                   paymentMethod === 'debt' 
                     ? "bg-fuchsia-600 hover:bg-fuchsia-700 shadow-fuchsia-100" 
                     : btnPrimary()
                 )}
               >
                 {isSubmitting ? (
                   <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : paymentMethod === 'debt' ? (
                   <>
                     <Wallet size={24}/> KONFIRMASI PIUTANG
                   </>
                 ) : (
                   <>
                     <Banknote size={24}/> KONFIRMASI BAYAR
                   </>
                 )}
               </button>
            </div>
          )}

          {step === 'success' && (
             <div className="flex flex-col gap-3">
               <button 
                 onClick={handlePrint}
                 className={cn(
                   "w-full py-5 text-white rounded-3xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group",
                   isWholesaleMode ? "bg-orange-500 hover:bg-orange-600 shadow-orange-100" : "bg-emerald-500 hover:bg-emerald-600 shadow-green-100"
                 )}
               >
                 <Receipt size={24}/> CETAK STRUK
               </button>
               <button 
                 onClick={handleClose}
                 className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl font-black text-lg shadow-xl transition-all active:scale-95"
               >
                 TRANSAKSI BARU
               </button>
             </div>
          )}
        </div>
      </motion.div>

      {editingItem && (
        <ManualEditModal 
          item={editingItem} 
          isWholesaleMode={isWholesaleMode}
          onClose={() => setEditingItem(null)} 
          onSave={onManualPriceSave}
        />
      )}
    </div>
  );
};

export default CheckoutModal;