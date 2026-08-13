/**
 * Script untuk mengisi harga dan stok pada file products-data.json (50.601 produk)
 * dengan logic yang sama seperti update-prices.cjs dan update-stock.cjs
 */
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'public', 'products-data.json');
console.log('📂 Membaca file...');
const raw = fs.readFileSync(FILE_PATH, 'utf-8');
const products = JSON.parse(raw);
console.log(`📊 Total produk: ${products.length.toLocaleString('id-ID')}`);

// ====== FUNGSI HARGA (sama dengan update-prices.cjs) ======
function getPrice(name, category) {
  const upper = name.toUpperCase();
  let retail = 0, wholesale = 0;

  if (upper.includes('INDOMIE') || upper.includes('SARIMI') || upper.includes('SUPERMI')) {
    if (upper.includes('GORENG') || upper.includes('PEDAS') || upper.includes('CEPLOS')) { retail = 4000; wholesale = 3500; }
    else { retail = 3500; wholesale = 3000; }
    if (upper.includes('DUS') || upper.includes('ISI2') || upper.includes('ISI 2')) { retail = 6500; wholesale = 5800; }
  }
  else if (upper.includes('POP MIE') || upper.includes('POPMIE')) {
    if (upper.includes('MINI') || upper.includes('CUP')) { retail = 4000; wholesale = 3500; }
    else { retail = 6000; wholesale = 5300; }
  }
  else if (upper.includes('BUMBU RACIK')) { retail = 3000; wholesale = 2500; }
  else if (upper.includes('BUMBU INDOFOOD')) { retail = 4000; wholesale = 3500; }
  else if (upper.includes('FREISS') || upper.includes('SIRUP')) {
    if (upper.includes('500ML') || upper.includes('500 ML')) { retail = 25000; wholesale = 22000; }
    else { retail = 15000; wholesale = 13000; }
  }
  else if (upper.includes('SARUNG')) { retail = 150000; wholesale = 130000; }
  else if (upper.includes('BATIK') || upper.includes('P/CASE') || upper.includes('PCASE')) { retail = 75000; wholesale = 65000; }
  else if (upper.includes('KEMBANG API')) { retail = 15000; wholesale = 12000; }
  else if (upper.includes('KAOS KAKI') || upper.includes('STARWAY')) { retail = 12000; wholesale = 10000; }
  else if (upper.includes('SPIDOL')) { retail = 8000; wholesale = 7000; }
  else if (upper.includes('MAP FILE') || upper.includes('MAP')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('BUKU') || upper.includes('NOTES')) {
    if (upper.includes('MEWARNAI')) { retail = 10000; wholesale = 8000; }
    else { retail = 8000; wholesale = 6500; }
  }
  else if (upper.includes('SANDAL')) { retail = 25000; wholesale = 20000; }
  else if (upper.includes('VOS') || upper.includes('L LEAF')) { retail = 7000; wholesale = 5500; }
  else if (upper.includes('REYNOLDS') || upper.includes('ALUMINIUM') || upper.includes('SAMPLER') || upper.includes('DAIMOND')) {
    if (upper.includes('16M') || upper.includes('8M')) { retail = 35000; wholesale = 30000; }
    else if (upper.includes('5M') || upper.includes('ZIPPER') || upper.includes('ZIPER')) { retail = 25000; wholesale = 22000; }
    else if (upper.includes('WAX')) { retail = 28000; wholesale = 25000; }
    else { retail = 20000; wholesale = 17000; }
  }
  else if (upper.includes('PULPEN') || upper.includes('AE 7')) { retail = 3000; wholesale = 2500; }
  else if (upper.includes('DUA KELINCI') || upper.includes('DK KACANG') || upper.includes('SARI GURIH') || upper.includes('KACANG')) {
    if (upper.includes('1000 GR') || upper.includes('1KG') || upper.includes('500 GR') || upper.includes('500G')) { retail = 45000; wholesale = 40000; }
    else if (upper.includes('250G') || upper.includes('250 GR')) { retail = 25000; wholesale = 22000; }
    else if (upper.includes('100G') || upper.includes('100 GR')) { retail = 12000; wholesale = 10000; }
    else if (upper.includes('65G') || upper.includes('43G') || upper.includes('36G')) { retail = 5000; wholesale = 4000; }
    else { retail = 15000; wholesale = 13000; }
  }
  else if (upper.includes('REGE') || upper.includes('DOUBLE RABBIT') || upper.includes('SUKRO') || upper.includes('GARING')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('FINNA') || upper.includes('KRUPUK')) { retail = 15000; wholesale = 13000; }
  else if (upper.includes('GARAM') || upper.includes('DOLPHIN')) {
    if (upper.includes('1KG') || upper.includes('1 KG')) { retail = 12000; wholesale = 10000; }
    else if (upper.includes('500G') || upper.includes('500 GR')) { retail = 7000; wholesale = 6000; }
    else { retail = 5000; wholesale = 4000; }
  }
  else if (upper.includes('PONDS') || upper.includes('POND')) { retail = 15000; wholesale = 13000; }
  else if (upper.includes('PASEO') || upper.includes('TISSUE')) { retail = 35000; wholesale = 30000; }
  else if (upper.includes('HUGO') || upper.includes('PARFUM') || upper.includes('WOMAN')) { retail = 75000; wholesale = 65000; }
  else if (upper.includes('SATTO') || upper.includes('SLIM ESSENCE')) { retail = 12000; wholesale = 10000; }
  else if (upper.includes('EPSON') || upper.includes('CARTRI') || upper.includes('CARTG') || upper.includes('CARTID') || upper.includes('RBON')) { retail = 85000; wholesale = 75000; }
  else if (upper.includes('E-PRINT') || upper.includes('EPRINT')) { retail = 70000; wholesale = 62000; }
  else if (upper.includes('ALPO') || upper.includes('DOG')) {
    if (upper.includes('623G') || upper.includes('623 GR')) { retail = 45000; wholesale = 40000; }
    else { retail = 28000; wholesale = 25000; }
  }
  else if (upper.includes('TABASCO') || upper.includes('MOREHOUSE') || upper.includes('MUSTARD')) {
    if (upper.includes('350ML') || upper.includes('567G')) { retail = 85000; wholesale = 75000; }
    else if (upper.includes('150ML')) { retail = 55000; wholesale = 48000; }
    else { retail = 35000; wholesale = 30000; }
  }
  else if (upper.includes('GELAS SET') || upper.includes('CM GELAS')) { retail = 50000; wholesale = 42000; }
  else if (upper.includes('MARTINI')) { retail = 150000; wholesale = 130000; }
  else if (upper.includes('LEM')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('JALAPENOS')) { retail = 35000; wholesale = 30000; }
  else if (upper.includes('CANDIES') || upper.includes('TYL') || upper.includes('PERMEN')) { retail = 15000; wholesale = 12000; }
  else if (upper.includes('SARIM SOTO') || upper.includes('SARIM  AYAM')) { retail = 3500; wholesale = 3000; }
  else if (upper.includes('AQUA') || upper.includes('LE MINERALE') || upper.includes('VIT') || upper.includes('AIR MINERAL') || upper.includes('AIR MINUM')) {
    if (upper.includes('1500ML') || upper.includes('1500 ML') || upper.includes('1.5L')) { retail = 7000; wholesale = 6000; }
    else if (upper.includes('600ML') || upper.includes('600 ML')) { retail = 4000; wholesale = 3500; }
    else { retail = 3000; wholesale = 2500; }
  }
  else if (upper.includes('KOPI') || upper.includes('COFFEE')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('TEH') || upper.includes('TEA')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('SUSU') || upper.includes('MILK') || upper.includes('UHT')) { retail = 12000; wholesale = 10000; }
  else if (upper.includes('ROKOK') || upper.includes('SIGARET') || upper.includes('MARLBORO') || upper.includes('SAMPURNA') || upper.includes('DJI SAM SOE') || upper.includes('GUDANG GARAM') || upper.includes('DUNHILL') || upper.includes('ESSE')) {
    if (upper.includes('FILTER') || upper.includes('KRETEK')) { retail = 45000; wholesale = 42000; }
    else { retail = 40000; wholesale = 37000; }
  }
  else if (upper.includes('BIMOLI') || upper.includes('MINYAK') || upper.includes('GORENG') && (upper.includes('BIMOLI')||upper.includes('FILMA')||upper.includes('SUNCO')||upper.includes('TROPIC')||upper.includes('SANIA')||upper.includes('FORTUNE'))) {
    if (upper.includes('2L')||upper.includes('2 L')||upper.includes('2000ML')) { retail = 45000; wholesale = 40000; }
    else if (upper.includes('1L')||upper.includes('1 L')||upper.includes('1000ML')) { retail = 25000; wholesale = 22000; }
    else { retail = 15000; wholesale = 13000; }
  }
  else if (upper.includes('BERAS') || upper.includes('RICE')) {
    if (upper.includes('5KG')||upper.includes('5 KG')) { retail = 75000; wholesale = 70000; }
    else if (upper.includes('10KG')||upper.includes('10 KG')) { retail = 145000; wholesale = 140000; }
    else if (upper.includes('25KG')||upper.includes('25 KG')) { retail = 350000; wholesale = 340000; }
    else { retail = 15000; wholesale = 14000; }
  }
  else if (upper.includes('GULA') || upper.includes('SUGAR')) {
    if (upper.includes('1KG')||upper.includes('1 KG')) { retail = 20000; wholesale = 18000; }
    else { retail = 10000; wholesale = 9000; }
  }
  else if (upper.includes('TELUR') || upper.includes('EGG')) {
    retail = 30000; wholesale = 28000;
  }
  else if (upper.includes('MIE') || upper.includes('MI INSTAN') || upper.includes('PASTA')) { retail = 5000; wholesale = 4000; }
  else if (upper.includes('SHAMPO') || upper.includes('SAMPING') || upper.includes('PANTENE') || upper.includes('SUNSILK') || upper.includes('LIFEBUOY') || upper.includes('DOVE') || upper.includes('CLEAR') || upper.includes('REJOICE')) { retail = 15000; wholesale = 13000; }
  else if (upper.includes('SABUN') || upper.includes('SOAP') || upper.includes('LUX') || upper.includes('GIV') || upper.includes('NUROSE') || upper.includes('DETTOL')) { retail = 8000; wholesale = 7000; }
  else if (upper.includes('PASTA GIGI') || upper.includes('PEPASODENT') || upper.includes('PEPSODENT') || upper.includes('CLOSE UP') || upper.includes('FORMULA') || upper.includes('SENSODYNE') || upper.includes('COATGATE') || upper.includes('COLGATE')) { retail = 12000; wholesale = 10000; }
  else if (upper.includes('DETERJEN') || upper.includes('RINSO') || upper.includes('ATTACK') || upper.includes('DAIA') || upper.includes('BOKS') || upper.includes('SO KLIN') || upper.includes('DOWNY') || upper.includes('MOLTO')) { retail = 25000; wholesale = 22000; }

  // Default berdasarkan kategori
  else if (category === 'Makanan') { retail = 5000; wholesale = 4000; }
  else if (category === 'Minuman') { retail = 15000; wholesale = 13000; }
  else if (category === 'Alat Tulis') { retail = 8000; wholesale = 6500; }
  else if (category === 'Kosmetik') { retail = 20000; wholesale = 17000; }
  else if (category === 'Rokok') { retail = 40000; wholesale = 37000; }
  else if (category === 'Sembako') { retail = 15000; wholesale = 13000; }
  else if (category === 'Minuman Ringan') { retail = 7000; wholesale = 6000; }
  else if (category === 'Makanan Ringan') { retail = 5000; wholesale = 4000; }
  else if (category === 'Perawatan Tubuh') { retail = 15000; wholesale = 13000; }
  else if (category === 'Pembersih') { retail = 25000; wholesale = 22000; }
  else { retail = 25000; wholesale = 20000; }

  return { retail, wholesale };
}

