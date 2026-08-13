/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSettingsStore } from '@/store/useSettingsStore';

class BarcodeService {
  generateCode(productName?: string): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    if (productName && productName.trim()) {
      const initials = productName.trim().split(/\s+/).map(word => word.charAt(0).toUpperCase()).filter(char => /[A-Z]/.test(char)).join('').substring(0, 3);
      if (initials.length > 0) return `GEN-${initials}-${randomNum}`;
    }
    return `GEN-${randomNum}`;
  }

  async generateBarcodeHtml(code: string, productName?: string, price?: number): Promise<string> {
    if (!code || !code.trim()) throw new Error('Kode barcode tidak boleh kosong');
    const JsBarcode = (await import('jsbarcode')).default;
    const settings = useSettingsStore.getState();
    const renderMode = settings.printer?.barcodeRenderMode ?? 'svg';

    // ✅ UKURAN KOMPAK UNTUK THERMAL 58MM
    const CONTAINER_WIDTH = 130;
    const BAR_WIDTH = 0.8;
    const BAR_HEIGHT = 22;
    const FONT_SIZE = 8;

    const wrapperStyle = `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:white;padding:1px;width:100%;max-width:${CONTAINER_WIDTH}px;margin:0 auto;overflow:hidden;`;
    const nameDisplay = productName ? `<div style="font-size:6px;font-weight:bold;text-align:center;margin-top:1px;padding:0 1px;word-break:break-word;max-width:${CONTAINER_WIDTH}px;line-height:1.1;">${productName.toUpperCase()}</div>` : '';
    const priceDisplay = price && price > 0 ? `<div style="font-size:7px;font-weight:900;text-align:center;margin-top:0;color:#059669;">Rp ${price.toLocaleString('id-ID')}</div>` : '';

    if (renderMode === 'png') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak didukung');
      canvas.width = CONTAINER_WIDTH;
      canvas.height = 45;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      JsBarcode(canvas, code, { format: 'CODE128', width: BAR_WIDTH, height: BAR_HEIGHT, displayValue: true, fontSize: FONT_SIZE, font: 'monospace', textMargin: 0, margin: 2, background: '#FFFFFF', lineColor: '#000000' });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      return `<div style="${wrapperStyle}"><img src="${barcodeDataUrl}" alt="Barcode ${code}" style="display:block;max-width:100%;height:auto;background-color:white;" />${nameDisplay}${priceDisplay}</div>`;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, code, { format: 'CODE128', width: BAR_WIDTH, height: BAR_HEIGHT, displayValue: true, fontSize: FONT_SIZE, font: 'monospace', textMargin: 0, margin: 2, background: '#FFFFFF', lineColor: '#000000' });
    const svgEl = svg as unknown as SVGSVGElement;
    const vb = svgEl.getAttribute('viewBox') || `0 0 ${CONTAINER_WIDTH} 40`;
    const svgMarkup = svg.outerHTML.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '').replace('<svg', `<svg viewBox="${vb}" style="width:100%;height:auto;max-width:${CONTAINER_WIDTH}px;display:block;"`);
    return `<div style="${wrapperStyle}"><div style="width:100%;overflow:hidden;text-align:center;">${svgMarkup}</div>${nameDisplay}${priceDisplay}</div>`;
  }

  // 🔴 Helper: ambil lebar kertas printer dari settings (58mm / 80mm / auto)
  private _getPaperWidth(): number {
    const settings = useSettingsStore.getState();
    return settings.printer?.paperWidthMm || 58;
  }

  async generateBarcodePrintHtml(code: string, productName?: string, price?: number): Promise<string> {
    const barcodeHtml = await this.generateBarcodeHtml(code, productName, price);
    const paperWidth = this._getPaperWidth();
    return `<!DOCTYPE html><html><head><title>Cetak Barcode</title><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{margin:0;size:${paperWidth}mm auto;}html,body{margin:0;padding:0;width:${paperWidth}mm;background:white;}body{font-family:'Courier New',monospace;}svg{width:100% !important;height:auto !important;shape-rendering:crispEdges;}.label{padding:1mm 2mm;}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{padding:0;}}</style></head><body><div class="label">${barcodeHtml}</div><script>(function(){function doPrint(){try{window.focus();window.print();}catch(e){}}window.onload=function(){setTimeout(doPrint,50);};var mq=window.matchMedia('print');mq.addListener(function(mql){if(!mql.matches){setTimeout(function(){window.close();},50);}});})();<\/script></body></html>`;
  }

  async generateMultiBarcodePrintHtml(items: Array<{ code: string; productName?: string; price?: number }>): Promise<string> {
    const labelsHtml = await Promise.all(items.map(async (item) => {
      const barcodeHtml = await this.generateBarcodeHtml(item.code, item.productName, item.price);
      return `<div class="label">${barcodeHtml}</div>`;
    }));
    const paperWidth = this._getPaperWidth();
    return `<!DOCTYPE html><html><head><title>Cetak Barcode Massal</title><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}@page{margin:0;size:${paperWidth}mm auto;}html,body{margin:0;padding:0;width:${paperWidth}mm;background:white;}body{font-family:'Courier New',monospace;}svg{width:100% !important;height:auto !important;shape-rendering:crispEdges;}.label{padding:1mm 2mm;page-break-after:always;}.label:last-child{page-break-after:avoid;}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{padding:0;}}</style></head><body>${labelsHtml.join('\n')}<script>(function(){function doPrint(){try{window.focus();window.print();}catch(e){}}window.onload=function(){setTimeout(doPrint,80);};var mq=window.matchMedia('print');mq.addListener(function(mql){if(!mql.matches){setTimeout(function(){window.close();},50);}});})();<\/script></body></html>`;
  }

  /**
   * Deteksi apakah berjalan di platform Android.
   */
  private _isAndroidPlatform(): boolean {
    return navigator.userAgent.toLowerCase().includes('android');
  }

  /**
   * Cetak barcode via RawBT di Android.
   * Mengirim teks barcode (bukan HTML) ke aplikasi RawBT.
   * Menggunakan overlay dengan tombol user-click untuk bypass
   * pemblokiran custom scheme oleh browser.
   */
  private _printViaRawBT(code: string, productName?: string, price?: number): void {
    const lines: string[] = [];
    lines.push('BARCODE');
    lines.push('='.repeat(32));
    lines.push(`Kode: ${code}`);
    if (productName) lines.push(`Produk: ${productName}`);
    if (price && price > 0) lines.push(`Harga: Rp ${price.toLocaleString('id-ID')}`);
    lines.push('-'.repeat(32));
    lines.push('');

    const text = lines.join('\n');
    const base64 = btoa(unescape(encodeURIComponent(text)));
    const rawbtUri = "rawbt:base64," + base64;

    console.log("Mengirim barcode ke RawBT...");

    // Coba Tier 1: window.open langsung (user gesture dari tombol cetak)
    try {
      var opened = window.open(rawbtUri, '_blank');
      if (opened) {
        setTimeout(() => { try { opened.close(); } catch(_) {} }, 3000);
        return;
      }
    } catch (_) {}

    // Coba Tier 2: redirect location
    try {
      window.location.href = rawbtUri;
      setTimeout(() => {
        this._showRawBtBarcodeOverlay(text, rawbtUri);
      }, 500);
      return;
    } catch (_) {}

    // Tier 3: Overlay manual
    this._showRawBtBarcodeOverlay(text, rawbtUri);
  }

  /**
   * Tampilkan overlay untuk cetak barcode via RawBT.
   */
  private _showRawBtBarcodeOverlay(barcodeText: string, rawbtUri: string): void {
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
            🏷️ Cetak Barcode via RawBT
          </h3>
          <p style="font-size:12px;color:#666;text-align:center;margin:0 0 12px;">
            Aplikasi RawBT akan terbuka untuk mencetak barcode.
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
          ">📋 Copy & Buka RawBT</button>
          
          <textarea id="rawbt-text" readonly style="
            width:100%;height:100px;font-family:'Courier New',monospace;
            font-size:10px;padding:8px;border:1px solid #ddd;
            border-radius:6px;resize:none;background:#f9f9f9;
            white-space:pre;overflow-y:auto;
          ">${barcodeText}</textarea>
          
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

    document.getElementById('rawbt-open-btn')?.addEventListener('click', function() {
      try { window.open(rawbtUri, '_blank'); } catch (_) {
        try { window.location.href = rawbtUri; } catch (_2) {}
      }
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    });

    document.getElementById('rawbt-copy-btn')?.addEventListener('click', function() {
      var textarea = document.getElementById('rawbt-text') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        try {
          navigator.clipboard.writeText(barcodeText).then(function() {
            alert('✅ Teks barcode berhasil di-copy!\n\nBuka RawBT dan paste untuk mencetak.');
          }).catch(function() { document.execCommand('copy'); });
        } catch (_) { try { document.execCommand('copy'); } catch(_2) {} }
      }
      try { window.open(rawbtUri, '_blank'); } catch (_) {
        try { window.location.href = rawbtUri; } catch (_2) {}
      }
    });

    document.getElementById('rawbt-close-btn')?.addEventListener('click', function() {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    });
  }

  async printSingleBarcode(code: string, productName?: string, price?: number): Promise<void> {
    if (this._isAndroidPlatform()) {
      this._printViaRawBT(code, productName, price);
      return;
    }
    const htmlContent = await this.generateBarcodePrintHtml(code, productName, price);
    this._openPrintPopup(htmlContent);
  }

  async printMultipleBarcodes(items: Array<{ code: string; productName?: string; price?: number }>): Promise<void> {
    if (this._isAndroidPlatform()) {
      // Untuk multi barcode di Android, cetak satu per satu via RawBT
      for (const item of items) {
        this._printViaRawBT(item.code, item.productName, item.price);
        // Beri jeda antar cetakan
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }
    const htmlContent = await this.generateMultiBarcodePrintHtml(items);
    this._openPrintPopup(htmlContent);
  }

  private _openPrintPopup(htmlContent: string): void {
    var popup = window.open('', '_blank', 'width=380,height=500,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=no');
    if (!popup) { console.warn('Popup diblokir, fallback ke iframe...'); this._printViaIframe(htmlContent); return; }
    try { popup.document.open(); popup.document.write(htmlContent); popup.document.close(); }
    catch (e) { console.warn('Gagal nulis ke popup, fallback ke iframe...', e); popup.close(); this._printViaIframe(htmlContent); }
  }

  private _printViaIframe(htmlContent: string): void {
    var iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '58mm'; iframe.style.height = '0';
    iframe.style.border = '0'; iframe.style.left = '-9999px'; iframe.style.top = '-9999px';
    document.body.appendChild(iframe);
    var doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(htmlContent); doc.close();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 45000);
  }

  async previewBarcode(code: string, productName?: string, price?: number): Promise<string> {
    return this.generateBarcodeHtml(code, productName, price);
  }
}

export const barcodeService = new BarcodeService();