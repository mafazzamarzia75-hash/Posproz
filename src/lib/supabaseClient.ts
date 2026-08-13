/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 SUPABASE CLIENT - POSTGRESQL GATEWAY
 * ✅ Mengubungkan aplikasi React langsung ke database PostgreSQL Supabase
 * ✅ Aman & Handal dari lingkungan browser web
 * 
 * Prioritas konfigurasi:
 * 1. localStorage (disimpan via UI di halaman Pengaturan / SupabaseSyncCard)
 * 2. import.meta.env (dari file .env saat build)
 */

import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;

// Helper aman untuk membaca localStorage (hindari SecurityError di mode privasi)
const getStored = (key: string): string | null => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

// Baca dari localStorage terlebih dahulu (disimpan via UI), fallback ke env vars
const storedUrl = getStored('VITE_SUPABASE_URL');
const storedAnonKey = getStored('VITE_SUPABASE_ANON_KEY');

// Export URL agar bisa dipakai modul lain (mis. OfflineDetector untuk health-check)
export const supabaseUrl = storedUrl || meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = storedAnonKey || meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Periksa kelengkapan konfigurasi
export const isPostgresConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-url.supabase.co'
);

if (!isPostgresConfigured) {
  console.warn("⚠️ [PostgreSQL]: Config Supabase (URL / Anon Key) belum diisi. Aplikasi berjalan menggunakan mode IndexedDB offline.");
} else {
  console.log("🟢 [PostgreSQL]: Supabase Client berhasil diinisialisasi. Database PostgreSQL siap melayani online.");
}

// Gunakan credentials dummy jika belum dikonfigurasi agar inisialisasi tidak melempar error fatal
const targetUrl = isPostgresConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const targetKey = isPostgresConfigured ? supabaseAnonKey : 'placeholder-anon-key-to-prevent-crash';

export const supabase = createClient(targetUrl, targetKey);

/**
 * Jenis mode database yang sedang aktif.
 * - 'offline-first-dexie': Supabase dikonfigurasi → sinkronisasi Dexie + cloud.
 * - 'indexeddb': Tanpa konfigurasi Supabase → murni IndexedDB lokal.
 */
export type DatabaseMode = 'offline-first-dexie' | 'indexeddb';

export function getDatabaseMode(): DatabaseMode {
  return isPostgresConfigured ? 'offline-first-dexie' : 'indexeddb';
}

/**
 * Hapus konfigurasi Supabase dari localStorage.
 * Setelah dipanggil, isPostgresConfigured menjadi false → aplikasi kembali
 * ke mode IndexedDB murni (offline-first Dexie dimatikan).
 */
export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem('VITE_SUPABASE_URL');
    localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
    console.log('🗑️ [PostgreSQL]: Konfigurasi Supabase dihapus. Mode IndexedDB aktif.');
  } catch (error) {
    console.error('Gagal menghapus konfigurasi Supabase:', error);
  }
}
