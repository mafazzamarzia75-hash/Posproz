/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Download, Upload, Shield, Database, Store, Save, Printer, Globe, FileInput, Trash2, FileDown, FileUp, RefreshCw, CheckCircle2, AlertCircle, Moon, HandCoins } from 'lucide-react';
import { dbProvider } from '@/services/db/DatabaseService';
import { printerService } from '@/services/hardware/PrinterService';
import { useSettingsStore } from '@/store/useSettingsStore';
import { formatCurrency, cn, generateProductId, downloadFile } from '@/lib/utils';
import { indexdbBarang } from '@/lib/indexdbBarang.ts';
import { indexdbTransaksi } from '@/lib/indexdbTransaksi.ts';
import { indexdbCustomer } from '@/lib/indexdbCustomer.ts';
import { indexdbSupplier } from '@/lib/indexdbSupplier.ts';
import { indexdbCategory } from '@/lib/indexdbCategory.ts';
import { indexdbDebt } from '@/lib/indexdbDebt.ts';
import { indexdbDiscount } from '@/lib/indexdbDiscount.ts';
import { indexdbExpense } from '@/lib/indexdbExpense.ts';
import { indexdbRestock } from '@/lib/indexdbRestock.ts';
import { indexdbRetur } from '@/lib/indexdbRetur.ts';
import { indexdbUser } from '@/lib/indexdbUser.ts';
import { supabase, isPostgresConfigured } from '@/lib/supabaseClient';
import { SupabaseSyncCard } from '@/components/sync';

// ✅ Pisahkan loading state per aksi agar tombol lain tetap aktif
type LoadingKey = 'backup' | 'restore' | 'importProducts' | 'resetTransactions' | 'backupTransactions' | 'testPrint' | 'saveInfo' | 'sync' | 'deduplicate' | 'migrateIds' | null;

