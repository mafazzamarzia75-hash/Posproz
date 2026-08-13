/**
 * Script untuk mengisi stok awal (restock) pada semua produk di DefaultData.json
 * berdasarkan nama/kategori produk dengan jumlah yang realistis untuk toko kelontong.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'src', 'services', 'db', 'DefaultData.json');
const raw = fs.readFileSync(DATA_PATH, 'utf-8');
const data = JSON.parse(raw);
const products = data.data.products;

function getStock(name, category) {
  const upper = name.toUpperCase();

  // MIE INSTAN - stok banyak karena fast moving
  if (upper.includes('INDOMIE') || upper.includes('SARIMI') || upper.includes('SUPERMI') || upper.includes('POP MIE') || upper.includes('POPMIE')) {
    if (upper.includes('DUS') || upper.includes('ISI2') || upper.includes('ISI 2')) {
      return 24; // 1 dus isi 24 pcs
    }
    return 60; // stok banyak
  }

  // BUMBU INSTAN - fast moving
  if (upper.includes('BUMBU') || upper.includes('RACIK') || upper.includes('INDOFOOD')) {
    return 50;
  }

  // MINUMAN SIRUP
  if (upper.includes('FREISS') || upper.includes('SIRUP')) {
    return 20;
  }

  // MAKANAN RINGAN (KACANG, KRUPUK dll)
  if (upper.includes('KACANG') || upper.includes('DUA KELINCI') || upper.includes('SARI GURIH') || 
      upper.includes('REGE') || upper.includes('DOUBLE RABBIT') || upper.includes('SUKRO') || 
      upper.includes('GARING') || upper.includes('FINNA') || upper.includes('KRUPUK')) {
    if (upper.includes('1000 GR') || upper.includes('1KG') || upper.includes('500 GR') || upper.includes('500G')) {
      return 15;
    }
    return 30;
  }

  // GARAM
  if (upper.includes('GARAM') || upper.includes('DOLPHIN')) {
    if (upper.includes('1KG') || upper.includes('1 KG')) {
      return 20;
    }
    return 30;
  }

  // SARUNG
  if (upper.includes('SARUNG')) {
    return 12;
  }

  // PAKAIAN / BATIK
  if (upper.includes('BATIK') || upper.includes('P/CASE') || upper.includes('PCASE')) {
    return 10;
  }

  // KAOS KAKI
  if (upper.includes('KAOS KAKI') || upper.includes('STARWAY')) {
    return 25;
  }

  // ALAT TULIS (BUKU, PULPEN, SPIDOL, MAP, NOTES)
  if (upper.includes('BUKU') || upper.includes('PULPEN') || upper.includes('AE 7') || 
      upper.includes('SPIDOL') || upper.includes('MAP') || upper.includes('NOTES') ||
      upper.includes('VOS') || upper.includes('L LEAF')) {
    return 40;
  }

  // SANDAL
  if (upper.includes('SANDAL')) {
    return 15;
  }

  // KEMBANG API (musiman)
  if (upper.includes('KEMBANG API') || upper.includes('OLYMPIC')) {
    return 10;
  }

  // WRAP / ALUMINIUM FOIL / ZIPPER
  if (upper.includes('REYNOLDS') || upper.includes('ALUMINIUM') || upper.includes('SAMPLER') || 
      upper.includes('DAIMOND') || upper.includes('ZIPPER') || upper.includes('ZIPER') || upper.includes('WAX')) {
    return 15;
  }

  // TISSUE / PASEO
  if (upper.includes('PASEO') || upper.includes('TISSUE')) {
    return 18;
  }

  // KOSMETIK
  if (upper.includes('PONDS') || upper.includes('POND') || upper.includes('SATTO') || 
      upper.includes('SLIM ESSENCE') || upper.includes('HUGO') || upper.includes('PARFUM')) {
    return 10;
  }

  // MAKANAN HEWAN (ALPO)
  if (upper.includes('ALPO') || upper.includes('DOG') || upper.includes('MAKANAN ANJING')) {
    if (upper.includes('623G') || upper.includes('623 GR')) {
      return 8;
    }
    return 12;
  }

  // EPSON / PRINT / TONER
  if (upper.includes('EPSON') || upper.includes('CARTRI') || upper.includes('CARTG') || 
      upper.includes('CARTID') || upper.includes('RBON') || upper.includes('E-PRINT') || upper.includes('EPRINT')) {
    return 5;
  }

  // TABASCO / SAOS
  if (upper.includes('TABASCO') || upper.includes('MOREHOUSE') || upper.includes('MUSTARD')) {
    return 12;
  }

  // GELAS SET
  if (upper.includes('GELAS SET') || upper.includes('CM GELAS')) {
    return 8;
  }

  // LEM
  if (upper.includes('LEM') || upper.includes('CASTOL')) {
    return 30;
  }

  // JALAPENOS
  if (upper.includes('JALAPENOS')) {
    return 10;
  }

  // CANDIES / PERMEN
  if (upper.includes('CANDIES') || upper.includes('TYL') || upper.includes('PERMEN')) {
    return 40;
  }

  // MARTINI (alkohol - stok terbatas)
  if (upper.includes('MARTINI')) {
    return 5;
  }

  // Default berdasarkan kategori
  if (category === 'Makanan') return 40;
  if (category === 'Minuman') return 25;
  if (category === 'Alat Tulis') return 35;
  if (category === 'Kosmetik') return 12;
  
  // Umum
  return 15;
}

// Hitung min_stock (biasanya 20-30% dari stok)
function getMinStock(stock) {
  return Math.max(2, Math.round(stock * 0.25));
}

// Proses semua produk
let updated = 0;
products.forEach((product) => {
  if (product.stock === 0) {
    const stock = getStock(product.name, product.category);
    product.stock = stock;
    product.min_stock = getMinStock(stock);
    updated++;
  }
});

data.data.products = products;
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✅ ${updated} produk berhasil diisi stok awal (restock).`);
console.log(`📦 Total produk: ${products.length}`);

// Tampilkan sample
console.log('\n📋 Sample hasil restock:');
const samples = products.slice(0, 5).map(p => `${p.name}: stok=${p.stock}, min_stok=${p.min_stock}`);
samples.forEach(s => console.log(`  - ${s}`));