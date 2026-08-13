/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal cetak barcode & label massal dengan multi-select produk,
 * pengaturan ukuran label standar, preview grid, dan cetak 1x klik.
 * 
 * 🔴 PERBAIKAN:
 * - Harga promo otomatis terbaca dari `pricePromo` produk yang sudah tersimpan.
 * - Mode promo tersedia untuk SEMUA preset (barcode & label rak).
 * - UI dirombak: tab jenis label, preview lebih baik, dukungan berbagai printer.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, CheckSquare, Square, Settings2, ChevronDown, ChevronUp, Package, Search, Barcode, Tag, Sparkles, Store, AlertCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { barcodeService } from '@/services/hardware/BarcodeService';
import { useSettingsStore, LABEL_PRESETS, LabelPreset } from '@/store/useSettingsStore';
import { Product } from '@/interfaces';
import { indexdbBarang } from '@/lib/indexdbBarang';

interface Props {
  products: Product[];
  onClose: () => void;
}

// 🔴 Helper: ambil harga efektif — prioritas: custom promo > pricePromo tersimpan > priceRetail
const getProductDisplayPrice = (p: Product, usePromo: boolean, promoPrices: Record<string, number>): number => {
  if (usePromo) {
    // 1. Harga promo yang diinput manual di modal
    if (promoPrices[p.id] !== undefined && promoPrices[p.id] > 0) {
      return promoPrices[p.id];
    }
    // 2. Harga promo yang sudah tersimpan di database
    if (p.pricePromo && p.pricePromo > 0) {
      return p.pricePromo;
    }
  }
  return p.priceRetail;
};