// ====== FUNGSI STOK (sama dengan update-stock.cjs) ======
function getStock(name, category) {
  const upper = name.toUpperCase();

  if (upper.includes('INDOMIE') || upper.includes('SARIMI') || upper.includes('SUPERMI') || upper.includes('POP MIE') || upper.includes('POPMIE')) {
    if (upper.includes('DUS') || upper.includes('ISI2') || upper.includes('ISI 2')) return 24;
    return 60;
  }
  if (upper.includes('BUMBU') || upper.includes('RACIK') || upper.includes('INDOFOOD')) return 50;
  if (upper.includes('FREISS') || upper.includes('SIRUP')) return 20;
  if (upper.includes('AQUA') || upper.includes('LE MINERALE') || upper.includes('VIT') || upper.includes('AIR ')) {
    if (upper.includes('1500ML') || upper.includes('1500') || upper.includes('1.5L')) return 24;
    if (upper.includes('600ML') || upper.includes('600')) return 36;
    return 48;
  }
  if (upper.includes('KACANG') || upper.includes('DUA KELINCI') || upper.includes('SARI GURIH') || 
      upper.includes('REGE') || upper.includes('DOUBLE RABBIT') || upper.includes('SUKRO') || 
      upper.includes('GARING') || upper.includes('FINNA') || upper.includes('KRUPUK')) {
    if (upper.includes('1000 GR') || upper.includes('1KG') || upper.includes('500 GR') || upper.includes('500G')) return 15;
    return 30;
  }
  if (upper.includes('GARAM') || upper.includes('DOLPHIN')) {
    if (upper.includes('1KG') || upper.includes('1 KG')) return 20;
    return 30;
  }
  if (upper.includes('SARUNG')) return 12;
  if (upper.includes('BATIK') || upper.includes('P/CASE') || upper.includes('PCASE')) return 10;
  if (upper.includes('KAOS KAKI') || upper.includes('STARWAY')) return 25;
  if (upper.includes('BUKU') || upper.includes('PULPEN') || upper.includes('AE 7') || 
      upper.includes('SPIDOL') || upper.includes('MAP') || upper.includes('NOTES') ||
      upper.includes('VOS') || upper.includes('L LEAF')) return 40;
  if (upper.includes('SANDAL')) return 15;
  if (upper.includes('KEMBANG API') || upper.includes('OLYMPIC')) return 10;
  if (upper.includes('REYNOLDS') || upper.includes('ALUMINIUM') || upper.includes('SAMPLER') || 
      upper.includes('DAIMOND') || upper.includes('ZIPPER') || upper.includes('ZIPER') || upper.includes('WAX')) return 15;
  if (upper.includes('PASEO') || upper.includes('TISSUE')) return 18;
  if (upper.includes('PONDS') || upper.includes('POND') || upper.includes('SATTO') || 
      upper.includes('SLIM ESSENCE') || upper.includes('HUGO') || upper.includes('PARFUM')) return 10;
  if (upper.includes('ALPO') || upper.includes('DOG')) {
    if (upper.includes('623G') || upper.includes('623 GR')) return 8;
    return 12;
  }
  if (upper.includes('EPSON') || upper.includes('CARTRI') || upper.includes('CARTG') || 
      upper.includes('CARTID') || upper.includes('RBON') || upper.includes('E-PRINT') || upper.includes('EPRINT')) return 5;
  if (upper.includes('TABASCO') || upper.includes('MOREHOUSE') || upper.includes('MUSTARD')) return 12;
  if (upper.includes('GELAS SET') || upper.includes('CM GELAS')) return 8;
  if (upper.includes('LEM') || upper.includes('CASTOL')) return 30;
  if (upper.includes('JALAPENOS')) return 10;
  if (upper.includes('CANDIES') || upper.includes('TYL') || upper.includes('PERMEN')) return 40;
  if (upper.includes('MARTINI')) return 5;
  if (upper.includes('ROKOK') || upper.includes('SIGARET') || upper.includes('MARLBORO') || 
      upper.includes('SAMPURNA') || upper.includes('DJI SAM SOE') || upper.includes('GUDANG GARAM') || 
      upper.includes('DUNHILL') || upper.includes('ESSE')) return 30;
  if (upper.includes('BERAS') || upper.includes('RICE')) {
    if (upper.includes('25KG')||upper.includes('25 KG')) return 5;
    if (upper.includes('10KG')||upper.includes('10 KG')) return 10;
    return 20;
  }
  if (upper.includes('GULA') || upper.includes('SUGAR')) return 20;
  if (upper.includes('TELUR') || upper.includes('EGG')) return 30;
  if (upper.includes('MINYAK') || upper.includes('GORENG') || upper.includes('BIMOLI') || 
      upper.includes('FILMA') || upper.includes('SUNCO') || upper.includes('TROPIC') || 
      upper.includes('SANIA') || upper.includes('FORTUNE')) return 20;
  if (upper.includes('KOPI') || upper.includes('COFFEE')) return 25;
  if (upper.includes('TEH') || upper.includes('TEA')) return 25;
  if (upper.includes('SUSU') || upper.includes('MILK') || upper.includes('UHT')) return 15;
  if (upper.includes('SHAMPO') || upper.includes('SAMPING') || upper.includes('PANTENE') || 
      upper.includes('SUNSILK') || upper.includes('LIFEBUOY') || upper.includes('DOVE') || 
      upper.includes('CLEAR') || upper.includes('REJOICE')) return 20;
  if (upper.includes('SABUN') || upper.includes('SOAP') || upper.includes('LUX') || 
      upper.includes('GIV') || upper.includes('NUROSE') || upper.includes('DETTOL') || 
      upper.includes('LIFEBUOY')) return 30;
  if (upper.includes('PASTA GIGI') || upper.includes('PEPASODENT') || upper.includes('PEPSODENT') || 
      upper.includes('CLOSE UP') || upper.includes('FORMULA') || upper.includes('SENSODYNE') || 
      upper.includes('COATGATE') || upper.includes('COLGATE')) return 25;
  if (upper.includes('DETERJEN') || upper.includes('RINSO') || upper.includes('ATTACK') || 
      upper.includes('DAIA') || upper.includes('BOKS') || upper.includes('SO KLIN') || 
      upper.includes('DOWNY') || upper.includes('MOLTO')) return 20;
  if (upper.includes('MIE') || upper.includes('MI INSTAN') || upper.includes('PASTA')) return 40;

  if (category === 'Makanan' || category === 'Makanan Ringan') return 40;
  if (category === 'Minuman' || category === 'Minuman Ringan') return 25;
  if (category === 'Alat Tulis') return 35;
  if (category === 'Kosmetik' || category === 'Perawatan Tubuh') return 12;
  if (category === 'Rokok') return 30;
  if (category === 'Sembako') return 20;
  if (category === 'Pembersih') return 20;
  
  return 15;
}

