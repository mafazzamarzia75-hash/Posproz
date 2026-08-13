/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SupabaseSyncCard — Komponen modular untuk menghubungkan IndexedDB ke Supabase
 * secara offline-first. Bisa dipasang di halaman mana pun (Settings, Dashboard, dll)
 * 
 * Fitur:
 * ✅ Status koneksi real-time (Online/Offline/Terkonfigurasi)
 * ✅ Konfigurasi Supabase URL + Anon Key langsung dari card
 * ✅ Pending sync items per tabel
 * ✅ Sync Now dengan progress bar
 * ✅ Auto-sync toggle (periodik 30 detik)
 * ✅ Riwayat sinkronisasi terakhir
 * ✅ Mode expand/collapse untuk konfigurasi
 * ✅ Panduan lengkap setup Supabase (modal tutorial interaktif)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Database, 
  Cloud, 
  CloudOff, 
  Wifi, 
  WifiOff,
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader,
  Globe,
  Lock,
  Save,
  Plug,
  Clock,
  HardDrive,
  ArrowUpDown,
  ListChecks,
  XCircle,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  ArrowRight,
  FileText,
  Shield,
  Key,
  Table,
  Layers,
  Zap,
  Terminal,
  Info,
  Trash2
} from 'lucide-react';
import { isPostgresConfigured, clearSupabaseConfig } from '@/lib/supabaseClient';
import { offlineDB } from '@/lib/dexieDb';
import { syncService, type SyncResult } from '@/services/sync/SyncService';
import { useOfflineFirst, useSyncNow } from '@/hooks/useOfflineFirst';

// ─── Tipe Data ───────────────────────────────────────

interface PendingCounts {
  products: number;
  customers: number;
  suppliers: number;
  transactions: number;
  restocks: number;
  returs: number;
  total: number;
}

interface SyncHistoryItem {
  timestamp: number;
  results: SyncResult[];
  success: boolean;
}

type CardView = 'minimal' | 'compact' | 'full';

// ─── Helper ───────────────────────────────────────────

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'baru saja';
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
};

const tableLabel: Record<string, string> = {
  products: 'Produk',
  customers: 'Pelanggan',
  suppliers: 'Supplier',
  transactions: 'Transaksi',
  restocks: 'Restok',
  returs: 'Retur',
};

// ─── Ambil env dari import.meta dengan safe cast ─────
const meta = import.meta as any;

// Helper aman untuk membaca localStorage (hindari SecurityError di mode privasi)
const getStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// ─── DATA TUTORIAL STEP ───────────────────────────────

