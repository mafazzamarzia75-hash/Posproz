const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');

const inputFile = path.join(__dirname, 'dataproduk.xlsx');
const outputFile = path.join(__dirname, 'public', 'products-data.json');

console.log('📂 Reading file:', inputFile);

if (!fs.existsSync(inputFile)) {
  console.error('❌ File not found:', inputFile);
  process.exit(1);
}

// Security checks / mitigations before parsing
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB max
const stats = fs.statSync(inputFile);
if (stats.size > MAX_FILE_BYTES) {
  console.error(`❌ File terlalu besar (${stats.size} bytes). Batasi ukuran <= ${MAX_FILE_BYTES} bytes.`);
  process.exit(1);
}

// Quick magic-bytes check: .xlsx is a zip file starting with PK (0x50 0x4B)
const fd = fs.openSync(inputFile, 'r');
const header = Buffer.alloc(4);
fs.readSync(fd, header, 0, 4, 0);
fs.closeSync(fd);
if (header[0] !== 0x50 || header[1] !== 0x4B) {
  console.error('❌ File bukan .xlsx (tidak ditemukan signature PK). Pastikan file valid.');
  process.exit(1);
}

// Read workbook using exceljs (safer choice for server-side conversion)
async function readWorkbook(filePath) {
  const workbook = new Excel.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (e) {
    console.error('❌ Gagal membaca file Excel dengan exceljs:', e && e.message ? e.message : e);
    process.exit(1);
  }
  return workbook;
}

let workbook = null;
(async () => {
  workbook = await readWorkbook(inputFile);
  const worksheet = workbook.worksheets[0];

  // Convert worksheet rows to simple array-of-arrays (header at index 0)
  const data = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // row.values is 1-based index; normalize to 0-based array
    const vals = [];
    for (let i = 1; i < row.values.length; i++) {
      vals.push(row.values[i]);
    }
    data.push(vals);
  });

  // Validate header row to ensure expected columns exist
  const headerRow = Array.isArray(data[0]) ? data[0].map(h => String(h || '').toLowerCase()) : [];
  const requiredKeywords = ['kode', 'barcode', 'nama'];
  const missing = requiredKeywords.filter(k => !headerRow.some(h => h.includes(k)));
  if (missing.length > 0) {
    console.error('❌ Header sheet tidak sesuai. Kolom yang diharapkan hilang:', missing.join(', '));
    console.error('Header terdeteksi:', JSON.stringify(headerRow));
    process.exit(1);
  }

  // Defensive limits: avoid processing extremely large or malicious sheets
  const MAX_ROWS = 20000;
  if (data.length > MAX_ROWS) {
    console.warn(`⚠️ Sheet memiliki ${data.length} baris — hanya memproses ${MAX_ROWS} baris pertama.`);
    data.splice(MAX_ROWS); // truncate in-place
  }

  console.log(`✅ Sheet loaded, rows: ${data.length}`);

  // Skip header row (KODE ITEM, BARCODE, NAMA ITEM)
  const products = [];
  let skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    // Sanitize cell values and limit length to avoid prototype pollution / ReDoS
    const safeCell = (v) => {
      let s = String(v || '');
      if (s.length > 500) s = s.slice(0, 500);
      return s.trim();
    };

    const kodeItem = safeCell(row[0]);
    const barcode = safeCell(row[1]);
    const namaItem = safeCell(row[2]);

  if (!namaItem && !kodeItem) {
    skipped++;
    continue;
  }

  // Use barcode or kodeItem as SKU
  const sku = barcode || kodeItem;

  // Determine category based on item name keywords
  let category = 'Umum';
  const nameLower = namaItem.toLowerCase();
  if (nameLower.includes('mie') || nameLower.includes('soto') || nameLower.includes('goreng') || nameLower.includes('kari') || nameLower.includes('ayam') || nameLower.includes('sapi') || nameLower.includes('bumbu') || nameLower.includes('saos') || nameLower.includes('saus') || nameLower.includes('minyak') || nameLower.includes('beras') || nameLower.includes('gula') || nameLower.includes('tepung') || nameLower.includes('kecap')) {
    category = 'Makanan';
  } else if (nameLower.includes('susu') || nameLower.includes('teh') || nameLower.includes('kopi') || nameLower.includes('minuman') || nameLower.includes('jus') || nameLower.includes('sirup') || nameLower.includes('aqua') || nameLower.includes('vit') || nameLower.includes('cola') || nameLower.includes('sprite') || nameLower.includes('pepsi') || nameLower.includes('bir') || nameLower.includes('anggur') || nameLower.includes('soda')) {
    category = 'Minuman';
  } else if (nameLower.includes('sabun') || nameLower.includes('shampoo') || nameLower.includes('pasta gigi') || nameLower.includes('sikat gigi') || nameLower.includes('deodorant') || nameLower.includes('lotion') || nameLower.includes('parfum') || nameLower.includes('minyak wangi') || nameLower.includes('kosmetik') || nameLower.includes('bedak') || nameLower.includes('lipstik') || nameLower.includes('cushion')) {
    category = 'Kosmetik';
  } else if (nameLower.includes('pampers') || nameLower.includes('popok') || nameLower.includes('diaper')) {
    category = 'Bayi';
  } else if (nameLower.includes('obat') || nameLower.includes('vitamin')) {
    category = 'Obat';
  } else if (nameLower.includes('buku') || nameLower.includes('pulpen') || nameLower.includes('pensil') || nameLower.includes('penghapus') || nameLower.includes('penggaris') || nameLower.includes('kertas') || nameLower.includes('map') || nameLower.includes('kalkulator') || nameLower.includes('stapler')) {
    category = 'Alat Tulis';
  } else if (nameLower.includes('rokok') || nameLower.includes('cigarette') || nameLower.includes('sigaret')) {
    category = 'Rokok';
  } else if (nameLower.includes('listrik') || nameLower.includes('batre') || nameLower.includes('baterai') || nameLower.includes('lampu') || nameLower.includes('kabel')) {
    category = 'Elektronik';
  }

  products.push({
    name: namaItem,
    sku: sku,
    barcode: barcode || sku,
    category: category,
    priceRetail: 0,
    priceWholesale: 0,
    stock: 0,
    min_stock: 0
  });
}
  const jsonContent = JSON.stringify(products, null, 2);
  fs.writeFileSync(outputFile, jsonContent, 'utf-8');

  console.log(`\n✅ Conversion complete!`);
  console.log(`   Total products: ${products.length}`);
  console.log(`   Skipped rows: ${skipped}`);
  console.log(`   Output file: ${outputFile}`);
  console.log(`\n📊 Category breakdown:`);

  const categoryCount = {};
  products.forEach(p => {
    categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
  });
  Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}`);
  });
})();