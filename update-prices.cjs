/**
 * Script untuk mengisi harga eceran (priceRetail) dan harga grosir (priceWholesale)
 * pada setiap produk di DefaultData.json berdasarkan keyword dan kategori.
 * 
 * Harga diisi dengan nilai realistis untuk toko kelontong/sembako.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'src', 'services', 'db', 'DefaultData.json');
const raw = fs.readFileSync(DATA_PATH, 'utf-8');
const data = JSON.parse(raw);
const products = data.data.products;

// Mapping harga berdasarkan keyword di nama produk
function getPrice(name, category) {
  const upper = name.toUpperCase();
  let retail = 0;
  let wholesale = 0;

  // ---- MAKANAN (MIE INSTAN) ----
  if (upper.includes('INDOMIE') || upper.includes('SARIMI') || upper.includes('SUPERMI')) {
    if (upper.includes('GORENG') || upper.includes('PEDAS') || upper.includes('CEPLOS')) {
      retail = 4000;
      wholesale = 3500;
    } else {
      retail = 3500;
      wholesale = 3000;
    }
    if (upper.includes('DUS') || upper.includes('ISI2') || upper.includes('ISI 2')) {
      retail = 6500;
      wholesale = 5800;
    }
  }
  else if (upper.includes('POP MIE') || upper.includes('POPMIE')) {
    if (upper.includes('MINI') || upper.includes('CUP')) {
      retail = 4000;
      wholesale = 3500;
    } else {
      retail = 6000;
      wholesale = 5300;
    }
  }
  // ---- BUMBU INSTAN ----
  else if (upper.includes('BUMBU RACIK')) {
    retail = 3000;
    wholesale = 2500;
  }
  else if (upper.includes('BUMBU INDOFOOD')) {
    retail = 4000;
    wholesale = 3500;
  }
  // ---- MINUMAN ----
  else if (upper.includes('FREISS') || upper.includes('SIRUP')) {
    if (upper.includes('500ML') || upper.includes('500 ML')) {
      retail = 25000;
      wholesale = 22000;
    } else {
      retail = 15000;
      wholesale = 13000;
    }
  }
  // ---- SARUNG ----
  else if (upper.includes('SARUNG')) {
    retail = 150000;
    wholesale = 130000;
  }
  // ---- PAKAIAN / BATIK ----
  else if (upper.includes('BATIK') || upper.includes('P/CASE') || upper.includes('PCASE')) {
    retail = 75000;
    wholesale = 65000;
  }
  // ---- KEMBANG API ----
  else if (upper.includes('KEMBANG API')) {
    retail = 15000;
    wholesale = 12000;
  }
  // ---- KAOS KAKI ----
  else if (upper.includes('KAOS KAKI') || upper.includes('STARWAY')) {
    retail = 12000;
    wholesale = 10000;
  }
  // ---- SPIDOL / MAP / BUKU (ALAT TULIS) ----
  else if (upper.includes('SPIDOL')) {
    retail = 8000;
    wholesale = 7000;
  }
  else if (upper.includes('MAP FILE') || upper.includes('MAP')) {
    retail = 5000;
    wholesale = 4000;
  }
  else if (upper.includes('BUKU') || upper.includes('NOTES')) {
    if (upper.includes('MEWARNAI')) {
      retail = 10000;
      wholesale = 8000;
    } else {
      retail = 8000;
      wholesale = 6500;
    }
  }
  // ---- SANDAL ----
  else if (upper.includes('SANDAL')) {
    retail = 25000;
    wholesale = 20000;
  }
  // ---- VOS / L LEAF ----
  else if (upper.includes('VOS') || upper.includes('L LEAF')) {
    retail = 7000;
    wholesale = 5500;
  }
  // ---- ALUMINIUM FOIL / PLASTIC WRAP ----
  else if (upper.includes('REYNOLDS') || upper.includes('ALUMINIUM') || upper.includes('SAMPLER') || upper.includes('DAIMOND')) {
    if (upper.includes('16M') || upper.includes('8M')) {
      retail = 35000;
      wholesale = 30000;
    } else if (upper.includes('5M') || upper.includes('ZIPPER') || upper.includes('ZIPER')) {
      retail = 25000;
      wholesale = 22000;
    } else if (upper.includes('WAX')) {
      retail = 28000;
      wholesale = 25000;
    } else {
      retail = 20000;
      wholesale = 17000;
    }
  }
  // ---- PULPEN ----
  else if (upper.includes('PULPEN') || upper.includes('AE 7')) {
    retail = 3000;
    wholesale = 2500;
  }
  // ---- MAKANAN RINGAN (KACANG) ----
  else if (upper.includes('DUA KELINCI') || upper.includes('DK KACANG') || upper.includes('SARI GURIH') || upper.includes('KACANG')) {
    if (upper.includes('1000 GR') || upper.includes('1KG') || upper.includes('500 GR') || upper.includes('500G')) {
      retail = 45000;
      wholesale = 40000;
    } else if (upper.includes('250G') || upper.includes('250 GR')) {
      retail = 25000;
      wholesale = 22000;
    } else if (upper.includes('100G') || upper.includes('100 GR')) {
      retail = 12000;
      wholesale = 10000;
    } else if (upper.includes('65G') || upper.includes('43G') || upper.includes('36G')) {
      retail = 5000;
      wholesale = 4000;
    } else {
      retail = 15000;
      wholesale = 13000;
    }
  }
  else if (upper.includes('REGE') || upper.includes('DOUBLE RABBIT')) {
    retail = 5000;
    wholesale = 4000;
  }
  else if (upper.includes('SUKRO') || upper.includes('GARING')) {
    retail = 5000;
    wholesale = 4000;
  }
  else if (upper.includes('FINNA') || upper.includes('KRUPUK')) {
    retail = 15000;
    wholesale = 13000;
  }
  // ---- GARAM ----
  else if (upper.includes('GARAM') || upper.includes('DOLPHIN')) {
    if (upper.includes('1KG') || upper.includes('1 KG')) {
      retail = 12000;
      wholesale = 10000;
    } else if (upper.includes('500G') || upper.includes('500 GR')) {
      retail = 7000;
      wholesale = 6000;
    } else {
      retail = 5000;
      wholesale = 4000;
    }
  }
  // ---- KOSMETIK / BEAUTY ----
  else if (upper.includes('PONDS') || upper.includes('POND')) {
    retail = 15000;
    wholesale = 13000;
  }
  else if (upper.includes('PASEO') || upper.includes('TISSUE')) {
    retail = 35000;
    wholesale = 30000;
  }
  else if (upper.includes('HUGO') || upper.includes('PARFUM') || upper.includes('WOMAN')) {
    retail = 75000;
    wholesale = 65000;
  }
  else if (upper.includes('SATTO') || upper.includes('SLIM ESSENCE')) {
    retail = 12000;
    wholesale = 10000;
  }
  // ---- PRINT / EPSON ----
  else if (upper.includes('EPSON') || upper.includes('CARTRI') || upper.includes('CARTG') || upper.includes('CARTID') || upper.includes('RBON')) {
    retail = 85000;
    wholesale = 75000;
  }
  else if (upper.includes('E-PRINT') || upper.includes('EPRINT')) {
    retail = 70000;
    wholesale = 62000;
  }
  // ---- MAKANAN HEWAN (ALPO) ----
  else if (upper.includes('ALPO') || upper.includes('MAKANAN ANJING') || upper.includes('DOG')) {
    if (upper.includes('623G') || upper.includes('623 GR')) {
      retail = 45000;
      wholesale = 40000;
    } else {
      retail = 28000;
      wholesale = 25000;
    }
  }
  // ---- TABASCO / SAOS ----
  else if (upper.includes('TABASCO') || upper.includes('MOREHOUSE') || upper.includes('MUSTARD')) {
    if (upper.includes('350ML') || upper.includes('567G')) {
      retail = 85000;
      wholesale = 75000;
    } else if (upper.includes('150ML')) {
      retail = 55000;
      wholesale = 48000;
    } else {
      retail = 35000;
      wholesale = 30000;
    }
  }
  // ---- GELAS SET ----
  else if (upper.includes('GELAS SET') || upper.includes('CM GELAS')) {
    retail = 50000;
    wholesale = 42000;
  }
  // ---- MARTINI ----
  else if (upper.includes('MARTINI')) {
    retail = 150000;
    wholesale = 130000;
  }
  // ---- LEM ----
  else if (upper.includes('LEM')) {
    retail = 5000;
    wholesale = 4000;
  }
  // ---- JALAPENOS / STARS ----
  else if (upper.includes('JALAPENOS')) {
    retail = 35000;
    wholesale = 30000;
  }
  // ---- CANDIES / PERMEN ----
  else if (upper.includes('CANDIES') || upper.includes('TYL') || upper.includes('PERMEN')) {
    retail = 15000;
    wholesale = 12000;
  }
  // ---- SARIM (mungkin typo dari SARIMI) ----
  else if (upper.includes('SARIM SOTO') || upper.includes('SARIM  AYAM')) {
    retail = 3500;
    wholesale = 3000;
  }
  // Default berdasarkan kategori
  else if (category === 'Makanan') {
    retail = 5000;
    wholesale = 4000;
  } else if (category === 'Minuman') {
    retail = 15000;
    wholesale = 13000;
  } else if (category === 'Alat Tulis') {
    retail = 8000;
    wholesale = 6500;
  } else if (category === 'Kosmetik') {
    retail = 20000;
    wholesale = 17000;
  } else {
    // Umum default
    retail = 25000;
    wholesale = 20000;
  }

  return { retail, wholesale };
}

// Proses semua produk
let updated = 0;
products.forEach((product) => {
  const { retail, wholesale } = getPrice(product.name, product.category);
  if (product.priceRetail === 0 && product.priceWholesale === 0) {
    product.priceRetail = retail;
    product.priceWholesale = wholesale;
    updated++;
  }
});

data.data.products = products;
fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
console.log(`✅ ${updated} produk berhasil diisi harga.`);
console.log(`📦 Total produk: ${products.length}`);