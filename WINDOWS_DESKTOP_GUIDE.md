# 💻 Panduan Membuat Aplikasi Desktop Mandiri Windows (.exe) Menggunakan Electron

Panduan ini menjelaskan cara membungkus aplikasi kasir (React + Vite) ini menjadi file aplikasi Windows (.exe) mandiri menggunakan **Electron**. Aplikasi akan berjalan di dalam jendela Windows tersendiri tanpa perlu membuka browser eksternal, lengkap dengan ikon aplikasi dan performa optimal.

---

## 🏗️ Alur Singkat Pembuatan
1. Menyiapkan dependensi Electron di proyek.
2. Membuat file konfigurasi utama Electron (`electron.js`).
3. Mengatur skrip build di `package.json`.
4. Melakukan kompilasi (Build) aplikasi React.
5. Memaketkan aplikasi menjadi file installer `.exe`.

---

## 🛠️ Langkah 1: Instalasi Dependensi Electron

Jalankan perintah ini melalui terminal di direktori root proyek Anda untuk menambahkan Electron dan pembungkus installer sebagai dependensi pengembangan (`devDependencies`):

```bash
npm install electron electron-builder --save-dev
```

---

## 📝 Langkah 2: Membuat File Konfigurasi Electron (`electron.js`)

Buat file baru di root direktori proyek Anda bernama `electron.js`. File ini bertugas untuk memanggil jendela Windows saat aplikasi dijalankan dan memuat hasil kompilasi React.

Buat file `/electron.js` dengan isi berikut:

```javascript
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: "Aplikasi POS Pintar - Desktop",
    icon: path.join(__dirname, 'public/favicon.ico'), // Ganti dengan path ikon Anda
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Opsional jika membutuhkan API native
    }
  });

  // Jika dalam mode development, muat url localhost Vite
  // Jika dalam mode produksi, muat file statis index.html hasil build
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); // Buka devtools otomatis di mode dev
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Menyembunyikan menu bawaan browser jika ingin tampilan bersih/kios
  // Menu.setApplicationMenu(null); 

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
```

---

## 📦 Langkah 3: Konfigurasi `package.json`

Buka file `package.json` Anda, lalu lakukan penyesuaian pada properti `"main"` serta tambahkan perintah build khusus Electron di bagian `"scripts"` dan `"build"`.

### 1. Tambahkan Properti "main"
Tambahkan baris ini di level paling atas atau di dekat properti `"name"`:
```json
"main": "electron.js",
```

### 2. Tambahkan Script Baru di `"scripts"`
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "electron:dev": "electron .",
  "electron:build": "npm run build && electron-builder"
},
```

### 3. Tambahkan Setelan Pembungkus `"build"` (electron-builder configuration)
Tambahkan konfigurasi pembungkus ini di bagian paling bawah file `package.json` sebelum kurung kurawal tutup `}`:

```json
"build": {
  "appId": "com.toko.pospintar",
  "productName": "POSPintar",
  "copyright": "Copyright © 2026",
  "directories": {
    "output": "dist-desktop"
  },
  "files": [
    "dist/**/*",
    "electron.js",
    "package.json"
  ],
  "win": {
    "target": "nsis",
    "icon": "public/favicon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "POS Pintar"
  }
}
```

---

## 🚀 Langkah 4: Uji Coba Aplikasi (Mode Developer)

Sebelum membungkus menjadi `.exe`, Anda dapat menguji performa aplikasi desktop Anda terlebih dahulu:

1. Jalankan server lokal Vite Anda terlebih dahulu:
   ```bash
   npm run dev
   ```
2. Di terminal atau tab command prompt yang terpisah, jalankan Electron:
   ```bash
   npm run electron:dev
   ```
3. Jendela browser mandiri Windows akan muncul dan memuat aplikasi Anda. Semua fitur input barcode scanner dan tombol thermal printer akan tetap berfungsi normal di sini.

---

## 📦 Langkah 5: Memaketkan Menjadi Aplikasi Installer (.exe)

Saat aplikasi Anda sudah siap dideploy ke toko/komputer kasir klien:

1. Pastikan Anda berada di sistem operasi Windows (untuk hasil build `.exe` terbaik).
2. Jalankan perintah kompilasi final ini di terminal:
   ```bash
   npm run electron:build
   ```
3. Proses ini otomatis akan melakukan:
   - Kompilasi build React (`vite build`) ke dalam folder `/dist`.
   - Mengompresi seluruh aset aplikasi ke dalam format biner yang sangat cepat.
   - Membuat file setup installer `.exe` di dalam folder baru bernama **`/dist-desktop`**.
4. Buka folder `/dist-desktop` di komputer Anda, lalu temukan file bernama **`POSPintar Setup 1.0.0.exe`** (atau nama yang sesuai konfigurasi Anda).
5. Klik ganda file tersebut untuk menginstalnya ke sistem operasi Windows layaknya program profesional, lengkap dengan shortcut di Desktop dan Start Menu!

---

## 💡 Fitur Desktop Tingkat Lanjut (Opsional)

Jika Anda ingin berintegrasi langsung secara fisik dengan sistem perangkat hardware Windows, Anda dapat memanfaatkan keuntungan Node.js di Electron:

### 1. Direct Printing (Tanpa Dialog Cetak)
Di sistem laci kasir, munculnya dialog print bawaan Chrome (`window.print()`) sangat memperlambat proses. Anda bisa memodifikasi fitur cetak di NodeJS menggunakan library npm `pdf-to-printer` atau memanggil cetak raw silent di Electron melalui fungsi `webContents.print()`.

### 2. Aplikasi Berjalan Otomatis (Auto start)
Staf toko ingin saat komputer Windows dinyalakan di pagi hari, aplikasi kasir otomatis terbuka. Anda tinggal menambahkan setelan Auto Launch di konfigurasi installer NSIS atau memanfaatkan library `auto-launch` di dalam `electron.js`:
```javascript
const AutoLaunch = require('auto-launch');
let appLauncher = new AutoLaunch({
    name: 'POS Pintar',
    path: app.getPath('exe'),
});
appLauncher.enable();
```
