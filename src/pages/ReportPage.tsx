/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Laporan Laba Rugi Akurat
 * Hitung: Omset - Biaya Operasional = Laba Bersih
 * Tombol Print: Cetak laporan ke printer (bukan struk thermal)
 */

import React, { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Calendar, Download, Printer, ChevronDown, TrendingDown, Wallet, Percent } from 'lucide-react';
import { formatCurrency, cn, downloadFile } from '@/lib/utils';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi';
import { indexdbExpense } from '@/lib/indexdbExpense';
import { indexdbBarang } from '@/lib/indexdbBarang';
import { useSettingsStore } from '@/store/useSettingsStore';
// Note: XLSX is loaded dynamically in `exportToExcel` to avoid large bundle size

const ReportPage: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const reportContentRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState([
    { label: 'OMSET KOTOR', value: formatCurrency(0), icon: <TrendingUp />, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'OMSET BERSIH', value: formatCurrency(0), icon: <DollarSign />, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'TOTAL PENJUALAN', value: '0 Transaksi', icon: <ShoppingBag />, color: 'text-orange-500', bg: 'bg-orange-50' },
  ]);

  const [chartData, setChartData] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const periods = [
    { id: 'today', label: 'Hari Ini' },
    { id: '7d', label: '7 Hari Terakhir' },
    { id: '30d', label: '30 Hari Terakhir' },
    { id: 'month', label: 'Bulan Ini' },
    { id: 'year', label: 'Tahun Ini' },
    { id: 'all', label: 'Semua Data' },
  ];

  useEffect(() => {
    loadAllTransactions();
    setIsMounted(true);
  }, []);

  useEffect(() => {
    generateReportData();
  }, [selectedPeriod, allTransactions]);

  const loadAllTransactions = async () => {
    try {
      const [data, expenses] = await Promise.all([
        indexdbTransaksi.getAll(),
        indexdbExpense.getAll()
      ]);
      setAllTransactions(data);
      
      const totalBiaya = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      setTotalExpenses(totalBiaya);
    } catch (err) {
      console.error("Error load data:", err);
    }
  };

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    let start = new Date(0);
    const end = new Date(now);

    switch (selectedPeriod) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return { start, end };
  };

  const [rincianLabaRugi, setRincianLabaRugi] = useState({
    omset: 0,
    hpp: 0,
    labaKotor: 0,
    biayaOperasional: 0,
    labaBersih: 0,
    margin: '0%',
    totalTransaksi: 0,
  });

  const generateReportData = async () => {
    const { start, end } = getDateRange();

    const filtered = allTransactions.filter((trx: any) => 
      new Date(trx.created_at) >= start
    );

    const totalOmset = filtered.reduce((sum: number, trx: any) => sum + (Number(trx.total) || 0), 0);
    const totalTransaksi = filtered.length;

    // Load products mapping once for older transactions fallback
    const productsList = await indexdbBarang.getAllBarang();
    const productCostMap: Record<string, number> = {};
    productsList.forEach((p: any) => {
      productCostMap[p.id] = p.priceCost || p.cost_price || 0;
      if (p.sku) {
        productCostMap[p.sku] = p.priceCost || p.cost_price || 0;
      }
    });

    // Calculate Harga Pokok Penjualan (HPP / Cost of Goods Sold)
    let totalHpp = 0;
    filtered.forEach((trx: any) => {
      const items = Array.isArray(trx.items) ? trx.items : [];
      items.forEach((item: any) => {
        const qty = item.qty !== undefined ? Number(item.qty) : (item.quantity !== undefined ? Number(item.quantity) : 1);
        let costPrice = item.price_at_cost !== undefined ? Number(item.price_at_cost) : (item.priceCost !== undefined ? Number(item.priceCost) : (item.price_cost !== undefined ? Number(item.price_cost) : 0));
        
        // Fallback to currently registered cost price if recorded as 0 or undefined
        if (costPrice === 0) {
          const productId = item.product_id || item.id || item.sku || '';
          if (productId && productCostMap[productId] !== undefined) {
            costPrice = productCostMap[productId];
          }
        }
        totalHpp += costPrice * qty;
      });
    });

    const allExpenses = await indexdbExpense.getAll();
    const biayaPeriode = allExpenses
      .filter((e: any) => new Date(e.date) >= start && new Date(e.date) <= end)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const labaKotor = totalOmset - totalHpp;
    const labaBersih = labaKotor - biayaPeriode;
    const margin = totalOmset > 0 ? ((labaBersih / totalOmset) * 100).toFixed(1) : '0.0';

    setStats([
      { label: 'OMSET KOTOR', value: formatCurrency(totalOmset), icon: <TrendingUp />, color: 'text-slate-800', bg: 'bg-slate-50' },
      { label: 'BIAYA MODAL (HPP)', value: formatCurrency(totalHpp), icon: <ShoppingBag />, color: 'text-orange-500', bg: 'bg-orange-50' },
      { label: 'LABA BERSIH', value: formatCurrency(labaBersih), icon: <DollarSign />, color: labaBersih >= 0 ? 'text-emerald-500' : 'text-red-500', bg: labaBersih >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    ]);

    setRincianLabaRugi({
      omset: totalOmset,
      hpp: totalHpp,
      labaKotor,
      biayaOperasional: biayaPeriode,
      labaBersih,
      margin: `${margin}%`,
      totalTransaksi,
    });

    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dailyData = days.map(day => ({ name: day, total: 0 }));

    filtered.forEach((trx: any) => {
      const dayIndex = new Date(trx.created_at).getDay();
      if (dayIndex >= 0 && dayIndex < 7) {
        dailyData[dayIndex].total += (Number(trx.total) || 0);
      }
    });

    setChartData(dailyData);
    setFilteredTransactions(filtered);
  };

  // Export ke Excel
  const exportToExcel = async () => {
    // Try to dynamically load xlsx, but provide a CSV fallback to mitigate SheetJS vulnerabilities.
    const MAX_EXPORT_ROWS = 10000;
    const MAX_CELL_LENGTH = 300;
    const safeString = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.length > MAX_CELL_LENGTH ? s.slice(0, MAX_CELL_LENGTH) : s;
    };

    const rowsToExport = filteredTransactions.slice(0, MAX_EXPORT_ROWS);
    if (filteredTransactions.length > MAX_EXPORT_ROWS) {
      console.warn(`⚠️ Filtered transaksi terlalu banyak (${filteredTransactions.length}), hanya mengekspor ${MAX_EXPORT_ROWS} baris pertama.`);
    }

    const dataExcel = rowsToExport.map((trx: any) => ({
      'ID Transaksi': safeString(trx.id),
      'Waktu Transaksi': safeString(new Date(trx.created_at).toLocaleString('id-ID')),
      'Jumlah Item': Number(trx.items?.length || 0),
      'Total Penjualan (Rp)': Number(trx.total || 0),
    }));

    const filenameBase = `laporan-laba-rugi-${selectedPeriod}-${new Date().toISOString().slice(0,10)}`;

    try {
      const xlsxMod = await import('xlsx');
      const XLSX = (xlsxMod && (xlsxMod as any).default) ? (xlsxMod as any).default : xlsxMod;

      // Build workbook with SheetJS
      const ringkasanWs = XLSX.utils.json_to_sheet([
        { 'Ringkasan Laba Rugi': '' },
        { 'Omset Kotor': Number(rincianLabaRugi.omset || 0) },
        { 'Biaya Operasional': Number(rincianLabaRugi.biayaOperasional || 0) },
        { 'Laba Bersih': Number(rincianLabaRugi.labaBersih || 0) },
        { 'Margin': safeString(rincianLabaRugi.margin) },
        { 'Total Transaksi': Number(rincianLabaRugi.totalTransaksi || 0) },
      ]);

      const ws = XLSX.utils.json_to_sheet(dataExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
      XLSX.utils.book_append_sheet(wb, ringkasanWs, "Ringkasan Laba Rugi");
      ws['!cols'] = [ { wch: 22 }, { wch: 25 }, { wch: 12 }, { wch: 20 } ];

      const filename = `${filenameBase}.xlsx`;
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await downloadFile(filename, blob, 'xlsx');
      return;
    } catch (e) {
      console.warn('SheetJS (xlsx) tidak tersedia atau gagal di-load — menggunakan fallback CSV. Error:', e && e.message ? e.message : e);
    }

    // Fallback: generate CSV (safer, no SheetJS dependency)
    const csvHeaders = ['ID Transaksi','Waktu Transaksi','Jumlah Item','Total Penjualan (Rp)'];
    const csvRows = [csvHeaders.join(',')];
    for (const row of dataExcel) {
      const vals = csvHeaders.map(h => {
        const v = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        // escape double quotes
        return `"${v.replace(/"/g, '""')}"`;
      });
      csvRows.push(vals.join(','));
    }
    const csvContent = csvRows.join('\n');
    const csvFilename = `${filenameBase}.csv`;
    await downloadFile(csvFilename, csvContent, 'text');
  };

  // ✅ PRINT LAPORAN — Cetak laporan dengan format bersih (bukan struk thermal)
  const printReport = () => {
    const storeInfo = useSettingsStore.getState().storeInfo;
    const periodLabel = periods.find(p => p.id === selectedPeriod)?.label || '';

    // Generate tabel transaksi untuk print
    const transactionsHtml = filteredTransactions.length > 0
      ? `<table class="print-table">
          <thead>
            <tr>
              <th>ID Transaksi</th>
              <th>Waktu</th>
              <th>Item</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.slice(0, 50).map((trx: any) => `
              <tr>
                <td>${trx.id}</td>
                <td>${new Date(trx.created_at).toLocaleString('id-ID')}</td>
                <td>${trx.items?.length || 0}</td>
                <td class="text-right">Rp ${Number(trx.total).toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
            ${filteredTransactions.length > 50 ? `<tr><td colspan="4" class="text-center text-muted">... dan ${filteredTransactions.length - 50} transaksi lainnya</td></tr>` : ''}
          </tbody>
        </table>`
      : '<p class="text-muted">Tidak ada transaksi untuk periode ini.</p>';

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Laporan Laba Rugi - ${storeInfo.name}</title>
  <meta charset="utf-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:'Segoe UI',Arial,sans-serif;
      font-size:12px;
      color:#1e293b;
      padding:20px 30px;
      line-height:1.6;
    }
    .header{
      text-align:center;
      margin-bottom:24px;
      padding-bottom:16px;
      border-bottom:2px solid #10B981;
    }
    .header h1{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px;}
    .header p{font-size:11px;color:#64748b;}
    .period-info{
      font-size:11px;
      color:#64748b;
      text-align:center;
      margin-bottom:20px;
      padding:8px 16px;
      background:#f1f5f9;
      border-radius:8px;
      display:inline-block;
    }
    .stats-grid{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:12px;
      margin-bottom:20px;
    }
    .stat-card{
      padding:12px 16px;
      border-radius:12px;
      border:1px solid #e2e8f0;
    }
    .stat-card .label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
    .stat-card .value{font-size:16px;font-weight:800;}
    .profit-detail{margin-bottom:20px;}
    .profit-row{
      display:flex;
      justify-content:space-between;
      padding:8px 12px;
      border-radius:8px;
      margin-bottom:4px;
    }
    .profit-row .lbl{font-size:11px;font-weight:600;}
    .profit-row .val{font-size:12px;font-weight:800;}
    .profit-row.omset{background:#ecfdf5;color:#059669;}
    .profit-row.hpp{background:#fffbeb;color:#d97706;}
    .profit-row.labakotor{background:#f0fdfa;color:#0d9488;}
    .profit-row.biaya{background:#fef2f2;color:#dc2626;}
    .profit-row.laba{background:#eff6ff;color:#2563eb;}
    .profit-row.margin-row{background:#f8fafc;color:#64748b;}
    hr{border:none;border-top:1px dashed #e2e8f0;margin:8px 0;}
    table.print-table{width:100%;border-collapse:collapse;font-size:11px;}
    table.print-table th,table.print-table td{padding:6px 8px;border:1px solid #e2e8f0;text-align:left;}
    table.print-table th{background:#f1f5f9;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;}
    table.print-table .text-right{text-align:right;}
    table.print-table .text-center{text-align:center;}
    .text-muted{color:#94a3b8;font-size:11px;text-align:center;padding:12px;}
    .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;}
    @media print{
      body{padding:0;margin:12px 0;}
      .no-print{display:none !important;}
      @page{margin:12mm 10mm;}
    }
    .no-print{margin-top:20px;padding:12px;background:#f1f5f9;text-align:center;border-radius:8px;}
    .no-print button{
      padding:8px 24px;
      background:#10B981;
      color:white;
      border:none;
      border-radius:8px;
      font-weight:700;
      font-size:12px;
      cursor:pointer;
    }
    .no-print button:hover{background:#059669;}
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="display:block;width:100%;margin-bottom:16px;">
    Cetak Laporan Ini
  </button>

  <div class="header">
    <h1>${storeInfo.name.toUpperCase()}</h1>
    <p>${storeInfo.address || ''} ${storeInfo.phone ? '• Telp: ' + storeInfo.phone : ''}</p>
  </div>

  <div style="text-align:center;">
    <span class="period-info">📅 ${periodLabel} • Dilaporkan: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>

  <div class="stats-grid">
    <div class="stat-card" style="border-left:3px solid #059669;">
      <div class="label" style="color:#059669;">Omset Kotor</div>
      <div class="value" style="color:#059669;">Rp ${rincianLabaRugi.omset.toLocaleString('id-ID')}</div>
    </div>
    <div class="stat-card" style="border-left:3px solid #d97706;">
      <div class="label" style="color:#d97706;">Biaya Modal (HPP)</div>
      <div class="value" style="color:#d97706;">Rp ${rincianLabaRugi.hpp.toLocaleString('id-ID')}</div>
    </div>
    <div class="stat-card" style="border-left:3px solid #2563eb;">
      <div class="label" style="color:#2563eb;">Laba Bersih</div>
      <div class="value" style="color:#2563eb;">Rp ${rincianLabaRugi.labaBersih.toLocaleString('id-ID')}</div>
    </div>
  </div>

  <div class="profit-detail">
    <div class="profit-row omset">
      <span class="lbl">📈 Omset Kotor</span>
      <span class="val">Rp ${rincianLabaRugi.omset.toLocaleString('id-ID')}</span>
    </div>
    <div class="profit-row hpp">
      <span class="lbl">📦 Harga Pokok Penjualan (HPP)</span>
      <span class="val">- Rp ${rincianLabaRugi.hpp.toLocaleString('id-ID')}</span>
    </div>
    <div class="profit-row labakotor">
      <span class="lbl">⚖️ Laba Kotor</span>
      <span class="val">Rp ${rincianLabaRugi.labaKotor.toLocaleString('id-ID')}</span>
    </div>
    <div class="profit-row biaya">
      <span class="lbl">📉 Biaya Operasional</span>
      <span class="val">- Rp ${rincianLabaRugi.biayaOperasional.toLocaleString('id-ID')}</span>
    </div>
    <hr>
    <div class="profit-row laba">
      <span class="lbl">💰 Laba Bersih</span>
      <span class="val">Rp ${rincianLabaRugi.labaBersih.toLocaleString('id-ID')}</span>
    </div>
    <div class="profit-row margin-row">
      <span class="lbl">📊 Margin Keuntungan</span>
      <span class="val">${rincianLabaRugi.margin}</span>
    </div>
  </div>

  <h3 style="font-size:12px;font-weight:700;margin-bottom:8px;">Daftar Transaksi (${filteredTransactions.length})</h3>
  ${transactionsHtml}

  <div class="footer">
    <p>Laporan ini digenerate otomatis oleh Sistem Kasir • ${new Date().toLocaleString('id-ID')}</p>
  </div>
</body>
</html>`;

    // Buka popup untuk print
    const popup = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    if (!popup) {
      alert('Popup diblokir! Izinkan popup untuk mencetak laporan.');
      return;
    }
    popup.document.open();
    popup.document.write(printHtml);
    popup.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Laporan</h1>
          <p className="text-sm text-slate-500 font-medium">Analisis laba rugi bisnis Anda</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="Download Excel"
          >
            <Download size={16} /> Excel
          </button>
          
          <button 
            onClick={printReport}
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="Cetak Laporan"
          >
            <Printer size={16} /> Print
          </button>

          <div className="relative">
            <button 
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 bg-[#10B981] text-white px-4 py-2 rounded-2xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <Calendar size={16} /> 
              {periods.find(p => p.id === selectedPeriod)?.label}
              <ChevronDown size={14} className={cn("transition-transform", showPeriodDropdown && "rotate-180")} />
            </button>

            {showPeriodDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10">
                {periods.map(period => (
                  <button
                    key={period.id}
                    onClick={() => {
                      setSelectedPeriod(period.id);
                      setShowPeriodDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 text-xs font-bold transition-colors",
                      selectedPeriod === period.id 
                        ? "bg-emerald-50 text-[#10B981]" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kartu Statistik Utama */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-bold", stat.bg, stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className={cn("text-xl font-black tracking-tight mt-1", stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rincian Laba Rugi */}
      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg text-slate-800 mb-6">Rincian Laba Rugi</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-600">Omset Kotor</p>
                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">Total Penjualan</p>
              </div>
            </div>
            <p className="text-lg font-black text-emerald-600">{formatCurrency(rincianLabaRugi.omset)}</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <ShoppingBag size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-amber-600">Harga Pokok Penjualan (HPP)</p>
                <p className="text-[9px] text-amber-400 font-bold uppercase tracking-tight">Total Biaya Modal Barang Terjual</p>
              </div>
            </div>
            <p className="text-lg font-black text-amber-600">- {formatCurrency(rincianLabaRugi.hpp)}</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-teal-600">Laba Kotor</p>
                <p className="text-[9px] text-teal-400 font-bold uppercase tracking-tight">Omset - HPP</p>
              </div>
            </div>
            <p className="text-lg font-black text-teal-600">{formatCurrency(rincianLabaRugi.labaKotor)}</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500">
                <TrendingDown size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-red-500">Biaya Operasional</p>
                <p className="text-[9px] text-red-400 font-bold uppercase tracking-tight">Total Pengeluaran</p>
              </div>
            </div>
            <p className="text-lg font-black text-red-500">- {formatCurrency(rincianLabaRugi.biayaOperasional)}</p>
          </div>

          <div className="border-t border-dashed border-slate-200 my-2" />

          <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-blue-600">Laba Bersih</p>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-tight">Omset - HPP - Biaya</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-lg font-black",
                rincianLabaRugi.labaBersih >= 0 ? "text-blue-600" : "text-red-600"
              )}>
                {rincianLabaRugi.labaBersih >= 0 ? '' : '-'} {formatCurrency(Math.abs(rincianLabaRugi.labaBersih))}
              </p>
              <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 justify-end">
                <Percent size={10} />
                Margin: {rincianLabaRugi.margin}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-bold text-center">
            * Biaya operasional diambil dari halaman Biaya. Periode: {periods.find(p => p.id === selectedPeriod)?.label}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">Statistik Penjualan</h3>
        </div>
         <div className="h-64 w-full min-h-[256px] relative overflow-hidden">
           {isMounted && (
             <ResponsiveContainer width="99%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <Tooltip 
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 6 ? '#10B981' : '#E2E8F0'} />
                ))}
              </Bar>
             </BarChart>
             </ResponsiveContainer>
           )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Semua Transaksi</h3>
        </div>
        <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
          {filteredTransactions.map((trx: any) => (
            <div key={trx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-800">{trx.id}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {trx.items?.length || 0} Item
                  </p>
                </div>
              </div>
              <div className="text-right font-black text-slate-800 text-sm">
                {formatCurrency(Number(trx.total) || 0)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportPage;