# 🌐 Panduan Mengoperasikan Aplikasi Kasir POS di Jaringan Lokal (LAN / Wi-Fi)

Panduan ini berisi metode praktis untuk menjalankan aplikasi kasir ini pada **satu komputer utama (sebagai Server Lokal)**, lalu menghubungkan perangkat lain seperti laptop kasir, tablet, atau smartphone staf gudang yang berada dalam jaringan Wi-Fi atau kabel LAN yang sama.

---

## 📌 Gambaran Umum Alur Kerja
1. **Server Lokal**: Komputer utama (bisa milik Owner atau Admin) yang menjalankan database IndexedDB (atau database cloud) beserta service server aplikasinya.
2. **Klien (Kasir & Gudang)**: Perangkat-perangkat lain yang mengakses aplikasi cukup dengan membuka browser (Google Chrome, Safari, dll.) dan mengetikkan alamat IP lokal dari komputer Server.
3. **Kabel LAN atau Sinyal Wi-Fi**: Media penghubung agar komputer Server dan perangkat Klien saling mengenali secara lokal tanpa memerlukan kuota internet yang besar.

---

## 🛠️ Langkah 1: Mempersiapkan Jaringan (Wi-Fi / LAN)
Semua perangkat yang akan mengakses aplikasi kasir **WAJIB** terhubung ke titik akses yang sama.
- **Instalasi Wi-Fi**: Pastikan komputer Server Utama dan HP / Laptop Klien tersambung ke router Wi-Fi yang sama (misalnya: Wi-Fi Toko).
- **Instalasi Kabel LAN**: Jika menggunakan kabel, pastikan semua PC tercolok ke Switch/Hub router yang sama.

---

## 🖥️ Langkah 2: Mengetahui Alamat IP Lokal Komputer Server

Anda perlu mencari tahu alamat IP lokal dari komputer utama (Server). Cara mencarinya:

### Pada Sistem Operasi Windows:
1. Tekan tombol `Windows + R` pada keyboard, ketik `cmd`, lalu tekan **Enter**.
2. Di layar hitam terminal, ketik perintah berikut lalu tekan **Enter**:
   ```cmd
   ipconfig
   ```
3. Cari adaptor jaringan yang Anda gunakan (contoh: *Wireless LAN adapter Wi-Fi* atau *Ethernet adapter*).
4. Temukan baris bernama **IPv4 Address**.
   - *Contoh Alamat IP:* `192.168.1.50` atau `192.168.100.12`

### Pada Sistem Operasi macOS / Linux:
1. Buka aplikasi **Terminal**.
2. Ketik perintah berikut dan tekan **Enter**:
   ```bash
   ifconfig | grep "inet "
   ```
3. Cari alamat IP lokal yang umumnya diawali dengan angka `192.168.x.x` atau `10.x.x.x`.

---

## 🚀 Langkah 3: Menjalankan Aplikasi di Komputer Server

Aplikasi ini menggunakan Vite yang secara default hanya mendengarkan koneksi lokal di komputer itu sendiri (`localhost`). Agar komputer luar bisa mengaksesnya, server harus dijalankan dengan mode **Host Publik**.

### Metode A: Menjalankan Mode Pengembangan (Vite Dev Mode)
Jika Anda ingin menjalankan aplikasi secara langsung dari source code di server:
1. Buka terminal di folder proyek Anda di komputer Server.
2. Jalankan perintah start dengan parameter `--host`:
   ```bash
   npm run dev -- --host 0.0.0.0
   ```
   *Atau, jika skrip package.json Anda sudah mendukung, cukup jalankan:*
   ```bash
   npm run dev
   ```
3. Perhatikan output di terminal Anda. Anda akan melihat informasi seperti ini:
   ```text
     ➜  Local:   http://localhost:3000/
     ➜  Network: http://192.168.1.50:3000/
   ```
   *Alamat di baris **Network** inilah yang akan diakses oleh komputer lain.*

---

## 🛡️ Langkah 4: Mengatur Firewall Windows (Sangat Penting!)
Seringkali komputer lain gagal terhubung karena diblokir oleh sistem keamanan (Firewall) Windows di komputer Server.

### Cara Membuka Port 3000 di Windows Defender Firewall:
1. Klik tombol **Start**, cari dan buka **Windows Defender Firewall with Advanced Security**.
2. Di kolom bagian kiri, klik **Inbound Rules**.
3. Di panel kanan, klik **New Rule...**
4. Pilih tipe rule: **Port**, lalu klik **Next**.
5. Pilih **TCP** dan isi kolom Spesifik Port dengan angka **3000**, lalu klik **Next**.
6. Pilih **Allow the connection**, lalu klik **Next**.
7. Centang ketiga opsi (**Domain**, **Private**, **Public**), klik **Next**.
8. Beri nama rule tersebut (contoh: `Aplikasi Kasir POS`), lalu klik **Finish**.

---

## 📱 Langkah 5: Menghubungkan Perangkat Klien (Kasir & Gudang)

Sekarang, semua perangkat lain di toko Anda sudah bisa membuka aplikasi kasir tanpa perlu menginstal aplikasi tambahan apapun!

1. Buka browser (disarankan **Google Chrome**) di perangkat Klien (PC Kasir, Laptop, HP Android, atau iPad).
2. Di bilah alamat browser (URL bar), ketik format alamat berikut:
   ```text
   http://[IP-ADDR-SERVER]:3000
   ```
   *Contoh:*
   ```text
   http://192.168.1.50:3000
   ```
3. Tekan **Enter** atau **Go**.
4. Halaman login aplikasi kasir akan langsung muncul! Staf kasir dan staf gudang kini dapat login dengan akun masing-masing secara bersamaan.

---

## 💡 Tips & Trik Tambahan untuk Keandalan Toko

### 1. Atur IP Statis (Static IP) pada Komputer Server
Secara default, router Wi-Fi akan mengubah alamat IP komputer Anda setiap kali komputer dimatikan atau router direstart (DHCP Dinamis). Agar kasir Anda tidak perlu mengganti alamat URL di brower setiap hari:
* Atur konfigurasi network IPv4 di Windows Server Anda dari "Obtain IP address automatically" menjadi manual (**Static IP**) sesuai dengan alamat IP lokal Anda saat ini.

### 2. Gunakan Fitur "Add to Home Screen" di Smartphone / Tablet Klien
Untuk memudahkan kasir dan helper gudang yang menggunakan handphone:
* Buka link aplikasi tersebut di Google Chrome HP mereka.
* Klik tombol **titik tiga** di kanan atas Chrome, lalu pilih **Tambahkan ke Layar Utama (Add to Home Screen)**.
* Aplikasi ini akan terpasang di HP mereka layaknya aplikasi native Android/iOS dengan ikon eksklusif dan tanpa bar navigasi browser yang mengganggu (mode *Full Screen Web App*).

### 3. Masalah Printer Termal & Barcode Scanner
* **Barcode Scanner**: Dapat langsung dicolokkan ke masing-masing perangkat Klien (via USB/Bluetooth). Tombol scanner akan langsung otomatis mengisi kolom pencarian barang/transaksi di perangkat yang sedang aktif.
* **Receipt Printer**: Jika printer terhubung di komputer Server, Anda dapat membagikannya (**Printer Sharing**) melalui kontrol panel jaringan agar komputer kasir lainnya dapat mencetak struk secara langsung lewat jaringan Wi-Fi/LAN tersebut.
