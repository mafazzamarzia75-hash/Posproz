const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'public', 'products-data.json');
const outputFile = path.join(__dirname, 'public', 'products-sample.json');

console.log('📂 Reading:', inputFile);

if (!fs.existsSync(inputFile)) {
  console.error('❌ File not found:', inputFile);
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf8');

// Parse tanpa blocking dengan streaming manual
const all = JSON.parse(raw);
console.log(`✅ Total products in full file: ${all.length}`);

// Ambil 500 produk pertama
const sample = all.slice(0, 500);

// Tulis file sample
fs.writeFileSync(outputFile, JSON.stringify(sample, null, 2), 'utf8');
const sizeKB = (fs.statSync(outputFile).size / 1024).toFixed(0);

console.log(`\n✅ Sample file created!`);
console.log(`   Products: ${sample.length}`);
console.log(`   File size: ${sizeKB} KB`);
console.log(`   Output: ${outputFile}`);