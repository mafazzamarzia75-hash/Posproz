/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { indexdbUser } from '@/lib/indexdbUser';

interface ItemData {
  id: string;
  quantity: number;
  price: number;
  priceField: 'priceRetail' | 'priceWholesale';
}

interface Props {
  item: any;
  isWholesaleMode: boolean;
  onClose: () => void;
  onSave?: (data: ItemData) => void;
}

const ManualEditModal: React.FC<Props> = ({ item, isWholesaleMode, onClose, onSave }) => {
  const { updateManualPrice, updateManualQty } = useCartStore();
  // ✅ String state untuk input — boleh kosong sementara
  const initialPrice = item.customPrice !== undefined ? item.customPrice : (isWholesaleMode ? item.priceWholesale : item.priceRetail);
  const [priceStr, setPriceStr] = useState(String(initialPrice));
  const [qtyStr, setQtyStr] = useState(String(item.quantity));
  const isAdminUser = indexdbUser.isAdmin();

  const handleSave = () => {
    const finalPrice = Number(priceStr) || 0;
    const finalQty = Number(qtyStr) || 0;
    if (isAdminUser) {
      updateManualPrice(item.id, finalPrice);
    }
    updateManualQty(item.id, finalQty);
    const priceField = isWholesaleMode ? 'priceWholesale' : 'priceRetail';
    onSave?.({
      id: item.id,
      quantity: finalQty,
      price: isAdminUser ? finalPrice : (item.customPrice || item.priceRetail),
      priceField
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white p-8 rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="mb-8 text-center lg:text-left">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Override Manual</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Barang: {item.name}</p>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Harga Satuan (Rp)</label>
            <input 
              type="text"
              inputMode="numeric"
              value={priceStr}
              disabled={!isAdminUser}
              onChange={(e) => {
                // ✅ Hanya izinkan digit
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setPriceStr(val);
                }
              }}
              onBlur={() => {
                // ✅ Fallback ke "0" saat input ditinggalkan kosong
                if (priceStr === '') setPriceStr('0');
              }}
              onFocus={(e) => e.target.select()}
              className={`w-full border-2 border-slate-50 bg-slate-50 p-4 rounded-2xl focus:bg-white focus:border-[#10B981] outline-none transition-all text-lg font-black text-[#10B981] shadow-inner ${!isAdminUser ? 'cursor-not-allowed opacity-60 bg-slate-200' : ''}`}
              autoFocus={isAdminUser}
            />
            {!isAdminUser && (
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-tight px-1">
                * Kasir pegawai tidak diizinkan mengubah harga barang
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Jumlah Item (Quantity)</label>
            <div className="flex items-center gap-4 bg-slate-50 border-2 border-slate-50 rounded-2xl p-2 shadow-inner">
               <button 
                onClick={() => setQtyStr(String(Math.max(1, (Number(qtyStr) || 1) - 1)))}
                className="w-12 h-12 bg-white shadow-sm rounded-xl font-black text-slate-400 hover:text-[#10B981] transition-all border border-slate-100 active:scale-90"
               >-</button>
               <input 
                type="text"
                inputMode="numeric"
                value={qtyStr}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setQtyStr(val);
                  }
                }}
                onBlur={() => {
                  if (qtyStr === '' || Number(qtyStr) < 1) setQtyStr('1');
                }}
                className="flex-1 bg-transparent text-center font-black text-slate-800 text-xl outline-none"
                autoFocus={!isAdminUser}
              />
              <button 
                onClick={() => setQtyStr(String((Number(qtyStr) || 0) + 1))}
                className="w-12 h-12 bg-white shadow-sm rounded-xl font-black text-slate-400 hover:text-[#10B981] transition-all border border-slate-100 active:scale-90"
               >+</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-10">
          <button 
            onClick={handleSave} 
            className="w-full py-5 bg-[#10B981] hover:bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-green-100 transition-all active:scale-95 uppercase tracking-tight"
          >
            Terapkan Perubahan
          </button>
          <button 
            onClick={onClose} 
            className="w-full py-4 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-all"
          >
            Batalkan
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualEditModal;