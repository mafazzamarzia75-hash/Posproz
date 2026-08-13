/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSettingsStore } from '../../store/useSettingsStore';

export interface PrintData {
  title?: string;
  address?: string;
  phone?: string;
  customerName?: string;
  transactionId?: string;
  items: any[];
  subtotal?: number;
  discountAmount?: number;
  total: number;
  cashAmount?: number;
  changeAmount?: number;
  footer?: string;
}

class PrinterService {
  async printReceipt(data: PrintData) {
    const settings = useSettingsStore.getState();
    
    const printData = {
      ...data,
      title: data.title || settings.storeInfo.name,
      address: data.address || settings.storeInfo.address,
      phone: data.phone || settings.storeInfo.phone,
      footer: data.footer || settings.storeInfo.footer,
    };
    
    console.log("Mencetak struk...", printData);
    return this.printUniversal(printData);
  }

  async previewReceipt(data: PrintData): Promise<string> {
    const settings = useSettingsStore.getState();
    
    const printData = {
      ...data,
      title: data.title || settings.storeInfo.name,
      address: data.address || settings.storeInfo.address,
      phone: data.phone || settings.storeInfo.phone,
      footer: data.footer || settings.storeInfo.footer,
    };

    return this.generateReceiptHtml(printData);
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  }

  private escapeHtml(text: string) {
    // Penting untuk mencegah karakter seperti <, >, & merusak struktur HTML saat dimasukkan ke <pre>
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private generateReceiptHtml(data: PrintData): string {
    const settings = useSettingsStore.getState();
    const paperWidthMm = settings.printer?.paperWidthMm ?? 58;
    const extraPageHeightMm = Number.isFinite(settings.printer?.extraPageHeightMm)
      ? Number(settings.printer.extraPageHeightMm)
      : 0;

    const MAX_WIDTH = 32;
    const COL_QTY = 4;
    const COL_NAME = 18;
    const COL_TOTAL = 10;
    
    const padRight = (t: any, l: number) => (String(t || '') + ' '.repeat(l)).substring(0, l);
    const padLeft = (t: any, l: number) => (' '.repeat(l) + String(t || '')).slice(-l);
    const padCenter = (t: any, l: number) => {
      const text = String(t || '').substring(0, l);
      const space = Math.max(0, l - text.length);
      const padLeftComp = Math.floor(space / 2);
      return ' '.repeat(padLeftComp) + text + ' '.repeat(space - padLeftComp);
    };

    const formatReceiptAmount = (amount: number) => this.formatCurrency(amount).replace('Rp', '').trim();
    const fitAmountToColumn = (value: number, width: number) => {
      const full = formatReceiptAmount(value);
      if (full.length <= width) return full;
      const compact = String(Math.round(value));
      if (compact.length <= width) return compact;
      return compact;
    };

    const formatSummaryLine = (label: string, value: number) => {
      const amountText = fitAmountToColumn(value, COL_TOTAL);
      const summaryIndent = Math.max(0, COL_QTY - 2);
      return `${padRight('', summaryIndent)}${padCenter(label, COL_NAME)}${padLeft(amountText, COL_TOTAL)}`;
    };

    const formatNumber = (value: number): string => {
      return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    const receiptLines: string[] = [];

    // Header kembalikan ke kondisi awal
    receiptLines.push(String(data.title || '').toUpperCase());
    if (data.address) receiptLines.push(String(data.address));
    if (data.phone) receiptLines.push(String(data.phone));
    if (data.transactionId) receiptLines.push(`ID: ${data.transactionId}`);
    if (data.customerName) receiptLines.push(`Pelanggan: ${data.customerName}`);
    receiptLines.push(new Date().toLocaleString('id-ID'));
    receiptLines.push('-'.repeat(MAX_WIDTH));
    receiptLines.push(`${padRight('QTY', COL_QTY)}${padCenter('NAMA BARANG', COL_NAME)}${padLeft('TOTAL', COL_TOTAL)}`);
    receiptLines.push('-'.repeat(MAX_WIDTH));

    // 2. Daftar Barang Item
    const itemsHtml = data.items.map(item => {
      let nama = '';
      if (item.product_name) nama = item.product_name;
      else if (item.name) nama = item.name;
      else if (item.nama) nama = item.nama;
      else if (item.productName) nama = item.productName;
      else if (item.nama_barang) nama = item.nama_barang;
      else if (item.barang) nama = item.barang;
      else nama = 'Produk';

      const qty = Number(item.qty || item.quantity || item.jumlah) || 1;
      const harga = Number(item.price_at_sale || item.price || item.harga || item.harga_jual) || 0;
      const subtotal = qty * harga;

      // Proteksi nama barang agar di-wrap per baris (max 32 char)
      const namaLines: string[] = [];
      const namaStr = String(nama);
      for (let i = 0; i < namaStr.length; i += MAX_WIDTH) {
        namaLines.push(namaStr.substring(i, i + MAX_WIDTH));
      }
      const wrappedNama = namaLines.join('\n');

      // Baris kedua: "Qty  X  Rp HargaSatuan           Rp Subtotal"
      const leftPart = `${qty}  X  Rp ${formatNumber(harga)}`;
      const rightPart = `Rp ${formatNumber(subtotal)}`;
      const spacesNeeded = Math.max(1, MAX_WIDTH - leftPart.length - rightPart.length);
      const detailLine = leftPart + ' '.repeat(spacesNeeded) + rightPart;

      return `${wrappedNama}\n${detailLine}`;
    }).join('\n');

    if (itemsHtml) {
      receiptLines.push(itemsHtml);
    }

    // Hitung subtotal dari items jika tidak dikirim eksplisit
    const computedSubtotal = data.subtotal ?? data.items.reduce((acc, item) => {
      const qty = Number(item.qty || item.quantity || item.jumlah) || 1;
      const harga = Number(item.price_at_sale || item.price || item.harga || item.harga_jual) || 0;
      return acc + (qty * harga);
    }, 0);
    const computedDiscount = data.discountAmount ?? Math.max(0, computedSubtotal - data.total);

    receiptLines.push('='.repeat(MAX_WIDTH));

    // Tampilkan SUB TOTAL & DISKON jika ada diskon
    if (computedDiscount > 0) {
      receiptLines.push(formatSummaryLine('SUB TOTAL', computedSubtotal));
      receiptLines.push(formatSummaryLine('DISKON', computedDiscount));
      receiptLines.push('-'.repeat(MAX_WIDTH));
    }

    receiptLines.push(formatSummaryLine('TOTAL', data.total));
    receiptLines.push(formatSummaryLine('TUNAI', data.cashAmount || 0));
    receiptLines.push(formatSummaryLine('KEMBALI', data.changeAmount || 0));
    receiptLines.push('-'.repeat(MAX_WIDTH));

    // 4. Footer Struk (Pesan penutup di-center)
    if (data.footer) {
      const cleanFooter = String(data.footer).trim();
      const words = cleanFooter.split(/\s+/);
      let currentLine = '';
      const formattedFooterLines: string[] = [];

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= MAX_WIDTH) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) formattedFooterLines.push(padCenter(currentLine, MAX_WIDTH));
          currentLine = word;
        }
      }
      if (currentLine) {
        formattedFooterLines.push(padCenter(currentLine, MAX_WIDTH));
      }
      receiptLines.push(formattedFooterLines.join('\n'));
    }

    const receiptText = receiptLines.join('\n').trimEnd();

    // Estimasi tinggi halaman berdasarkan jumlah baris.
    const lineCount = receiptText.length > 0 ? receiptText.split('\n').length : 1;
    const approxLineHeightMm = 4.5;
    const paddingMm = 4;
    const estimatedHeightMm = Math.ceil(lineCount * approxLineHeightMm + paddingMm + Math.max(0, extraPageHeightMm));
    const pageHeightMm = Math.min(600, Math.max(40, estimatedHeightMm));

    // CSS optimal untuk thermal printer: minimal margin, tinggi dinamis
    return `<!DOCTYPE html><html><head><title>STRUK TRANSAKSI</title><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      @page{margin:0;size:${paperWidthMm}mm ${pageHeightMm}mm;}
      html,body{margin:0;padding:0;width:${paperWidthMm}mm;height:${pageHeightMm}mm;overflow:visible;}
      body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;background:#fff;color:#000;}
      pre{margin:0;padding:0;white-space:pre;line-height:1.5;}
      @media print{
        html,body{height:auto !important;min-height:0 !important;overflow:visible;}
        @page{margin:0;size:${paperWidthMm}mm auto;}
      }
    </style></head><body><pre>${this.escapeHtml(receiptText)}</pre></body></html>`;
  }

  /**
   * Deteksi apakah aplikasi berjalan di platform Android (browser atau APK).
   */
  private isAndroidPlatform(): boolean {
    return navigator.userAgent.toLowerCase().includes('android');
  }

  /**
   * Cetak struk melalui aplikasi RawBT di Android.
   * Strategi multi-tier karena browser modern (Chrome, Samsung, dll)
   * memblokir redirect otomatis ke custom scheme (rawbt:...).
   * 
   * Tier 1: Buka rawbt:base64,... via window.open (user gesture)
   * Tier 2: Redirect window.location.href langsung
   * Tier 3: Tampilkan overlay dengan instruksi manual + tombol
   *         "Copy ke Clipboard" + "Buka RawBT" (user klik manual)
   * 
   * Referensi: https://rawbt.ru/
   */
  private printViaRawBT(data: PrintData): void {
    const receiptText = this.generateReceiptText(data);
    const base64 = btoa(unescape(encodeURIComponent(receiptText)));
    const rawbtUri = "rawbt:base64," + base64;

    console.log("Mengirim struk ke RawBT...");

    // === Tier 1: window.open() dengan rawbt URI ===
    // Beberapa browser mengizinkan ini jika hasil dari user gesture langsung
    try {
      var opened = window.open(rawbtUri, '_blank');
      if (opened) {
        // Jika berhasil, bersihkan setelah beberapa detik
        setTimeout(() => {
          try { opened.close(); } catch(_) {}
        }, 3000);
        return;
      }
    } catch (_) {}

    // === Tier 2: redirect via window.location.href ===
    // Kadang berhasil jika user mengklik tombol cetak langsung
    try {
      window.location.href = rawbtUri;
      // Jika redirect sukses, halaman akan pindah, jadi kode setelah ini
      // hanya dieksekusi jika redirect gagal (return false)
      setTimeout(() => {
        // Jika masih di halaman yang sama setelah 500ms, redirect gagal
        // Lanjut ke Tier 3
        this._showRawBtOverlay(receiptText, rawbtUri, data);
      }, 500);
      return;
    } catch (_) {
      // Redirect gagal, lanjut ke Tier 3
    }

    // === Tier 3: Overlay dengan instruksi manual ===
    this._showRawBtOverlay(receiptText, rawbtUri, data);
  }

  /**
   * Tampilkan overlay yang berisi:
   * 1. Pratinjau struk (readonly textarea)
   * 2. Tombol "Copy Struk & Buka RawBT"
   * 3. Tombol "Buka RawBT Langsung"
   * 4. Instruksi jika RawBT belum terinstall
   * 
   * User harus mengklik tombol secara manual (genuine user gesture)
   * agar browser mengizinkan redirect ke custom scheme rawbt:...
   */
  private _showRawBtOverlay(receiptText: string, rawbtUri: string, data: PrintData): void {
    // Cegah overlay ganda
    if (document.getElementById('rawbt-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'rawbt-overlay';
    overlay.innerHTML = `
      <div style="
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.6);z-index:99999;
        display:flex;align-items:center;justify-content:center;
        font-family:Arial,sans-serif;
      ">
        <div style="
          background:white;border-radius:12px;padding:20px;
          max-width:380px;width:90%;max-height:90vh;overflow-y:auto;
          box-shadow:0 8px 32px rgba(0,0,0,0.3);
        ">
          <h3 style="margin:0 0 8px;font-size:16px;color:#333;text-align:center;">
            🖨️ Cetak Struk via RawBT
          </h3>
          <p style="font-size:12px;color:#666;text-align:center;margin:0 0 12px;">
            Aplikasi RawBT akan terbuka untuk mencetak struk ke printer thermal.
          </p>
          
          <button id="rawbt-open-btn" style="
            width:100%;padding:12px;font-size:15px;font-weight:bold;
            background:#2563eb;color:white;border:none;border-radius:8px;
            cursor:pointer;margin-bottom:8px;
          ">📤 Buka RawBT & Cetak</button>
          
          <button id="rawbt-copy-btn" style="
            width:100%;padding:10px;font-size:13px;font-weight:bold;
            background:#059669;color:white;border:none;border-radius:8px;
            cursor:pointer;margin-bottom:12px;
          ">📋 Copy Struk & Buka RawBT</button>
          
          <div style="font-size:11px;color:#888;text-align:center;margin-bottom:8px;">
            atau copy manual teks struk di bawah:
          </div>
          
          <textarea id="rawbt-text" readonly style="
            width:100%;height:160px;font-family:'Courier New',monospace;
            font-size:10px;padding:8px;border:1px solid #ddd;
            border-radius:6px;resize:none;background:#f9f9f9;
            white-space:pre;overflow-y:auto;
          ">${this.escapeHtml(receiptText)}</textarea>
          
          <div style="font-size:11px;color:#999;margin-top:8px;text-align:center;">
            💡 Tidak punya RawBT? 
            <a href="https://rawbt.ru/" target="_blank" style="color:#2563eb;">
              Download RawBT
            </a>
          </div>
          
          <button id="rawbt-close-btn" style="
            width:100%;padding:8px;font-size:12px;
            background:#eee;color:#666;border:none;border-radius:8px;
            cursor:pointer;margin-top:10px;
          ">✕ Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Tombol: Buka RawBT langsung
    document.getElementById('rawbt-open-btn')?.addEventListener('click', function() {
      // Genuine user gesture — browser akan mengizinkan custom scheme
      try {
        window.open(rawbtUri, '_blank');
      } catch (_) {
        try { window.location.href = rawbtUri; } catch (_2) {}
      }
      // Tutup overlay setelah mencoba
      document.body.removeChild(overlay);
    });

    // Tombol: Copy + Buka RawBT
    document.getElementById('rawbt-copy-btn')?.addEventListener('click', function() {
      var textarea = document.getElementById('rawbt-text') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        try {
          navigator.clipboard.writeText(receiptText).then(function() {
            alert('✅ Teks struk berhasil di-copy!\n\nSekarang buka aplikasi RawBT dan paste (tahan) untuk mencetak.');
          }).catch(function() {
            document.execCommand('copy');
          });
        } catch (_) {
          try { document.execCommand('copy'); } catch(_2) {}
        }
      }
      // Buka RawBT
      try {
        window.open(rawbtUri, '_blank');
      } catch (_) {
        try { window.location.href = rawbtUri; } catch (_2) {}
      }
    });

    // Tombol Tutup
    document.getElementById('rawbt-close-btn')?.addEventListener('click', function() {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    });
  }

  /**
   * Generate teks struk polos (tanpa HTML) untuk dikirim ke RawBT.
   */
  private generateReceiptText(data: PrintData): string {
    const settings = useSettingsStore.getState();

    const printData = {
      ...data,
      title: data.title || settings.storeInfo.name,
      address: data.address || settings.storeInfo.address,
      phone: data.phone || settings.storeInfo.phone,
      footer: data.footer || settings.storeInfo.footer,
    };

    const MAX_WIDTH = 32;
    const COL_QTY = 4;
    const COL_NAME = 18;
    const COL_TOTAL = 10;

    const padRight = (t: any, l: number) => (String(t || '') + ' '.repeat(l)).substring(0, l);
    const padLeft = (t: any, l: number) => (' '.repeat(l) + String(t || '')).slice(-l);
    const padCenter = (t: any, l: number) => {
      const text = String(t || '').substring(0, l);
      const space = Math.max(0, l - text.length);
      const padLeftComp = Math.floor(space / 2);
      return ' '.repeat(padLeftComp) + text + ' '.repeat(space - padLeftComp);
    };

    const formatNumber = (value: number): string => {
      return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    const formatReceiptAmount = (amount: number) => this.formatCurrency(amount).replace('Rp', '').trim();
    const fitAmountToColumn = (value: number, width: number) => {
      const full = formatReceiptAmount(value);
      if (full.length <= width) return full;
      const compact = String(Math.round(value));
      if (compact.length <= width) return compact;
      return compact;
    };

    const formatSummaryLine = (label: string, value: number) => {
      const amountText = fitAmountToColumn(value, COL_TOTAL);
      const summaryIndent = Math.max(0, COL_QTY - 2);
      return `${padRight('', summaryIndent)}${padCenter(label, COL_NAME)}${padLeft(amountText, COL_TOTAL)}`;
    };

    const receiptLines: string[] = [];

    // Header
    receiptLines.push(String(printData.title || '').toUpperCase());
    if (printData.address) receiptLines.push(String(printData.address));
    if (printData.phone) receiptLines.push(String(printData.phone));
    if (printData.transactionId) receiptLines.push(`ID: ${printData.transactionId}`);
    if (printData.customerName) receiptLines.push(`Pelanggan: ${printData.customerName}`);
    receiptLines.push(new Date().toLocaleString('id-ID'));
    receiptLines.push('-'.repeat(MAX_WIDTH));
    receiptLines.push(`${padRight('QTY', COL_QTY)}${padCenter('NAMA BARANG', COL_NAME)}${padLeft('TOTAL', COL_TOTAL)}`);
    receiptLines.push('-'.repeat(MAX_WIDTH));

    // Items
    printData.items.forEach(item => {
      let nama = '';
      if (item.product_name) nama = item.product_name;
      else if (item.name) nama = item.name;
      else if (item.nama) nama = item.nama;
      else if (item.productName) nama = item.productName;
      else if (item.nama_barang) nama = item.nama_barang;
      else if (item.barang) nama = item.barang;
      else nama = 'Produk';

      const qty = Number(item.qty || item.quantity || item.jumlah) || 1;
      const harga = Number(item.price_at_sale || item.price || item.harga || item.harga_jual) || 0;

      // Wrap nama barang per baris
      const namaStr = String(nama);
      for (let i = 0; i < namaStr.length; i += MAX_WIDTH) {
        receiptLines.push(namaStr.substring(i, i + MAX_WIDTH));
      }

      const leftPart = `${qty}  X  Rp ${formatNumber(harga)}`;
      const rightPart = `Rp ${formatNumber(qty * harga)}`;
      const spacesNeeded = Math.max(1, MAX_WIDTH - leftPart.length - rightPart.length);
      receiptLines.push(leftPart + ' '.repeat(spacesNeeded) + rightPart);
    });

    receiptLines.push('='.repeat(MAX_WIDTH));

    // Hitung subtotal
    const computedSubtotal = printData.subtotal ?? printData.items.reduce((acc, item) => {
      const qty = Number(item.qty || item.quantity || item.jumlah) || 1;
      const harga = Number(item.price_at_sale || item.price || item.harga || item.harga_jual) || 0;
      return acc + (qty * harga);
    }, 0);
    const computedDiscount = printData.discountAmount ?? Math.max(0, computedSubtotal - printData.total);

    if (computedDiscount > 0) {
      receiptLines.push(formatSummaryLine('SUB TOTAL', computedSubtotal));
      receiptLines.push(formatSummaryLine('DISKON', computedDiscount));
      receiptLines.push('-'.repeat(MAX_WIDTH));
    }

    receiptLines.push(formatSummaryLine('TOTAL', printData.total));
    receiptLines.push(formatSummaryLine('TUNAI', printData.cashAmount || 0));
    receiptLines.push(formatSummaryLine('KEMBALI', printData.changeAmount || 0));
    receiptLines.push('-'.repeat(MAX_WIDTH));

    // Footer
    if (printData.footer) {
      const cleanFooter = String(printData.footer).trim();
      const words = cleanFooter.split(/\s+/);
      let currentLine = '';
      const formattedFooterLines: string[] = [];

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= MAX_WIDTH) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) formattedFooterLines.push(padCenter(currentLine, MAX_WIDTH));
          currentLine = word;
        }
      }
      if (currentLine) {
        formattedFooterLines.push(padCenter(currentLine, MAX_WIDTH));
      }
      receiptLines.push(formattedFooterLines.join('\n'));
    }

    return receiptLines.join('\n').trimEnd();
  }

  /**
   * Cetak via popup window (metode lama: window.print()).
   */
  private printViaPopup(data: PrintData): void {
    const finalHtml = this.generateReceiptHtml(data);

    const htmlWithPrintTrigger = finalHtml.replace('</body>', `
      <script>
        (function() {
          function doPrint() {
            try {
              window.focus();
              window.print();
            } catch(e) {}
          }
          
          window.onload = doPrint;
          
          // Tutup popup setelah print dialog ditutup
          if (window.onafterprint === undefined) {
            // Fallback: polling setiap 500ms untuk deteksi print selesai
            var beforePrint = new Date();
            var pollTimer = setInterval(function() {
              var afterPrint = new Date();
              var elapsed = afterPrint - beforePrint;
              // Jika sudah lewat 1 detik dan tidak ada print aktif, tutup
              if (elapsed > 1000) {
                clearInterval(pollTimer);
                try { window.close(); } catch(e) {}
              }
            }, 500);
          } else {
            window.onafterprint = function() {
              setTimeout(function() { try { window.close(); } catch(e) {} }, 100);
            };
          }
          
          // Jika window.print() langsung selesai (misal print dialog ditolak), tetap tutup
          setTimeout(function() {
            try { window.close(); } catch(e) {}
          }, 5000);
        })();
      <\/script>
    </body>`);

    var popup = window.open('', '_blank', 'width=380,height=500,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=no');
    
    if (!popup) {
      console.warn('Popup diblokir, fallback ke iframe...');
      this.printViaIframe(htmlWithPrintTrigger);
      return;
    }

    try {
      popup.document.open();
      popup.document.write(htmlWithPrintTrigger);
      popup.document.close();
    } catch(e) {
      console.warn('Gagal nulis ke popup, fallback ke iframe...', e);
      popup.close();
      this.printViaIframe(htmlWithPrintTrigger);
    }
  }

  private printUniversal(data: PrintData) {
    // Deteksi platform dari MAIN WINDOW (bukan dari popup/iframe)
    if (this.isAndroidPlatform()) {
      this.printViaRawBT(data);
      return;
    }

    // Non-Android: gunakan metode popup window.print() seperti biasa
    this.printViaPopup(data);
  }

  private printViaIframe(htmlContent: string) {
    var iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '58mm';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    
    document.body.appendChild(iframe);

    var doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 45000);
  }
}

export const printerService = new PrinterService();