export default function BarcodePrintModal({ products, onClose }: Props) {
  const { label: labelSettings, updateLabelSettings } = useSettingsStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copies, setCopies] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // 🔴 State untuk harga promo — otomatis terbaca dari pricePromo produk
  const [usePromo, setUsePromo] = useState(false);
  const [promoPrices, setPromoPrices] = useState<Record<string, number>>({});
  const [promoLabel, setPromoLabel] = useState('PROMO');
  const [promoValidUntil, setPromoValidUntil] = useState('');
  const [isSavingPromo, setIsSavingPromo] = useState(false);
  const [promoSaved, setPromoSaved] = useState(false);

  // 🔴 Tab jenis label: 'barcode' | 'shelf'
  const [labelType, setLabelType] = useState<'barcode' | 'shelf'>('barcode');

  // 🔴 Pilih preset pertama untuk tipe label yang aktif
  const getPresetForType = (type: 'barcode' | 'shelf'): LabelPreset => {
    const current = LABEL_PRESETS.find(p => p.id === labelSettings.activePreset);
    if (current && current.id.startsWith('shelf-') === (type === 'shelf')) {
      return current;
    }
    // Jika preset aktif tidak cocok tipe, pilih preset default untuk tipe tersebut
    if (type === 'shelf') {
      return LABEL_PRESETS.find(p => p.id === 'shelf-100x50') || LABEL_PRESETS[0];
    }
    return LABEL_PRESETS.find(p => p.id === '58x30') || LABEL_PRESETS[0];
  };

  const activePreset = getPresetForType(labelType);
  const isShelfLabel = labelType === 'shelf';

  // 🔴 Auto-detect: jika ada produk dengan pricePromo, aktifkan mode promo otomatis
  useEffect(() => {
    const hasPromoProduct = products.some(p => p.pricePromo && p.pricePromo > 0);
    if (hasPromoProduct) {
      setUsePromo(true);
    }
  }, [products]);

  // 🔴 Auto-fill promoPrices dari pricePromo yang sudah tersimpan
  useEffect(() => {
    const initial: Record<string, number> = {};
    products.forEach(p => {
      if (p.pricePromo && p.pricePromo > 0) {
        initial[p.id] = p.pricePromo;
      }
    });
    setPromoPrices(initial);
  }, [products]);

  // Filter produk berdasarkan pencarian
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase().trim();
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  // Select / Deselect semua
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProducts = products.filter(p => selectedIds.has(p.id));

  // Mengatur harga promo untuk produk tertentu
  const setPromoPrice = (productId: string, price: number) => {
    setPromoPrices(prev => ({ ...prev, [productId]: price }));
  };

  const getEffectivePrice = (p: Product): number => {
    return getProductDisplayPrice(p, usePromo, promoPrices);
  };

  const getOriginalPrice = (p: Product): number => {
    return p.priceRetail;
  };

  // Generate preview HTML
  const generatePreview = async () => {
    if (selectedProducts.length === 0) return;
    setIsPrinting(true);
    try {
      const html = await generatePrintHtml();
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (e) {
      console.error('Preview error:', e);
      alert('Gagal generate preview. Silakan coba lagi.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Generate print HTML dan langsung cetak
  const handlePrint = async () => {
    if (selectedProducts.length === 0) return;
    setIsPrinting(true);
    try {
      const html = await generatePrintHtml();
      const popup = window.open('', '_blank', 'width=500,height=600,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
      if (!popup) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => { iframe.contentWindow?.print(); }, 300);
          setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
        }
        return;
      }
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
    } catch (e) {
      console.error('Print error:', e);
      alert('Gagal mencetak. Periksa izin popup browser.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Generate HTML cetak lengkap dengan layout label
  const generatePrintHtml = async (): Promise<string> => {
    const preset = activePreset;
    const items: Array<{ 
      code: string; 
      productName: string; 
      price: number; 
      originalPrice?: number;
      promoLabel?: string;
      promoValidUntil?: string;
    }> = [];
    
    for (const p of selectedProducts) {
      const code = p.sku?.trim() || barcodeService.generateCode(p.name);
      for (let c = 0; c < copies; c++) {
        items.push({ 
          code, 
          productName: p.name, 
          price: getEffectivePrice(p),
          originalPrice: usePromo ? getOriginalPrice(p) : undefined,
          promoLabel: usePromo ? promoLabel : undefined,
          promoValidUntil: usePromo ? promoValidUntil : undefined,
        });
      }
    }

    // Generate setiap label
    const labelsHtml: string[] = [];
    for (const item of items) {
      const labelHtml = await generateSingleLabel(item, preset);
      labelsHtml.push(labelHtml);
    }

    // Layout grid atau single column
    const cols = preset.columns;
    let gridHtml = '';
    if (cols > 1) {
      const rows: string[] = [];
      for (let i = 0; i < labelsHtml.length; i += cols) {
        const rowItems = labelsHtml.slice(i, i + cols);
        rows.push(`<tr><td style="padding:0;">${rowItems.join(`</td><td style="padding:0;border-left:${labelSettings.gapMm}mm solid transparent;">`)}</td></tr>`);
      }
      gridHtml = `<table style="border-collapse:collapse;width:100%;">${rows.join('')}</table>`;
    } else {
      gridHtml = labelsHtml.join(`<div style="height:${labelSettings.gapMm}mm;"></div>`);
    }

    const labelWidthMm = preset.widthMm;
    const totalWidthMm = labelWidthMm * cols + labelSettings.gapMm * (cols - 1) + labelSettings.marginMm * 2;
    const pageWidth = Math.max(totalWidthMm, 58);

    return `<!DOCTYPE html>
<html><head><title>Cetak Label Barcode</title>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{margin:${labelSettings.marginMm}mm;}
html,body{margin:0;padding:0;background:white;width:${pageWidth}mm;}
body{font-family:'Courier New','Lucida Console',monospace;}
.label{width:${labelWidthMm}mm;height:${preset.heightMm}mm;overflow:hidden;padding:1mm 1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-inside:avoid;border:0.1mm dashed #ccc;}
.label-content{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
svg{width:100%!important;height:auto!important;max-width:100%;shape-rendering:crispEdges;}
.label-price{font-weight:900;color:#059669;margin-top:0.5mm;}
.label-price-original{font-weight:700;color:#94a3b8;text-decoration:line-through;font-size:80%;margin-top:0.3mm;}
.label-promo-badge{background:#ef4444;color:white;font-weight:900;padding:0.3mm 1.5mm;border-radius:0.5mm;font-size:60%;margin-bottom:0.5mm;display:inline-block;}
.label-name{font-weight:700;color:#1e293b;word-break:break-word;line-height:1.2;text-transform:uppercase;margin-top:0.5mm;}
.label-valid{font-size:50%;color:#94a3b8;margin-top:0.3mm;}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{padding:0;}.label{border:none;}}
</style></head>
<body>${gridHtml}
<script>
(function(){function doPrint(){try{window.focus();window.print();}catch(e){}}
window.onload=function(){setTimeout(doPrint,100);};
var mq=window.matchMedia('print');
mq.addListener(function(mql){if(!mql.matches){setTimeout(function(){window.close();},100);}});
})();
<\/script></body></html>`;
  };

  // Generate single label HTML (barcode + nama + harga + promo)
  const generateSingleLabel = async (item: { 
    code: string; 
    productName: string; 
    price: number;
    originalPrice?: number;
    promoLabel?: string;
    promoValidUntil?: string;
  }, preset: LabelPreset): Promise<string> => {
    const parts: string[] = [];

    // Badge promo jika ada
    if (item.promoLabel && item.originalPrice && item.originalPrice > item.price) {
      parts.push(`<div class="label-promo-badge">${item.promoLabel}</div>`);
    }

    if (preset.showBarcode) {
      try {
        const { default: JsBarcode } = await import('jsbarcode');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const barHeight = preset.heightMm * 1.5;
        const barWidth = Math.max(0.4, preset.widthMm / 80);
        JsBarcode(svg, item.code, {
          format: 'CODE128',
          width: barWidth,
          height: barHeight,
          displayValue: true,
          fontSize: Math.max(6, (preset.nameFontSize || 8) - 2),
          font: 'monospace',
          textMargin: 0.5,
          margin: 1,
          background: '#FFFFFF',
          lineColor: '#000000'
        });
        const svgMarkup = (svg as unknown as SVGSVGElement).outerHTML
          .replace(/width="[^"]*"/, '')
          .replace(/height="[^"]*"/, '');
        parts.push(`<div style="width:100%;overflow:hidden;">${svgMarkup}</div>`);
      } catch {
        parts.push(`<div style="font-size:8px;font-weight:bold;font-family:monospace;padding:2px 0;">${item.code}</div>`);
      }
    }

    if (preset.showName && item.productName) {
      parts.push(`<div class="label-name" style="font-size:${preset.nameFontSize || 7}px;">${item.productName.toUpperCase()}</div>`);
    }

    if (preset.showPrice && item.price > 0) {
      // Jika ada promo, tampilkan harga asli yang dicoret + harga promo
      if (item.originalPrice && item.originalPrice > item.price) {
        parts.push(`<div class="label-price-original" style="font-size:${(preset.priceFontSize || 9) * 0.8}px;">Rp ${item.originalPrice.toLocaleString('id-ID')}</div>`);
        parts.push(`<div class="label-price" style="font-size:${preset.priceFontSize || 9}px;color:#ef4444;">Rp ${item.price.toLocaleString('id-ID')}</div>`);
      } else {
        parts.push(`<div class="label-price" style="font-size:${preset.priceFontSize || 9}px;">Rp ${item.price.toLocaleString('id-ID')}</div>`);
      }
    }

    // Tampilkan masa berlaku promo
    if (item.promoValidUntil) {
      parts.push(`<div class="label-valid">Berlaku s/d ${item.promoValidUntil}</div>`);
    }

    return `<div class="label"><div class="label-content">${parts.join('')}</div></div>`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-md">
              <Printer size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Cetak Label</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {products.length} produk tersedia · {selectedProducts.length} terpilih
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* 🔴 TAB JENIS LABEL */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => { setLabelType('barcode'); updateLabelSettings({ activePreset: '58x30' }); }}
              className={cn(
                "py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all uppercase tracking-wider",
                labelType === 'barcode' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Barcode size={14} /> Label Barcode
            </button>
            <button
              onClick={() => { setLabelType('shelf'); updateLabelSettings({ activePreset: 'shelf-100x50' }); }}
              className={cn(
                "py-2.5 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all uppercase tracking-wider",
                labelType === 'shelf' ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Store size={14} /> Label Rak
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Pengaturan Cetak */}
          <div className="bg-slate-50/80 rounded-2xl p-4 space-y-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-slate-400" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Pengaturan Label</span>
              </div>
              {showSettings ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showSettings && (
              <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-200">
                {/* Preset ukuran — hanya untuk tipe label aktif */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Ukuran Label</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LABEL_PRESETS
                      .filter(p => p.id.startsWith('shelf-') === isShelfLabel)
                      .map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => updateLabelSettings({ activePreset: preset.id })}
                          className={cn(
                            "p-2.5 rounded-xl border-2 text-left transition-all",
                            labelSettings.activePreset === preset.id
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                          )}
                        >
                          <div className="font-black text-[10px] leading-tight">{preset.name}</div>
                          <div className="text-[8px] font-bold opacity-60 mt-0.5">
                            {preset.columns > 1 ? `${preset.columns} kolom` : 'Single'} · {preset.showPrice ? '+harga ' : ''}{preset.showName ? '+nama ' : ''}{preset.showBarcode ? '+barcode' : ''}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Gap & Margin */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Gap (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={labelSettings.gapMm}
                      onChange={e => updateLabelSettings({ gapMm: Number(e.target.value) })}
                      className="w-full bg-white border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm text-slate-700 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Margin Halaman (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={labelSettings.marginMm}
                      onChange={e => updateLabelSettings({ marginMm: Number(e.target.value) })}
                      className="w-full bg-white border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm text-slate-700 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Jumlah copy */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Jumlah Copy per Produk</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCopies(Math.max(1, copies - 1))} className="w-10 h-10 bg-white border border-slate-100 rounded-xl font-black text-slate-500 hover:bg-slate-50 transition-all">−</button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={copies}
                      onChange={e => setCopies(Math.max(1, Math.min(99, Number(e.target.value))))}
                      className="w-16 text-center bg-white border-2 border-slate-100 p-2.5 rounded-xl font-black text-sm text-slate-700 focus:border-blue-500 outline-none transition-all"
                    />
                    <button onClick={() => setCopies(Math.min(99, copies + 1))} className="w-10 h-10 bg-white border border-slate-100 rounded-xl font-black text-slate-500 hover:bg-slate-50 transition-all">+</button>
                  </div>
                </div>

                {/* 🔴 Mode Promo — tersedia untuk SEMUA tipe label */}
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-rose-500" />
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Mode Promo</span>
                    </div>
                    <button
                      onClick={() => setUsePromo(!usePromo)}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-all border-2",
                        usePromo ? "bg-rose-500 border-rose-500" : "bg-slate-100 border-slate-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                        usePromo ? "left-[26px]" : "left-0.5"
                      )} />
                    </button>
                  </div>

                  {usePromo && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Label Promo</label>
                        <input
                          type="text"
                          value={promoLabel}
                          onChange={e => setPromoLabel(e.target.value)}
                          placeholder="PROMO"
                          className="w-full bg-white border-2 border-slate-100 p-2.5 rounded-xl font-black text-sm text-rose-600 focus:border-rose-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Masa Berlaku (opsional)</label>
                        <input
                          type="text"
                          value={promoValidUntil}
                          onChange={e => setPromoValidUntil(e.target.value)}
                          placeholder="31 Des 2026"
                          className="w-full bg-white border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm text-slate-700 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pencarian produk */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari produk untuk dipilih..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 focus:border-blue-500 outline-none transition-all focus:shadow-sm"
            />
          </div>

          {/* Tombol Select All */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-all"
            >
              {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <CheckSquare size={16} className="text-blue-500" />
              ) : (
                <Square size={16} />
              )}
              {selectedIds.size === filteredProducts.length ? 'Unselect Semua' : 'Select Semua'}
            </button>
            <span className="text-[10px] font-bold text-slate-400">{filteredProducts.length} produk</span>
          </div>

          {/* Daftar produk */}
          <div className="space-y-1 max-h-60 overflow-y-auto border border-slate-100 rounded-2xl p-1">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  selectedIds.has(p.id) ? "bg-blue-50 border border-blue-100" : "border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleSelect(p.id)}
                    className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      selectedIds.has(p.id) ? "bg-blue-500 border-blue-500 text-white" : "border-slate-200"
                    )}
                  >
                    {selectedIds.has(p.id) && <CheckSquare size={12} strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-700 truncate uppercase">{p.name}</div>
                    <div className="text-[9px] text-slate-400 font-bold font-mono">#{p.sku || '-'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {usePromo && selectedIds.has(p.id) ? (
                      <div className="space-y-0.5">
                        <input
                          type="number"
                          value={promoPrices[p.id] || ''}
                          onChange={e => setPromoPrice(p.id, Number(e.target.value))}
                          placeholder="Harga promo"
                          className="w-20 text-right bg-rose-50 border border-rose-200 p-1 rounded-lg font-black text-xs text-rose-600 focus:border-rose-500 outline-none transition-all"
                        />
                        <div className="text-[8px] text-slate-400 font-bold line-through">{formatCurrency(p.priceRetail)}</div>
                      </div>
                    ) : (
                      <>
                        <div className="font-black text-xs text-emerald-600">{formatCurrency(getEffectivePrice(p))}</div>
                        <div className="text-[8px] text-slate-400 font-bold">Stok: {p.stock}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="p-10 text-center">
                <Package size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">Tidak ada produk ditemukan</p>
              </div>
            )}
          </div>
        </div>

        {/* 🔴 Tombol Simpan Harga Promo ke Database — muncul jika mode promo aktif */}
        {usePromo && selectedProducts.length > 0 && (
          <div className="px-6 pb-2">
            <button
              onClick={async () => {
                if (isSavingPromo) return;
                setIsSavingPromo(true);
                setPromoSaved(false);
                try {
                  let savedCount = 0;
                  for (const p of selectedProducts) {
                    const promoPrice = promoPrices[p.id];
                    if (promoPrice && promoPrice > 0) {
                      await indexdbBarang.updateBarang({
                        ...p,
                        pricePromo: promoPrice,
                        updated_at: Date.now()
                      });
                      savedCount++;
                    }
                  }
                  setPromoSaved(true);
                  console.log(`✅ Harga promo tersimpan untuk ${savedCount} produk`);
                } catch (e) {
                  console.error('Gagal menyimpan harga promo:', e);
                  alert('Gagal menyimpan harga promo ke database.');
                } finally {
                  setIsSavingPromo(false);
                }
              }}
              disabled={isSavingPromo}
              className={`w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                promoSaved
                  ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border-2 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
              }`}
            >
              {isSavingPromo ? (
                <span className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              ) : promoSaved ? (
                <CheckSquare size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {isSavingPromo
                ? 'Menyimpan...'
                : promoSaved
                  ? '✅ Harga Promo Tersimpan ke Database!'
                  : '💾 Simpan Harga Promo ke Database'}
            </button>
            {promoSaved && (
              <p className="text-[9px] text-emerald-500 font-bold text-center mt-1">
                Harga promo akan muncul otomatis di POS kasir dengan badge Promo
              </p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all active:scale-95"
          >
            Tutup
          </button>
          <button
            onClick={generatePreview}
            disabled={selectedProducts.length === 0 || isPrinting}
            className="flex-1 py-4 bg-white border-2 border-blue-200 text-blue-600 rounded-2xl font-black text-sm transition-all hover:bg-blue-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Barcode size={16} className="inline mr-1.5" />
            Preview
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedProducts.length === 0 || isPrinting}
            className="flex-[2] py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPrinting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Printer size={18} />
            )}
            {isPrinting ? 'Menyiapkan...' : `Cetak ${selectedProducts.length * copies} Label`}
          </button>
        </div>
      </motion.div>

      {/* Preview Modal — tampilan estetik */}
      <AnimatePresence>
        {showPreview && previewHtml && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-md">
                    <Barcode size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">Preview Label</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {activePreset.name} · {selectedProducts.length * copies} label
                      {usePromo && <span className="text-rose-500"> · Promo</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPreview(false)} className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-200 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* Konten preview — kertas putih di atas meja abu-abu */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-200/60">
                <div className="flex flex-col items-center gap-4">
                  {/* Info ukuran */}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                      {activePreset.widthMm} × {activePreset.heightMm} mm
                    </span>
                    <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                      {activePreset.columns > 1 ? `${activePreset.columns} kolom` : 'Single'}
                    </span>
                    {usePromo && (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 shadow-sm">
                        Promo
                      </span>
                    )}
                  </div>

                  {/* Kertas preview */}
                  <div
                    className="bg-white rounded-2xl shadow-xl p-5 mx-auto border border-slate-200"
                    style={{ maxWidth: `${activePreset.widthMm * 2.8}px`, width: '100%' }}
                  >
                    <div
                      className="mx-auto"
                      style={{ maxWidth: `${activePreset.widthMm * 2.5}px` }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>

                  {/* Catatan */}
                  <p className="text-[9px] text-slate-400 font-bold text-center max-w-xs">
                    💡 Pastikan ukuran kertas printer sesuai dengan preset label yang dipilih.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50/50">
                <button onClick={() => setShowPreview(false)} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all">
                  Tutup
                </button>
                <button
                  onClick={() => { setShowPreview(false); setTimeout(() => handlePrint(), 200); }}
                  className="flex-[2] py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Printer size={16} />
                  Cetak Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}