const tutorialSteps = [
  {
    icon: <Globe size={20} />,
    title: '1. Buat Project di Supabase',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Buka <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-1">supabase.com <ExternalLink size={12} /></a> dan login/daftar akun. Klik tombol <strong>"New Project"</strong>.
        </p>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">1</span>
            </div>
            <p className="text-sm font-medium text-slate-700">Isi <strong>Name</strong>: <code className="bg-slate-200 px-1.5 rounded text-xs">pospro-db</code> (atau nama sesuai toko Anda)</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">2</span>
            </div>
            <p className="text-sm font-medium text-slate-700">Set <strong>Database Password</strong> yang kuat — simpan baik-baik!</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">3</span>
            </div>
            <p className="text-sm font-medium text-slate-700">Pilih <strong>Region</strong> yang terdekat (mis. Southeast Asia)</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">4</span>
            </div>
            <p className="text-sm font-medium text-slate-700">Klik <strong>"Create new project"</strong> — tunggu ±2 menit</p>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: <Key size={20} />,
    title: '2. Dapatkan URL & Anon Key',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Setelah project jadi, masuk ke <strong>Project Settings</strong> (ikon gear ⚙️) → <strong>API</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-200 rounded-lg flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <Copy size={12} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Supabase URL</p>
              <p className="text-sm font-mono text-amber-900 break-all mt-0.5">
                https://[project-id].supabase.co
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-200 rounded-lg flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <Lock size={12} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Supabase Anon Key</p>
              <p className="text-sm font-mono text-amber-900 break-all mt-0.5">
                eyJhbGciOiJIUzI1NiIs...
              </p>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-700">
            <strong>Tips:</strong> Jangan gunakan Service Key (secret). Gunakan Anon Key yang aman untuk client-side.
          </p>
        </div>
      </div>
    )
  },
  {
    icon: <Table size={20} />,
    title: '3. Buat Tabel Database',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Masuk ke <strong>SQL Editor</strong> → <strong>New Query</strong>. Copy-paste SQL di bawah lalu jalankan:
        </p>
        <div className="relative group">
          <pre className="bg-slate-900 text-green-300 p-4 rounded-xl text-xs leading-relaxed overflow-x-auto max-h-60 overflow-y-auto font-mono">
{`-- ============================================
-- POSPro Offline-First Database Schema
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Products (Produk)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT DEFAULT 'Umum',
  price_retail NUMERIC DEFAULT 0,
  price_wholesale NUMERIC DEFAULT 0,
  price_cost NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  description TEXT,
  barcode TEXT,
  image_url TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (Kategori Produk)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (Pelanggan)
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit NUMERIC DEFAULT 0,
  credit_used NUMERIC DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  contact_person TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (Transaksi Penjualan)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  transaction_type TEXT DEFAULT 'penjualan',
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  customer_id TEXT,
  supplier_id TEXT,
  items JSONB DEFAULT '[]',
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'tunai',
  notes TEXT,
  cashier_id TEXT,
  is_draft BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon key (sesuaikan jika perlu auth)
CREATE POLICY "Allow all for anon" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Index untuk performa
CREATE INDEX idx_products_updated ON products(updated_at);
CREATE INDEX idx_customers_updated ON customers(updated_at);
CREATE INDEX idx_suppliers_updated ON suppliers(updated_at);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);`}
          </pre>
          <button
            onClick={() => {
              const sql = `-- POSPro Offline-First Database Schema\nCREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT, category TEXT DEFAULT 'Umum', price_retail NUMERIC DEFAULT 0, price_wholesale NUMERIC DEFAULT 0, price_cost NUMERIC DEFAULT 0, stock NUMERIC DEFAULT 0, description TEXT, barcode TEXT, image_url TEXT, supplier_id TEXT, supplier_name TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), synced_at TIMESTAMPTZ DEFAULT NOW());\nCREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, credit_limit NUMERIC DEFAULT 0, credit_used NUMERIC DEFAULT 0, notes TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), synced_at TIMESTAMPTZ DEFAULT NOW());\nCREATE TABLE suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, contact_person TEXT, is_active BOOLEAN DEFAULT TRUE, notes TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), synced_at TIMESTAMPTZ DEFAULT NOW());\nCREATE TABLE transactions (id TEXT PRIMARY KEY, transaction_type TEXT DEFAULT 'penjualan', transaction_date TIMESTAMPTZ DEFAULT NOW(), customer_id TEXT, supplier_id TEXT, items JSONB DEFAULT '[]', total_amount NUMERIC DEFAULT 0, paid_amount NUMERIC DEFAULT 0, payment_method TEXT DEFAULT 'tunai', notes TEXT, cashier_id TEXT, is_draft BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), synced_at TIMESTAMPTZ DEFAULT NOW());\nALTER TABLE products ENABLE ROW LEVEL SECURITY;\nALTER TABLE customers ENABLE ROW LEVEL SECURITY;\nALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;\nALTER TABLE transactions ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all for anon" ON products FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all for anon" ON customers FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all for anon" ON suppliers FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);\nCREATE INDEX idx_products_updated ON products(updated_at);\nCREATE INDEX idx_customers_updated ON customers(updated_at);\nCREATE INDEX idx_suppliers_updated ON suppliers(updated_at);\nCREATE INDEX idx_transactions_date ON transactions(transaction_date);`;
              navigator.clipboard.writeText(sql);
              // Show visual feedback
              const btn = document.getElementById('copy-sql-btn');
              if (btn) {
                btn.innerHTML = '<span class="text-emerald-400">✓ Copied!</span>';
                setTimeout(() => {
                  btn.innerHTML = '📋 Copy SQL';
                }, 2000);
              }
            }}
            id="copy-sql-btn"
            className="absolute top-2 right-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            📋 Copy SQL
          </button>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
          <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
          <p className="text-xs text-green-700">
            <strong>Pastikan</strong> tabel-tabel di atas sudah dibuat dengan benar. Jika ada error, periksa apakah tabel sudah ada (hapus dulu dengan <code className="bg-green-100 px-1 rounded">DROP TABLE IF EXISTS ...</code>).
          </p>
        </div>
      </div>
    )
  },
  {
    icon: <Shield size={20} />,
    title: '4. Konfigurasi RLS Policy',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Agar aplikasi bisa membaca/menulis ke database dari client browser, kita perlu memberikan akses ke <strong>Anon Key</strong>.
        </p>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Masuk ke <strong>Authentication → Policies</strong></p>
              <p className="text-xs text-slate-500 mt-0.5">Atau langsung ke <strong>SQL Editor</strong> dan jalankan query RLS di atas</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Pastikan setiap tabel memiliki policy <strong>"Allow all for anon"</strong></p>
              <p className="text-xs text-slate-500 mt-0.5">Seperti yang sudah disertakan di script SQL di langkah sebelumnya</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
              <span className="text-xs font-black">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Cek di <strong>Table Editor</strong> — pastikan ikon RLS tidak merah</p>
              <p className="text-xs text-slate-500 mt-0.5">RLS aktif = ada policy yang mengizinkan akses anonim</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">
            <strong>⚠️ Penting:</strong> Tanpa RLS policy yang benar, semua operasi ke database akan ditolak dengan error <code className="bg-red-100 px-1 rounded">401 Unauthorized</code> atau <code className="bg-red-100 px-1 rounded">403 Forbidden</code>.
          </p>
        </div>
      </div>
    )
  },
  {
    icon: <Terminal size={20} />,
    title: '5. Isi Konfigurasi di Card Ini',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Sekarang masukkan URL dan Anon Key ke form konfigurasi di bawah:
        </p>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
          <ol className="space-y-2 list-decimal list-inside text-sm text-slate-700">
            <li className="font-medium">Klik tombol <strong>"Konfigurasi"</strong> di card ini (jika belum terbuka)</li>
            <li className="font-medium">Copy <strong>Supabase URL</strong> dari dashboard ke field URL</li>
            <li className="font-medium">Copy <strong>Anon Key</strong> dari dashboard ke field Anon Key</li>
            <li className="font-medium">Klik <strong>"Simpan Konfigurasi"</strong></li>
            <li className="font-medium">Halaman akan reload — status berubah menjadi <span className="text-emerald-600 font-bold">"Koneksi Supabase Cloud"</span></li>
          </ol>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700">
            <strong>Selesai! 🎉</strong> Data Anda kini akan otomatis tersinkronisasi ke cloud setiap 30 detik saat online. Anda juga bisa klik <strong>"Sync Sekarang"</strong> untuk sinkronisasi manual.
          </p>
        </div>
      </div>
    )
  },
];

