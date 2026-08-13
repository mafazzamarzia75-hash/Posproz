/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cn } from '@/lib/utils';

export const PriceModeToggle = () => {
  const { isWholesaleMode, toggleWholesaleMode } = useSettingsStore();

  return (
    <div className={cn(
      "flex items-center gap-2 p-1.5 rounded-full border transition-all",
      isWholesaleMode ? "bg-orange-50 border-orange-200" : "bg-slate-100 border-slate-200"
    )}>
      <button 
        onClick={() => !isWholesaleMode ? null : toggleWholesaleMode()}
        className={cn(
          "px-5 py-1.5 rounded-full text-[10px] font-bold transition-all uppercase tracking-widest",
          !isWholesaleMode ? "bg-white shadow-sm text-indigo-600" : "text-orange-400 hover:text-orange-600"
        )}
      >
        Eceran
      </button>
      <button 
        onClick={() => isWholesaleMode ? null : toggleWholesaleMode()}
        className={cn(
          "px-5 py-1.5 rounded-full text-[10px] font-bold transition-all uppercase tracking-widest",
          isWholesaleMode ? "bg-white shadow-sm text-orange-500" : "text-slate-500 hover:text-slate-700"
        )}
      >
        Grosir
      </button>
    </div>
  );
};