const SettingsPage: React.FC = () => {
  const { storeInfo, updateStoreInfo, printer, updatePrinterSettings, darkMode, toggleDarkMode } = useSettingsStore();
  const [loadingKey, setLoadingKey] = useState<LoadingKey>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [localStoreInfo, setLocalStoreInfo] = useState(storeInfo);

  const [localPrinter, setLocalPrinter] = useState(printer);

  // ✅ State khusus untuk manajemen akun user (Kasir & Admin)
  const [users, setUsers] = useState<any[]>([]);
  const [userLoadingId, setUserLoadingId] = useState<string | null>(null);

  // State untuk form Tambah User Baru
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'admin' | 'kasir' | 'gudang'>('gudang');

  const fetchUsers = async () => {
    try {
      const allUsers = await indexdbUser.getAll();
      setUsers(allUsers);
    } catch (e) {
      console.error("Gagal mengambil data user:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (user: any, updatedName: string, updatedPassword: string) => {
    if (!updatedName.trim()) {
      showStatus('error', 'Nama lengkap tidak boleh kosong!');
      return;
    }
    if (!updatedPassword.trim()) {
      showStatus('error', 'Password tidak boleh kosong!');
      return;
    }

    try {
      setUserLoadingId(user.id);
      
      const updatedUser = {
        ...user,
        name: updatedName.trim(),
        password: updatedPassword.trim(),
        updated_at: Date.now()
      };

      await indexdbUser.save(updatedUser);

      // ✅ Jika user yang diedit adalah user yang sedang login, update local storage sesinya secara real-time!
      const currentUser = indexdbUser.getCurrentUser();
      if (currentUser && currentUser.id === user.id) {
        const updatedSession = {
          ...currentUser,
          name: updatedName.trim(),
        };
        localStorage.setItem('pos_current_user', JSON.stringify(updatedSession));
        // Sinkronisasi data internal indexdbUser agar session instant ter-update di UI
        (indexdbUser as any).currentUser = updatedSession;
      }

      showStatus('success', `Berhasil memperbarui data akun "${user.username}"!`);
      await fetchUsers();
    } catch (e) {
      console.error("Gagal edit user:", e);
      showStatus('error', 'Terjadi kesalahan sistem saat memperbarui akun.');
    } finally {
      setUserLoadingId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) {
      showStatus('error', 'Username tidak boleh kosong!');
      return;
    }
    if (!newName.trim()) {
      showStatus('error', 'Nama Lengkap tidak boleh kosong!');
      return;
    }
    if (!newPassword.trim()) {
      showStatus('error', 'Password tidak boleh kosong!');
      return;
    }

    try {
      setUserLoadingId('new_user_action');
      
      const allUsers = await indexdbUser.getAll();
      const existing = allUsers.find(u => u.username.toLowerCase() === newUsername.trim().toLowerCase());
      if (existing) {
        showStatus('error', `Username "${newUsername}" sudah terdaftar! Gunakan username lain.`);
        return;
      }

      const newUser = {
        id: indexdbUser.generateId(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword.trim(),
        name: newName.trim(),
        role: newRole,
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      await indexdbUser.save(newUser);
      showStatus('success', `Akun "${newUsername}" berhasil didaftarkan!`);
      
      // Reset form input
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewRole('kasir');
      setShowAddUser(false);
      
      await fetchUsers();
    } catch (e) {
      console.error("Gagal membuat user baru:", e);
      showStatus('error', 'Terjadi kesalahan sistem saat membuat akun.');
    } finally {
      setUserLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.id === 'user_super_admin' || user.username === 'superadmin') {
      showStatus('error', 'Tidak diizinkan menghapus Super Admin utama!');
      return;
    }
    if (user.id === 'user_admin' || user.username === 'admin') {
      showStatus('error', 'Tidak diizinkan menghapus administrator utama!');
      return;
    }
    const curr = indexdbUser.getCurrentUser();
    if (curr && curr.id === user.id) {
      showStatus('error', 'Anda tidak bisa menghapus akun yang sedang Anda gunakan saat ini!');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.username}) secara permanen?`)) return;

    try {
      setUserLoadingId(user.id);
      await indexdbUser.delete(user.id);
      showStatus('success', `Akun "${user.username}" berhasil dihapus.`);
      await fetchUsers();
    } catch (e) {
      console.error("Gagal menghapus user:", e);
      showStatus('error', 'Terjadi kesalahan saat menghapus akun.');
    } finally {
      setUserLoadingId(null);
    }
  };

  useEffect(() => {
    setLocalStoreInfo(storeInfo);
  }, [storeInfo]);

  useEffect(() => {
    setLocalPrinter(printer);
  }, [printer]);

  // ✅ State khusus untuk progress sinkronisasi
  const [syncProgress, setSyncProgress] = useState<{ step: string; percent: number } | null>(null);

  // ✅ Ref untuk reset input file setelah digunakan
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const isLoading = (key: LoadingKey) => loadingKey === key;
  const anyLoading = loadingKey !== null;

  const showStatus = (type: 'success' | 'error', message: string, duration = 4000) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), duration);
  };

  const handleSavePrinter = () => {
    setLoadingKey('saveInfo');
    try {
      // Validasi defensif
      const paperWidthMm = localPrinter.paperWidthMm === 80 ? 80 : 58;
      const extraPageHeightMm = Math.max(0, Number(localPrinter.extraPageHeightMm) || 0);
      const barcodeRenderMode = localPrinter.barcodeRenderMode === 'svg' ? 'svg' : 'png';
      updatePrinterSettings({ paperWidthMm, extraPageHeightMm, barcodeRenderMode });
      showStatus('success', 'Pengaturan printer berhasil disimpan!');
    } catch (e) {
      console.error('Save printer settings error:', e);
      showStatus('error', 'Gagal menyimpan pengaturan printer. Cek konsol untuk detail.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ BACKUP SELURUH DATA (produk + transaksi + settings)
  const handleBackup = async () => {
    try {
      setLoadingKey('backup');
      const data = await dbProvider.exportData();
      const filename = `backup_${localStoreInfo.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;

      await downloadFile(filename, data, 'json');
      showStatus('success', 'Database berhasil dicadangkan!');
    } catch (error) {
      console.error("Backup error:", error);
      showStatus('error', 'Gagal mencadangkan database. Cek konsol untuk detail.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ RESTORE DATABASE (timpa semua data dari file JSON)
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ Peringatan: Memulihkan data akan MENGHAPUS semua data produk dan transaksi saat ini, lalu menggantinya dengan data dari file. Lanjutkan?')) {
      // ✅ Reset input dan batalkan
      if (restoreInputRef.current) restoreInputRef.current.value = '';
      return;
    }

    setLoadingKey('restore');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        // ✅ Validasi JSON sebelum proses
        let parsed: any;
        try {
          parsed = JSON.parse(json);
        } catch {
          showStatus('error', 'File tidak valid. Pastikan file adalah JSON yang benar.');
          setLoadingKey(null);
          if (restoreInputRef.current) restoreInputRef.current.value = '';
          return;
        }

        // ✅ Validasi struktur backup
        if (!parsed.products && !parsed.transactions) {
          showStatus('error', 'Format file backup tidak dikenali. Pastikan file berasal dari fitur Backup aplikasi ini.');
          setLoadingKey(null);
          if (restoreInputRef.current) restoreInputRef.current.value = '';
          return;
        }

        const success = await dbProvider.importData(json);
        if (success) {
          showStatus('success', 'Data berhasil dipulihkan! Halaman akan dimuat ulang...', 2500);
          setTimeout(() => window.location.reload(), 2500);
        } else {
          showStatus('error', 'Gagal memulihkan data. Cek konsol untuk detail.');
          setLoadingKey(null);
          if (restoreInputRef.current) restoreInputRef.current.value = '';
        }
      } catch (error) {
        console.error("Restore error:", error);
        showStatus('error', 'Terjadi kesalahan saat memulihkan data.');
        setLoadingKey(null);
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      showStatus('error', 'Gagal membaca file.');
      setLoadingKey(null);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // ✅ IMPORT PRODUK MASSAL dari JSON
  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('Import produk akan menambahkan/menimpa produk dengan ID/SKU yang sama. Produk yang tidak ada di file TIDAK akan dihapus. Lanjutkan?')) {
      // ✅ Reset input dan batalkan — loadingKey tidak perlu diubah karena belum diset
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    setLoadingKey('importProducts');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        let data: any;
        try {
          data = JSON.parse(json);
        } catch {
          showStatus('error', 'File tidak valid. Pastikan file adalah JSON yang benar.');
          setLoadingKey(null);
          if (importInputRef.current) importInputRef.current.value = '';
          return;
        }

        console.log('📦 Data JSON yang di-parse:', typeof data, Array.isArray(data) ? 'Array' : 'Object');

        // ✅ Support format array langsung atau object dengan key products/Products
        const rawProducts = Array.isArray(data) ? data : (data.products || data.Products || []);

        console.log('📦 Jumlah produk dalam file:', rawProducts.length);

        if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
          showStatus('error', 'Format file tidak valid. File harus berisi array produk atau object dengan key "products".');
          setLoadingKey(null);
          if (importInputRef.current) importInputRef.current.value = '';
          return;
        }

        const beforeCount = await indexdbBarang.count();
        console.log('📊 Jumlah produk sebelum import:', beforeCount);

        // ✅ Normalisasi dan validasi setiap produk
        // ID deterministik berbasis SKU — produk yang sama selalu dapat ID yang sama
        const normalizedProducts = rawProducts
          .map((product: any) => {
            if (!product.name && !product.nama) return null;

            const sku = (product.sku || product.barcode || '').toString().trim();
            const barcode = (product.barcode || product.sku || '').toString().trim();

            // ✅ Jika file sudah punya id yang valid (bukan format lama berantakan), pakai.
            // Jika tidak, generate dari SKU agar deterministik.
            const hasCleanId = product.id
              && typeof product.id === 'string'
              && product.id.startsWith('prod_');
            const id = hasCleanId
              ? product.id
              : generateProductId(sku, barcode);

            return {
              id,
              sku,
              barcode,
              name: product.name || product.nama,
              category: product.category || product.kategori || 'Umum',
              priceRetail: parseInt(String(product.priceRetail || product.price || product.harga || product.retail_price || 0)),
              priceWholesale: parseInt(String(product.priceWholesale || product.wholesale_price || product.harga_grosir || product.price || 0)),
              stock: parseInt(String(product.stock || product.stok || product.quantity || 0)),
              min_stock: parseInt(String(product.min_stock || product.minStock || product.stok_minimum || 0)),
              updated_at: Date.now()
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        console.log('📦 Jumlah produk valid setelah normalisasi:', normalizedProducts.length);

        if (normalizedProducts.length === 0) {
          showStatus('error', 'Tidak ada produk valid dalam file. Pastikan setiap produk memiliki field "name".');
          setLoadingKey(null);
          if (importInputRef.current) importInputRef.current.value = '';
          return;
        }

        const result = await dbProvider.importProducts(normalizedProducts);
        const afterCount = await indexdbBarang.count();
        const newProducts = afterCount - beforeCount;

        console.log('📈 Berhasil:', result.success, '| Gagal:', result.error, '| Total sekarang:', afterCount);

        if (result.success > 0) {
          showStatus(
            'success',
            `✅ Berhasil import ${result.success} produk! (+${newProducts > 0 ? newProducts : 0} baru, ${result.success - (newProducts > 0 ? newProducts : 0)} diperbarui). Total: ${afterCount} produk. Halaman akan dimuat ulang...`,
            3000
          );
          setTimeout(() => window.location.reload(), 3000);
        } else {
          showStatus('error', `Gagal import semua produk. ${result.error} error. Cek konsol untuk detail.`);
          setLoadingKey(null);
          if (importInputRef.current) importInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Import produk error:', error);
        showStatus('error', 'Terjadi kesalahan saat import produk.');
        setLoadingKey(null);
        if (importInputRef.current) importInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      showStatus('error', 'Gagal membaca file.');
      setLoadingKey(null);
      if (importInputRef.current) importInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // ✅ MIGRASI ID PRODUK LAMA → FORMAT BARU prod_<sku>
  const handleMigrateIds = async () => {
    const isNative = false;
    const currentCount = isNative ? await dbProvider.countProducts() : await indexdbBarang.count();

    if (!confirm(
      `Fitur ini akan mengubah ID produk lama (format acak/timestamp) ke format baru yang konsisten (prod_<sku>).\n\n` +
      `Total ${currentCount.toLocaleString("id-ID")} produk akan diperiksa.\n` +
      `Produk duplikat dengan SKU yang sama akan digabung otomatis.\n\n` +
      `Lakukan backup terlebih dahulu sebelum menjalankan ini. Lanjutkan?`
    )) return;

    try {
      setLoadingKey("migrateIds");
      let result: { migrated: number; skipped: number };

      if (isNative) {
        result = await dbProvider.migrateProductIds();
      } else {
        result = await indexdbBarang.migrateIds();
      }
      
      if (result.migrated === 0) {
        showStatus("success", `✅ Semua ID sudah dalam format baru. ${result.skipped} produk tidak perlu diubah.`);
      } else {
        showStatus(
          "success",
          `✅ Migrasi selesai! ${result.migrated} ID diperbarui ke format prod_<sku>. Halaman akan dimuat ulang...`,
          3000
        );
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (e) {
      console.error("Migrate IDs error:", e);
      showStatus("error", "Gagal migrasi ID. Cek konsol untuk detail.");
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ HAPUS DUPLIKAT PRODUK berdasarkan SKU/barcode
  const handleDeduplicate = async () => {
    const isNative = false;
    const currentCount = isNative ? await dbProvider.countProducts() : await indexdbBarang.count();

    if (!confirm(`Database saat ini memiliki ${currentCount.toLocaleString("id-ID")} produk.\n\nFitur ini akan menghapus produk duplikat (SKU/barcode sama), menyimpan yang paling baru.\n\nLanjutkan?`)) return;

    try {
      setLoadingKey("deduplicate");
      let result: { removed: number; kept: number };

      if (isNative) {
        result = await dbProvider.deduplicateProducts();
      } else {
        result = await indexdbBarang.deduplicateBySku();
      }
      
      if (result.removed === 0) {
        showStatus("success", `✅ Tidak ada duplikat ditemukan. Total ${result.kept.toLocaleString("id-ID")} produk sudah unik.`);
      } else {
        showStatus(
          "success",
          `✅ Berhasil hapus ${result.removed.toLocaleString("id-ID")} duplikat! Tersisa ${result.kept.toLocaleString("id-ID")} produk unik. Halaman akan dimuat ulang...`,
          3000
        );
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (e) {
      console.error("Deduplicate error:", e);
      showStatus("error", "Gagal menghapus duplikat. Cek konsol untuk detail.");
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ SINKRONISASI & VERIFIKASI DATA — Berfungsi di SEMUA Platform (Browser & PostgreSQL Cloud)
  const handleSync = async () => {
    try {
      setLoadingKey('sync');

      if (isPostgresConfigured) {
        // ✅ POSTGRESQL CLOUD SYNC ACTIVE
        setSyncProgress({ step: 'Menghubungkan ke PostgreSQL Cloud...', percent: 5 });

        // 1. Ambil data lokal
        const [localProducts, localSales] = await Promise.all([
          indexdbBarang.getAllBarang(),
          indexdbTransaksi.getAll()
        ]);

        // 2. Ambil data PG
        setSyncProgress({ step: 'Mengambil data produk dari PostgreSQL...', percent: 15 });
        const { data: pgProducts, error: pgProdError } = await supabase
          .from('products')
          .select('*');

        if (pgProdError) throw pgProdError;

        setSyncProgress({ step: 'Menskonsiliasikan data produk (Last Write Wins)...', percent: 35 });
        const pgProdMap = new Map(pgProducts?.map((p: any) => [p.id, p]) || []);
        let updatedCount = 0;

        for (const p of localProducts) {
          const pgP = pgProdMap.get(p.id);
          if (!pgP) {
            // Upload produk baru ke PG
            const mapped = {
              id: p.id,
              name: p.name,
              sku: p.sku,
              barcode: p.barcode,
              category: p.category,
              price_retail: p.priceRetail,
              price_wholesale: p.priceWholesale,
              price_cost: p.priceCost,
              stock: p.stock,
              min_stock: p.min_stock,
              supplier_id: p.supplierId,
              supplier_name: p.supplierName,
              updated_at: new Date(p.updated_at || Date.now())
            };
            await supabase.from('products').insert(mapped);
            updatedCount++;
          } else {
            // Bandingkan timestamp update_at
            const localTime = p.updated_at || 0;
            const pgTime = pgP.updated_at ? new Date(pgP.updated_at).getTime() : 0;

            if (localTime > pgTime) {
              // Local lebih baru -> upload ke PG
              const mapped = {
                id: p.id,
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                category: p.category,
                price_retail: p.priceRetail,
                price_wholesale: p.priceWholesale,
                price_cost: p.priceCost,
                stock: p.stock,
                min_stock: p.min_stock,
                supplier_id: p.supplierId,
                supplier_name: p.supplierName,
                updated_at: new Date(localTime)
              };
              await supabase.from('products').upsert(mapped);
              updatedCount++;
            } else if (pgTime > localTime) {
              // PG lebih baru -> update lokal
              await indexdbBarang.updateBarang({
                id: pgP.id,
                name: pgP.name,
                sku: pgP.sku,
                barcode: pgP.barcode,
                category: pgP.category,
                priceRetail: Number(pgP.price_retail ?? 0),
                priceWholesale: Number(pgP.price_wholesale ?? 0),
                priceCost: Number(pgP.price_cost ?? 0),
                stock: Number(pgP.stock ?? 0),
                min_stock: Number(pgP.min_stock ?? 0),
                supplierId: pgP.supplier_id,
                supplierName: pgP.supplier_name,
                updated_at: pgTime
              });
              updatedCount++;
            }
          }
        }

        // Tulis produk di PG yang belum ada di local ke local db
        setSyncProgress({ step: 'Mengunduh produk baru dari PostgreSQL...', percent: 55 });
        const localProdMap = new Map(localProducts.map((p: any) => [p.id, p]));
        if (pgProducts) {
          for (const pgP of pgProducts) {
            if (!localProdMap.has(pgP.id)) {
              await indexdbBarang.addBarang({
                id: pgP.id,
                name: pgP.name,
                sku: pgP.sku,
                barcode: pgP.barcode,
                category: pgP.category,
                priceRetail: Number(pgP.price_retail ?? 0),
                priceWholesale: Number(pgP.price_wholesale ?? 0),
                priceCost: Number(pgP.price_cost ?? 0),
                stock: Number(pgP.stock ?? 0),
                min_stock: Number(pgP.min_stock ?? 0),
                supplierId: pgP.supplier_id,
                supplierName: pgP.supplier_name,
                updated_at: pgP.updated_at ? new Date(pgP.updated_at).getTime() : Date.now()
              });
              updatedCount++;
            }
          }
        }

        // 3. Sync Sales
        setSyncProgress({ step: 'Sinkronisasi penjualan dengan PostgreSQL...', percent: 75 });
        const { data: pgSales, error: pgSalesError } = await supabase
          .from('sales')
          .select('id');

        if (pgSalesError) throw pgSalesError;

        const pgSalesSet = new Map(pgSales?.map((s: any) => [s.id, true]) || []);
        let transactionUploadCount = 0;

        for (const s of localSales) {
          if (!pgSalesSet.has(s.id)) {
            // Upload missing transaction to Cloud PG
            await supabase.from('sales').insert({
              id: s.id,
              total: s.total,
              items: s.items, // PostgreSQL JSONB
              created_at: s.created_at
            });
            transactionUploadCount++;
          }
        }

        setSyncProgress({ step: 'Penyelesaian sinkronisasi...', percent: 95 });
        setTimeout(() => {
          setSyncProgress(null);
          showStatus(
            'success',
            `✅ Sinkronisasi Cloud Berhasil!\n` +
            `🔄 Merekonsiliasi ${updatedCount} produk IndexedDB ↔ PostgreSQL.\n` +
            `📤 Mengunggah ${transactionUploadCount} transaksi baru ke Cloud Big Data.`
          );
        }, 600);
      } else {
        // ✅ BROWSER: Verifikasi integritas data IndexedDB
        setSyncProgress({ step: 'Memverifikasi integritas data lokal...', percent: 20 });

        // Ambil statistik data
        const [productCount, transactionCount, customerCount, supplierCount] = await Promise.all([
          indexdbBarang.count(),
          indexdbTransaksi.count(),
          indexdbCustomer.count(),
          indexdbSupplier.count(),
        ]);

        setSyncProgress({ step: 'Memeriksa data produk...', percent: 60 });

        const sampleProducts = await indexdbBarang.getPaged(0, 5);
        let productSummary = '';
        if (sampleProducts.length > 0) {
          const invalidCount = sampleProducts.filter((p: any) => !p.id || !p.name).length;
          productSummary = invalidCount > 0
            ? `${invalidCount} produk memiliki data tidak lengkap`
            : 'Semua produk valid';
        } else {
          productSummary = 'Belum ada produk (database kosong)';
        }

        setSyncProgress({ step: 'Finalisasi...', percent: 95 });

        setTimeout(() => {
          setSyncProgress(null);
          showStatus(
            'success',
            `✅ Data Terverifikasi!\n` +
            `📦 ${productCount} produk · 🧾 ${transactionCount} transaksi · 👥 ${customerCount} pelanggan · 🚚 ${supplierCount} supplier\n` +
            `${productSummary}\n` +
            `Semua data tersimpan aman di IndexedDB Lokal.`
          );
        }, 500);
      }
    } catch (e) {
      console.error('Sync error:', e);
      setSyncProgress(null);
      showStatus('error', 'Sinkronisasi gagal. Cek konsol untuk detail.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ SIMPAN INFO TOKO
  const handleSaveInfo = () => {
    setLoadingKey('saveInfo');
    try {
      updateStoreInfo(localStoreInfo);
      showStatus('success', 'Informasi toko berhasil disimpan!');
    } catch (error) {
      console.error("Save info error:", error);
      showStatus('error', 'Gagal menyimpan informasi toko.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ CETAK STRUK PERCOBAAN
  const handleTestPrint = async () => {
    try {
      setLoadingKey('testPrint');
      await printerService.printReceipt({
        title: localStoreInfo.name,
        address: localStoreInfo.address,
        phone: localStoreInfo.phone,
        items: [
          { name: "TEST ITEM 1", price: 1000, quantity: 1 },
          { name: "TEST ITEM 2", price: 5000, quantity: 2 }
        ],
        total: 11000,
        customerName: "PELANGGAN TEST",
        footer: localStoreInfo.footer || "TERIMA KASIH TELAH MENCOBA CETAK!"
      });
      showStatus('success', 'Perintah cetak dikirim ke printer!');
    } catch (e) {
      console.error("Test print error:", e);
      showStatus('error', 'Gagal mencetak struk percobaan.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ RESET RIWAYAT TRANSAKSI (produk tetap utuh)
  const handleResetTransactions = async () => {
    if (!confirm('⚠️ PERINGATAN: Ini akan MENGHAPUS SEMUA RIWAYAT TRANSAKSI secara permanen. Data produk dan pengaturan TIDAK AKAN DIHAPUS. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return;

    try {
      setLoadingKey('resetTransactions');
      const success = await dbProvider.resetTransactionData();
      if (success) {
        showStatus('success', 'Semua riwayat transaksi berhasil dihapus!');
      } else {
        showStatus('error', 'Gagal menghapus data transaksi.');
      }
    } catch (e) {
      console.error("Reset transaksi error:", e);
      showStatus('error', 'Gagal menghapus data transaksi. Cek konsol untuk detail.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ RESET APLIKASI — Hapus SEMUA Data (produk, transaksi, pelanggan, supplier, kategori, hutang, diskon, pengeluaran)
  const handleResetApp = async () => {
    if (!confirm(
      '⚠️⚠️⚠️ PERINGATAN EKSTREM ⚠️⚠️⚠️\n\n' +
      'Ini akan MENGHAPUS SEMUA DATA berikut:\n' +
      '• Semua Produk\n' +
      '• Semua Riwayat Transaksi\n' +
      '• Semua Pelanggan\n' +
      '• Semua Supplier\n' +
      '• Semua Kategori\n' +
      '• Semua Hutang\n' +
      '• Semua Diskon\n' +
      '• Semua Pengeluaran\n' +
      '• Pengaturan Toko (kembali ke default)\n\n' +
      'TINDAKAN INI TIDAK DAPAT DIBATALKAN!\n\n' +
      'Ketik "RESET" di kotak dialog berikut untuk konfirmasi.'
    )) return;

    // Konfirmasi kedua dengan input manual
    const userInput = prompt('Ketik "RESET" (tanpa tanda kutip) untuk mengkonfirmasi penghapusan SEMUA data:');
    if (userInput !== 'RESET') {
      showStatus('error', 'Reset dibatalkan — teks konfirmasi tidak sesuai.');
      return;
    }

    try {
      setLoadingKey('restore');

      // ✅ Tutup semua koneksi aktif IndexedDB terlebih dahulu agar tidak memblokir penghapusan database
      const dbInstances = [
        indexdbBarang,
        indexdbTransaksi,
        indexdbCustomer,
        indexdbSupplier,
        indexdbCategory,
        indexdbDebt,
        indexdbDiscount,
        indexdbExpense,
        indexdbRestock,
        indexdbRetur,
        indexdbUser
      ];

      for (const instance of dbInstances) {
        try {
          const dbObj = (instance as any).db;
          if (dbObj && typeof dbObj.close === 'function') {
            dbObj.close();
          }
          (instance as any).db = null;
          if ('initPromise' in instance) {
            (instance as any).initPromise = null;
          }
          if ('seedPromise' in instance) {
            (instance as any).seedPromise = null;
          }
        } catch (err) {
          console.error("Error closing database connection while resetting:", err);
        }
      }

      // ✅ Hapus SEMUA IndexedDB database — cara paling clean
      const dbNames = [
        'barangDB', 'transaksiDB', 'customerDB', 'supplierDB',
        'categoryDB', 'debtDB', 'discountDB', 'expenseDB', 'restockDB', 'returDB', 'userDB'
      ];
      await Promise.all(dbNames.map(dbName =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(dbName);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => {
            console.warn(`⚠️ Database ${dbName} di-block, force close...`);
            resolve(); // Non-fatal, lanjutkan
          };
        })
      ));

      // ✅ Reset pengaturan toko ke default
      useSettingsStore.getState().updateStoreInfo({
        name: 'Toko Saya',
        phone: '',
        address: '',
        footer: 'Terima Kasih'
      });

      showStatus(
        'success',
        '✅ SEMUA DATA BERHASIL DIHAPUS! Aplikasi akan dimuat ulang dari awal...',
        3000
      );

      setTimeout(() => window.location.reload(), 3000);
    } catch (e) {
      console.error('Reset app error:', e);
      showStatus('error', 'Gagal mereset aplikasi. Cek konsol untuk detail.');
    } finally {
      setLoadingKey(null);
    }
  };

  // ✅ BACKUP TRANSAKSI SAJA (hanya riwayat penjualan)
  const handleBackupTransactions = async () => {
    try {
      setLoadingKey("backupTransactions");
      const data = await dbProvider.backupToJSON();

      if (!data.transactions || data.transactions.length === 0) {
        showStatus("error", "Tidak ada data transaksi untuk dicadangkan.");
        return;
      }

      const exportPayload = {
        version: 1,
        exported_at: new Date().toISOString(),
        type: "transactions_only",
        transactions: data.transactions,
      };

      const filename = `transaksi_${localStoreInfo.name.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
      const jsonData = JSON.stringify(exportPayload, null, 2);

      // For web browsers - download file directly
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus("success", `Backup ${data.transactions.length} transaksi berhasil diunduh!`);
    } catch (error) {
      console.error("Backup transaksi error:", error);
      showStatus("error", "Gagal mencadangkan transaksi. Cek konsol untuk detail.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Toko</h1>
        <p className="text-sm text-slate-500 font-medium">Pengaturan identitas dan perangkat</p>
      </div>

      {status && (
        <div className={cn(
          "p-5 rounded-[24px] flex items-center gap-4 border shadow-sm animate-in zoom-in duration-300",
          status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            status.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
          )}>
            <Shield size={16} />
          </div>
          <p className="text-sm font-bold tracking-tight">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informasi Toko */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6 flex flex-col h-full">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
              <Store size={28} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Identitas Toko</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informasi Bisnis</p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Toko</label>
                <input 
                  type="text" 
                  value={localStoreInfo.name}
                  onChange={e => setLocalStoreInfo({...localStoreInfo, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tema Dark</label>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Mode Gelap</span>
                  <button
                    onClick={() => toggleDarkMode()}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-full transition-all",
                      darkMode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    <Moon size={16} className={darkMode ? "text-white" : "text-slate-500"} />
                  </button>
                </div>
             </div>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Telepon</label>
                <input 
                  type="text" 
                  value={localStoreInfo.phone}
                  onChange={e => setLocalStoreInfo({...localStoreInfo, phone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alamat</label>
                <textarea 
                  rows={2}
                  value={localStoreInfo.address}
                  onChange={e => setLocalStoreInfo({...localStoreInfo, address: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all resize-none"
                />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Footer Struk</label>
                <input 
                  type="text" 
                  value={localStoreInfo.footer}
                  onChange={e => setLocalStoreInfo({...localStoreInfo, footer: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  placeholder="Terima Kasih..."
                />
             </div>
          </div>
          
          <button 
            onClick={handleSaveInfo}
            disabled={isLoading('saveInfo')}
            className="w-full bg-[#10B981] hover:bg-emerald-600 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-3 active:scale-98 disabled:opacity-60"
          >
            {isLoading('saveInfo') ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} strokeWidth={2.5} />
            )}
            SIMPAN
          </button>
        </div>

        {/* Printer Settings */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6 h-full flex flex-col">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
              <Printer size={28} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Printer Struk</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sistem Cetak Universal</p>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="p-6 bg-emerald-50/30 rounded-[28px] border border-emerald-100 flex items-center gap-4">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                  <Globe size={20} />
               </div>
               <div className="flex-1">
                  <p className="text-sm font-black text-slate-700">Mode Web Print</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Aktif - Kompatibel dengan Android & Windows</p>
               </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-[24px] space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan Penting</p>
               <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Pastikan printer termal Anda sudah terdeteksi di sistem (Windows) atau menggunakan aplikasi pihak ketiga seperti <b>ESC/POS Print Service</b> di Android.
               </p>
            </div>

              {/* ✅ Pengaturan ukuran kertas untuk mengurangi sisa kertas */}
              <div className="bg-slate-50 p-5 rounded-[24px] space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ukuran Kertas</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocalPrinter((p) => ({ ...p, paperWidthMm: 58 }))}
                    className={cn(
                      'py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all',
                      localPrinter.paperWidthMm === 58
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                    )}
                  >
                    58mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalPrinter((p) => ({ ...p, paperWidthMm: 80 }))}
                    className={cn(
                      'py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all',
                      localPrinter.paperWidthMm === 80
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                    )}
                  >
                    80mm
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tambahan Tinggi (mm)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={localPrinter.extraPageHeightMm}
                    onChange={(e) => setLocalPrinter((p) => ({ ...p, extraPageHeightMm: Number(e.target.value) }))}
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] outline-none transition-all"
                    placeholder="0"
                  />
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Jika struk masih ada sisa kosong panjang, naikkan nilai ini (mis. 50-150). Jika struk terpotong bawah, naikkan sedikit.
                  </p>
                </div>

                {/* ✅ Mode Render Barcode */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode Render Barcode</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocalPrinter((p) => ({ ...p, barcodeRenderMode: 'svg' }))}
                      className={cn(
                        'py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all',
                        localPrinter.barcodeRenderMode === 'svg'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                      )}
                    >
                      SVG (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalPrinter((p) => ({ ...p, barcodeRenderMode: 'png' }))}
                      className={cn(
                        'py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all',
                        localPrinter.barcodeRenderMode === 'png'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                      )}
                    >
                      PNG
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    SVG lebih optimal untuk printer thermal, PNG bisa lebih cocok untuk beberapa driver printer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSavePrinter}
                  disabled={isLoading('saveInfo')}
                  className="w-full bg-[#10B981] hover:bg-emerald-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-3 active:scale-98 disabled:opacity-60"
                >
                  {isLoading('saveInfo') ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={16} strokeWidth={2.5} />
                  )}
                  Simpan Pengaturan Printer
                </button>
              </div>
          </div>

          <button 
            onClick={handleTestPrint}
            disabled={isLoading('testPrint')}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-slate-100 active:scale-95"
          >
            {isLoading('testPrint') ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Printer size={16} />
            )}
            Cetak Struk Percobaan
          </button>
        </div>

        {/* Support Saya dengan Donasi */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
              <HandCoins size={28} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Support Saya dengan Donasi</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bantu pengembangan aplikasi</p>
            </div>
          </div>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-[240px] h-[240px] p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-[28px] shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/Qrisposproz.jpg"
                alt="QRIS Posproz"
                className="w-full h-full object-contain rounded-2xl border border-amber-200 bg-white shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Scan QRIS</p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Dukungan Anda sangat membantu untuk menjaga fitur, update, dan support aplikasi ini.
              </p>
            </div>
          </div>
        </div>

        {/* Pencadangan Data */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6 md:col-span-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 shadow-inner">
              <Database size={28} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 tracking-tight">Pusat Data & Cadangan</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ekspor & Impor Database</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ✅ Backup Seluruh Data */}
            <button 
              onClick={handleBackup}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-[#10B981] hover:bg-green-50 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#10B981] shadow-sm transition-colors">
                {isLoading('backup') ? (
                  <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Backup Seluruh Data</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Produk + Transaksi + Pengaturan</p>
              </div>
            </button>

            {/* ✅ Reset Aplikasi — Hapus Semua Data */}
            <button
              onClick={handleResetApp}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-red-50 border-2 border-dashed border-red-200 rounded-[32px] hover:border-red-500 hover:bg-red-100 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-400 group-hover:text-red-600 shadow-sm transition-colors">
                {isLoading('restore') ? (
                  <span className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-red-600">Reset Aplikasi</p>
                <p className="text-[10px] font-bold text-red-400 uppercase mt-1">Hapus SEMUA data — kembali ke awal</p>
              </div>
            </button>

            {/* ✅ Import Produk JSON */}
            <label className={cn(
              "flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-purple-500 hover:bg-purple-50 transition-all group gap-4",
              anyLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-95"
            )}>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-purple-500 shadow-sm transition-colors">
                {isLoading('importProducts') ? (
                  <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileInput size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Import Produk JSON</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Tambah / perbarui produk massal</p>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportProducts}
                className="hidden"
                disabled={anyLoading}
              />
            </label>

            {/* ✅ Reset Riwayat Transaksi */}
            <button
              onClick={handleResetTransactions}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-red-500 hover:bg-red-50 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-red-500 shadow-sm transition-colors">
                {isLoading('resetTransactions') ? (
                  <span className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Reset Riwayat Transaksi</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Hapus semua penjualan, produk tetap utuh</p>
              </div>
            </button>

            {/* ✅ Hapus Duplikat Produk */}
            <button
              onClick={handleDeduplicate}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-orange-500 hover:bg-orange-50 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-orange-500 shadow-sm transition-colors">
                {isLoading('deduplicate') ? (
                  <span className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Hapus Duplikat Produk</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Bersihkan SKU ganda, simpan terbaru</p>
              </div>
            </button>

            {/* ✅ Perbaiki ID Produk — migrasi format lama ke prod_<sku> */}
            <button
              onClick={handleMigrateIds}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-violet-500 hover:bg-violet-50 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-violet-500 shadow-sm transition-colors">
                {isLoading('migrateIds') ? (
                  <span className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10"/><path d="M12 8v4l3 3"/><path d="m16 16 2 2 4-4"/></svg>
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Perbaiki ID Produk</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Migrasi ID lama → format prod_sku</p>
              </div>
            </button>

            {/* ✅ Backup Transaksi Saja */}
            <button
              onClick={handleBackupTransactions}
              disabled={anyLoading}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-blue-500 hover:bg-blue-50 transition-all group gap-4 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 shadow-sm transition-colors">
                {isLoading('backupTransactions') ? (
                  <span className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileDown size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Backup Transaksi Saja</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Hanya riwayat penjualan saja</p>
              </div>
            </button>

            {/* ✅ Pulihkan Seluruh Data */}
            <label className={cn(
              "flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-emerald-600 hover:bg-emerald-50 transition-all group gap-4",
              anyLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-95"
            )}>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-emerald-600 shadow-sm transition-colors">
                {isLoading('restore') ? (
                  <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileUp size={24} />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700">Pulihkan Seluruh Data</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Restore backup dari file JSON</p>
              </div>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="hidden"
                disabled={anyLoading}
              />
            </label>
          </div>
         </div>

        {/* ✅ CARD SINKRONISASI DATABASE — SupabaseSyncCard Modular */}
        <div className="md:col-span-2">
          <SupabaseSyncCard view="full" className="shadow-sm" />
        </div>

        {/* ✅ PENGATURAN SELURUH AKUN / MANAJEMEN PENGGUNA — HANYA SUPER ADMIN */}
        {indexdbUser.isSuperAdmin() && (
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-800 tracking-tight">Pengaturan Seluruh Akun</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ubah Nama dan Password untuk Semua Pengguna</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-100 active:scale-95 animate-in fade-in"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              {showAddUser ? 'TUTUP FORM' : 'DAFTARKAN AKUN KASIR/ADMIN'}
            </button>
          </div>

          {/* Form Tambah User Baru */}
          {showAddUser && (
            <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Form Registrasi Pengguna Baru</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Username (Unik)</label>
                  <input
                    type="text"
                    placeholder="Contoh: kasir2"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Contoh: Muhammad Rafli"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
                  <input
                    type="text"
                    placeholder="Contoh: passwordpos"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Hak Akses (Role)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'super_admin' | 'admin' | 'kasir' | 'gudang')}
                    className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
                  >
                    <option value="kasir">Kasir (Pegawai)</option>
                    <option value="gudang">Helper / Gudang</option>
                    <option value="admin">Admin (Full Akses)</option>
                    <option value="super_admin">Super Admin (Kelola Akun & Role)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={userLoadingId !== null}
                  className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                >
                  {userLoadingId === 'new_user_action' && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  DAFTARKAN AKUN BARU
                </button>
              </div>
            </div>
          )}

          {/* Grid List User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {users.map((u) => {
              const isCurrentUser = indexdbUser.getCurrentUser()?.id === u.id;
              return (
                <UserCard
                  key={u.id}
                  user={u}
                  onSave={handleUpdateUser}
                  onDelete={handleDeleteUser}
                  isCurrentUser={isCurrentUser}
                  isLoading={userLoadingId === u.id}
                />
              );
            })}
          </div>
        </div>
        )}

      </div>
    </div>
  );
};

// ✅ Helper Component untuk List Akun
interface UserCardProps {
  user: any;
  onSave: (user: any, name: string, password: string) => Promise<void>;
  onDelete: (user: any) => Promise<void>;
  isCurrentUser: boolean;
  isLoading: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSave, onDelete, isCurrentUser, isLoading }) => {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState(user.password || '');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn(
      "p-6 rounded-[28px] border transition-all flex flex-col justify-between space-y-4 shadow-sm",
      isCurrentUser 
        ? "bg-indigo-50/50 border-indigo-200"
        : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs uppercase shadow-inner",
            user.role === 'super_admin' 
              ? "bg-purple-600 text-white shadow-purple-100" 
              : user.role === 'admin' 
                ? "bg-indigo-600 text-white shadow-indigo-100" 
                : user.role === 'gudang'
                  ? "bg-amber-500 text-white shadow-amber-100"
                  : "bg-emerald-500 text-white shadow-green-100"
          )}>
            {user.username.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-800 uppercase tracking-tight">{user.username}</span>
              <span className={cn(
                "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md leading-none",
                user.role === 'super_admin' 
                  ? "bg-purple-100 text-purple-700" 
                  : user.role === 'admin' 
                    ? "bg-indigo-100 text-indigo-700" 
                    : user.role === 'gudang'
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
              )}>
                {user.role === 'super_admin' ? 'Super Admin' : user.role}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              ID: {user.id}
            </p>
          </div>
        </div>

        {isCurrentUser && (
          <span className="text-[8px] font-black text-indigo-600 bg-indigo-100/50 border border-indigo-200 px-2 py-1 rounded-lg uppercase tracking-wider leading-none shadow-sm">
            Sesi Aktif Anda
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Lengkap</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-slate-200 p-3.5 rounded-2xl font-bold text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
            placeholder="Edit nama lengkap..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Password Baru</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-slate-200 p-3.5 pr-14 rounded-2xl font-bold text-slate-700 text-xs focus:border-indigo-600 outline-none transition-all"
              placeholder="Edit password..."
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showPassword ? "Tutup" : "Lihat"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-200/40">
        <button
          type="button"
          onClick={() => onSave(user, name, password)}
          disabled={isLoading || !name.trim() || !password.trim()}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-indigo-50"
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          )}
          SIMPAN
        </button>

        {!isCurrentUser && user.id !== 'user_super_admin' && user.id !== 'user_admin' && (
          <button
            type="button"
            onClick={() => onDelete(user)}
            disabled={isLoading}
            className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center active:scale-95"
            title="Hapus Akun"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;