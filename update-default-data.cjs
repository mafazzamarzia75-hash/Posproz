const fs = require('fs');
const path = require('path');

const sampleFile = path.join(__dirname, 'public', 'products-sample.json');
const defaultFile = path.join(__dirname, 'src', 'services', 'db', 'DefaultData.json');

console.log('📂 Reading sample:', sampleFile);

const products = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
console.log(`✅ Products to insert: ${products.length}`);

// Bungkus dalam format yang diminta DefaultData.json
const defaultData = {
  data: {
    products: products
  }
};

fs.writeFileSync(defaultFile, JSON.stringify(defaultData, null, 2), 'utf8');
const sizeKB = (fs.statSync(defaultFile).size / 1024).toFixed(0);

console.log(`\n✅ DefaultData.json updated!`);
console.log(`   Products: ${products.length}`);
console.log(`   File size: ${sizeKB} KB`);
console.log(`   Output: ${defaultFile}`);