// ─── Komponen Utama ───────────────────────────────────

interface SupabaseSyncCardProps {
  /** Tampilan card: 'minimal' | 'compact' | 'full' */
  view?: CardView;
  /** Class tambahan untuk styling */
  className?: string;
  /** Callback saat sync selesai */
  onSyncComplete?: (results: SyncResult[]) => void;
  /** Tampilkan tombol konfigurasi (default: true) */
  showConfig?: boolean;
}

const SupabaseSyncCard: React.FC<SupabaseSyncCardProps> = ({
  view = 'compact',
  className = '',
  onSyncComplete,
  showConfig = true,
}) => {
  // ─── State ───────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({
    products: 0, customers: 0, suppliers: 0,
    transactions: 0, restocks: 0, returs: 0, total: 0,
  });
  const [syncProgress, setSyncProgress] = useState<{
    active: boolean;
    step: string;
    percent: number;
    currentTable?: string;
  }>({ active: false, step: '', percent: 0 });
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [configForm, setConfigForm] = useState({
    url: getStored('VITE_SUPABASE_URL') || meta.env?.VITE_SUPABASE_URL || '',
    anonKey: getStored('VITE_SUPABASE_ANON_KEY') || meta.env?.VITE_SUPABASE_ANON_KEY || '',
  });
  const [configStatus, setConfigStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [autoSync, setAutoSync] = useState(true);

  // ─── Hooks ───────────────────────────────────────
  const { isOnline, isSyncing, pendingItems, lastSyncTime } = useOfflineFirst();
  const { syncNow, isSyncing: manualSyncing, error: syncError } = useSyncNow();

  // ─── Refs ─────────────────────────────────────────
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Hitung pending items per tabel ──────────────
  const fetchPendingCounts = useCallback(async () => {
    try {
      const tables = ['products', 'customers', 'suppliers', 'transactions', 'restocks', 'returs'] as const;
      const counts = await Promise.all(
        tables.map(async (table) => {
          const count = await offlineDB.getPendingSyncData(table as any);
          return count.length;
        })
      );

      setPendingCounts({
        products: counts[0],
        customers: counts[1],
        suppliers: counts[2],
        transactions: counts[3],
        restocks: counts[4],
        returs: counts[5],
        total: counts.reduce((a, b) => a + b, 0),
      });
    } catch (error) {
      console.error('[SupabaseSyncCard] Error fetching pending counts:', error);
    }
  }, []);

  // ─── Refresh periodik ────────────────────────────
  useEffect(() => {
    fetchPendingCounts();
    refreshIntervalRef.current = setInterval(fetchPendingCounts, 5000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchPendingCounts]);

  // ─── Progress bar animasi ────────────────────────
  useEffect(() => {
    if (isSyncing || manualSyncing) {
      setSyncProgress({
        active: true,
        step: 'Menyinkronkan data...',
        percent: 10,
      });

      let progress = 10;
      progressIntervalRef.current = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90);
        setSyncProgress((prev) => ({
          ...prev,
          percent: Math.floor(progress),
          step: progress < 40 
            ? 'Mengirim data lokal ke cloud...' 
            : progress < 70 
              ? 'Menerima data dari cloud...'
              : 'Merekonsiliasi perubahan...',
        }));
      }, 800);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (syncProgress.active) {
        setSyncProgress({
          active: false,
          step: 'Sinkronisasi selesai!',
          percent: 100,
        });
        setTimeout(() => {
          setSyncProgress({ active: false, step: '', percent: 0 });
        }, 2000);

        if (lastSyncTime) {
          setSyncHistory((prev) => [
            {
              timestamp: lastSyncTime,
              results: [],
              success: !syncError,
            },
            ...prev.slice(0, 4),
          ]);
        }

        fetchPendingCounts();

        if (onSyncComplete) {
          syncService.getSyncStats().then((stats) => {
            if (stats.results) {
              onSyncComplete(stats.results);
            }
          });
        }
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isSyncing, manualSyncing, lastSyncTime]);

  // ─── Handle Sync ─────────────────────────────────
  const handleSyncNow = async () => {
    try {
      await syncNow();
    } catch (error) {
      console.error('[SupabaseSyncCard] Sync error:', error);
    }
  };

  // ─── Handle Simpan Konfigurasi ──────────────────
  const handleSaveConfig = async () => {
    if (!configForm.url || !configForm.anonKey) {
      setConfigStatus({
        type: 'error',
        message: 'URL dan Anon Key harus diisi!',
      });
      return;
    }

    if (!configForm.url.startsWith('https://')) {
      setConfigStatus({
        type: 'error',
        message: 'URL harus menggunakan HTTPS!',
      });
      return;
    }

    // Normalisasi URL: hapus path tambahan (mis. /rest/v1/) agar tidak dobel
    const normalizedUrl = configForm.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

    try {
      localStorage.setItem('VITE_SUPABASE_URL', normalizedUrl);
      localStorage.setItem('VITE_SUPABASE_ANON_KEY', configForm.anonKey);

      setConfigStatus({
        type: 'success',
        message: 'Konfigurasi disimpan! Muat ulang halaman untuk menerapkan.',
      });

      setTimeout(() => {
        if (confirm('Konfigurasi Supabase berhasil disimpan. Muat ulang halaman sekarang?')) {
          window.location.reload();
        }
      }, 500);
    } catch (error) {
      setConfigStatus({
        type: 'error',
        message: 'Gagal menyimpan konfigurasi: ' + String(error),
      });
    }
  };

  // ─── Handle Hapus Konfigurasi ──────────────────
  const handleClearConfig = async () => {
    if (!confirm('Hapus konfigurasi Supabase? Aplikasi akan kembali ke mode IndexedDB murni (offline-first dimatikan).')) {
      return;
    }

    clearSupabaseConfig();
    setConfigForm({ url: '', anonKey: '' });
    setConfigStatus({
      type: 'success',
      message: 'Konfigurasi dihapus! Muat ulang halaman untuk kembali ke mode IndexedDB.',
    });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // ─── Format Sisa Waktu ──────────────────────────
  const [timeAgo, setTimeAgo] = useState('');
  useEffect(() => {
    if (!lastSyncTime) {
      setTimeAgo('');
      return;
    }
    const update = () => setTimeAgo(formatTimeAgo(lastSyncTime));
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  // ─── Render Modal Tutorial ───────────────────────
  const TutorialModal = () => {
    if (!showTutorial) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTutorial(false)}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800">Panduan Setup Supabase</h2>
                <p className="text-xs text-slate-500 font-medium">5 langkah mudah menghubungkan database cloud</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
            >
              <XCircle size={18} />
            </button>
          </div>

          {/* Content — scrollable */}
          <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
            {tutorialSteps.map((step, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                    {step.icon}
                  </div>
                  <h3 className="font-bold text-sm text-slate-800">{step.title}</h3>
                </div>
                <div className="pl-11">
                  {step.content}
                </div>
                {/* Separator */}
                {idx < tutorialSteps.length - 1 && (
                  <div className="flex items-center gap-2 pt-2 pb-1">
                    <div className="flex-1 h-px bg-slate-100" />
                    <ArrowRight size={14} className="text-slate-300" />
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                )}
              </div>
            ))}

            {/* Final CTA */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 text-center space-y-3">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <div>
                <p className="font-bold text-slate-800">Siap untuk mencoba?</p>
                <p className="text-xs text-slate-500 mt-1">
                  Setelah semua langkah selesai, isi konfigurasi di card ini dan nikmati sinkronasi otomatis offline-first!
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTutorial(false);
                  setShowSettings(true);
                  setExpanded(true);
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Buka Konfigurasi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────
  const isMinimal = view === 'minimal';
  const isFull = view === 'full';

  return (
    <>
      {/* ─── Tutorial Modal ─── */}
      <TutorialModal />

      <div
        className={`rounded-2xl border transition-all duration-300 ${
          isPostgresConfigured
            ? 'border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20'
            : 'border-slate-200 bg-white'
        } ${className}`}
      >
        {/* ─── HEADER ─── */}
        <div
          className="p-5 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all ${
                isPostgresConfigured && isOnline
                  ? 'bg-emerald-100 text-emerald-600'
                  : isPostgresConfigured
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isPostgresConfigured ? (
                isOnline ? (
                  <Cloud size={22} />
                ) : (
                  <CloudOff size={22} />
                )
              ) : (
                <HardDrive size={22} />
              )}
            </div>

            <div>
              <h3 className="font-bold text-sm text-slate-800">
                {isPostgresConfigured
                  ? 'Koneksi Supabase Cloud'
                  : 'Mode Offline - IndexedDB'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isPostgresConfigured && isOnline
                      ? 'bg-emerald-100 text-emerald-700'
                      : isPostgresConfigured
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isPostgresConfigured && isOnline ? (
                    <>
                      <Wifi size={10} />
                      Online
                    </>
                  ) : isPostgresConfigured ? (
                    <>
                      <WifiOff size={10} />
                      Offline
                    </>
                  ) : (
                    <>
                      <Database size={10} />
                      Lokal
                    </>
                  )}
                </span>

                {pendingItems > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                    <ListChecks size={10} />
                    {pendingItems} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isFull && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncNow();
                }}
                disabled={manualSyncing || !isOnline}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 disabled:cursor-not-allowed"
              >
                {manualSyncing ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {manualSyncing ? 'Sync...' : 'Sync'}
              </button>
            )}

            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>
          </div>
        </div>

        {/* ─── EXPANDED CONTENT ─── */}
        {expanded && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top-2 duration-200">
            
            {/* ─── PROGRESS BAR ─── */}
            {(isSyncing || manualSyncing || syncProgress.active) && (
              <div className="space-y-2 bg-indigo-50/60 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader size={14} className="animate-spin text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700">
                      {syncProgress.step || 'Menyinkronkan...'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-indigo-600">
                    {syncProgress.percent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${syncProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* ─── ERROR MESSAGE ─── */}
            {syncError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-700">Gagal Sinkronisasi</p>
                  <p className="text-[11px] text-red-500 mt-0.5">{syncError}</p>
                </div>
              </div>
            )}

            {/* ─── SYNC INFO GRID ─── */}
            {!isMinimal && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Wifi size={12} />
                    Jaringan
                  </div>
                  <p className={`text-sm font-black ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Clock size={12} />
                    Sync Terakhir
                  </div>
                  <p className="text-sm font-black text-slate-700">
                    {timeAgo || 'Belum pernah'}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <ArrowUpDown size={12} />
                    Tertunda
                  </div>
                  <p className={`text-sm font-black ${
                    pendingItems > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {pendingItems} item
                  </p>
                </div>
              </div>
            )}

            {/* ─── PENDING ITEMS PER TABLE ─── */}
            {!isMinimal && pendingCounts.total > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Rincian Data Tertunda
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(tableLabel).map(([key, label]) => {
                    const count = pendingCounts[key as keyof PendingCounts] as number;
                    if (count === 0) return null;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2"
                      >
                        <span className="text-xs font-bold text-slate-600">{label}</span>
                        <span className="text-xs font-black text-amber-600">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── TOMBOL AKSI ─── */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSyncNow}
                disabled={manualSyncing || !isOnline}
                className="flex-1 min-w-[140px] py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {manualSyncing ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {manualSyncing ? 'Menyinkronkan...' : 'Sync Sekarang'}
              </button>

              {showConfig && (
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                    autoSync
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <Plug size={14} />
                  Auto {autoSync ? 'ON' : 'OFF'}
                </button>
              )}

              {showConfig && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                    showSettings
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Settings size={14} />
                  Konfigurasi
                </button>
              )}

              {/* ✅ TOMBOL PANDUAN — selalu tampil */}
              <button
                onClick={() => setShowTutorial(true)}
                className="px-4 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
              >
                <BookOpen size={14} />
                Panduan
              </button>
            </div>

            {/* ─── SETTINGS PANEL ─── */}
            {showSettings && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-3 duration-200">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-indigo-600" />
                  <h4 className="font-bold text-sm text-slate-700">Konfigurasi Supabase</h4>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Masukkan URL Project Supabase dan Anon Key untuk menghubungkan
                  database lokal (IndexedDB) dengan cloud PostgreSQL.
                </p>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Supabase URL
                    </label>
                    <input
                      type="url"
                      value={configForm.url}
                      onChange={(e) => setConfigForm({ ...configForm, url: e.target.value })}
                      placeholder="https://your-project.supabase.co"
                      className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl font-medium text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Supabase Anon Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={configForm.anonKey}
                        onChange={(e) => setConfigForm({ ...configForm, anonKey: e.target.value })}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full bg-white border border-slate-200 px-4 py-3 pr-12 rounded-xl font-mono text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      />
                      <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    </div>
                  </div>

                  {configStatus.type && (
                    <div
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold ${
                        configStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {configStatus.type === 'success' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                      {configStatus.message}
                    </div>
                  )}

                  <button
                    onClick={handleSaveConfig}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={14} />
                    Simpan Konfigurasi
                  </button>

                  {/* Tombol Hapus Konfigurasi — kembali ke mode IndexedDB murni */}
                  {isPostgresConfigured && (
                    <button
                      onClick={handleClearConfig}
                      className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-red-200"
                    >
                      <Trash2 size={14} />
                      Hapus Konfigurasi
                    </button>
                  )}
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Informasi</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Setelah menyimpan, halaman akan dimuat ulang untuk mengaktifkan koneksi.
                    Data Anda akan tetap aman di IndexedDB lokal dan otomatis disinkronkan.
                    Gunakan <strong>"Hapus Konfigurasi"</strong> untuk memutus Supabase dan kembali ke mode IndexedDB murni.
                  </p>
                </div>
              </div>
            )}

            {/* ─── SYNC HISTORY ─── */}
            {syncHistory.length > 0 && !isMinimal && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Riwayat Sinkronisasi
                </p>
                <div className="space-y-1.5">
                  {syncHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {item.success ? (
                          <CheckCircle2 size={12} className="text-emerald-500" />
                        ) : (
                          <AlertCircle size={12} className="text-red-500" />
                        )}
                        <span className="text-xs font-medium text-slate-600">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold ${
                        item.success ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {item.success ? 'Berhasil' : 'Gagal'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SupabaseSyncCard;