function getMinStock(stock) {
  return Math.max(2, Math.round(stock * 0.25));
}

// ====== PROSES ======
let updatedPrices = 0, updatedStock = 0;
const batchSize = 10000;
const total = products.length;

console.log('⏳ Memproses...');

products.forEach((product, i) => {
  // Update harga jika masih 0
  if (!product.priceRetail || product.priceRetail === 0 || !product.priceWholesale || product.priceWholesale === 0) {
    const { retail, wholesale } = getPrice(product.name, product.category);
    product.priceRetail = retail;
    product.priceWholesale = wholesale;
    updatedPrices++;
  }
  
  // Update stok jika masih 0
  if (!product.stock || product.stock === 0) {
    const stock = getStock(product.name, product.category);
    product.stock = stock;
    product.min_stock = getMinStock(stock);
    updatedStock++;
  }

  // Progress setiap 10.000 produk
  if ((i + 1) % batchSize === 0) {
    console.log(`  ⏳ ${(i + 1).toLocaleString('id-ID')}/${total.toLocaleString('id-ID')} produk diproses...`);
  }
});

// Simpan
console.log('💾 Menyimpan file...');
fs.writeFileSync(FILE_PATH, JSON.stringify(products, null, 2), 'utf-8');
console.log('✅ Selesai!');
console.log(`📈 Total produk: ${total.toLocaleString('id-ID')}`);
console.log(`💰 Harga diperbarui: ${updatedPrices.toLocaleString('id-ID')} produk`);
console.log(`📦 Stok diisi: ${updatedStock.toLocaleString('id-ID')} produk`);

// Tampilkan sample
console.log('\n📋 Sample hasil:');
products.slice(0, 5).forEach(p => {
  console.log(`  - ${p.name}: Rp${p.priceRetail.toLocaleString('id-ID')} (ecer), Rp${p.priceWholesale.toLocaleString('id-ID')} (grosir), stok=${p.stock}, min=${p.min_stock}`);
});