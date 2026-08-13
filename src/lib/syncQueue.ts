/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 Sync Queue — Inti Offline-First
 * Semua operasi tulis (create/update/delete) masuk ke antrian Dexie lokal
 * dengan sync_status, lalu SyncService otomatis menyinkronkan ke Supabase
 * saat online. Ini memastikan data TIDAK PERNAH hilang meski offline.
 */

import { offlineDB, SyncStatus } from './dexieDb';
import { isPostgresConfigured } from './supabaseClient';

export type SyncTable = (typeof offlineDB.SYNC_TABLES)[number];

/**
 * Tulis/update data ke antrian lokal (Dexie) dengan sync_status.
 * - Jika data baru → 'created'
 * - Jika data sudah ada → 'updated'
 * SyncService akan mengirimnya ke Supabase saat online.
 */
export async function enqueueUpsert(table: SyncTable, data: Record<string, any>): Promise<void> {
  const now = Date.now();
  const existing = await (offlineDB as any)[table].get(data.id);

  const record = {
    ...data,
    id: data.id,
    sync_status: (existing ? 'updated' : 'created') as SyncStatus,
    updated_at: now,
    created_at: existing?.created_at ?? data.created_at ?? now,
  };

  await (offlineDB as any)[table].put(record);
}

/**
 * Tandai data sebagai 'deleted' di antrian lokal.
 * SyncService akan menghapusnya dari Supabase saat online.
 */
export async function enqueueDelete(table: SyncTable, id: string): Promise<void> {
  const existing = await (offlineDB as any)[table].get(id);
  if (existing) {
    await (offlineDB as any)[table].update(id, {
      sync_status: 'deleted' as SyncStatus,
      updated_at: Date.now(),
    });
  } else {
    // Tidak ada di lokal — langsung hapus dari cloud jika terkonfigurasi
    if (isPostgresConfigured) {
      const { supabase } = await import('./supabaseClient');
      await supabase.from(table).delete().eq('id', id);
    }
  }
}

/**
 * Baca semua data lokal dari antrian (fallback saat offline / baca cepat).
 */
export async function getAllLocal(table: SyncTable): Promise<any[]> {
  return (offlineDB as any)[table].toArray();
}

/**
 * Baca satu data lokal dari antrian.
 */
export async function getLocalById(table: SyncTable, id: string): Promise<any | undefined> {
  return (offlineDB as any)[table].get(id);
}