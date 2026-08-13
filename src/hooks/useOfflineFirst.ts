/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * React Hooks untuk Offline-First & Sync
 */

import { useEffect, useState, useCallback } from 'react';
import { offlineDetector } from '@/services/sync/OfflineDetector';
import { syncService } from '@/services/sync/SyncService';
import type { SyncStats } from '@/services/sync/SyncService';

/**
 * Hook untuk track online/offline status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => offlineDetector.getStatus());

  useEffect(() => {
    const unsubscribe = offlineDetector.subscribe(setIsOnline);
    return unsubscribe;
  }, []);

  return isOnline;
};

/**
 * Hook untuk track sync status
 */
export const useSyncStatus = () => {
  const [syncStats, setSyncStats] = useState<SyncStats>({
    isOnline: offlineDetector.getStatus(),
    isSyncing: false,
    pendingItems: 0,
  });

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setSyncStats);
    return unsubscribe;
  }, []);

  return syncStats;
};

/**
 * Hook untuk manual sync trigger
 */
export const useSyncNow = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const results = await syncService.syncNow();
      console.log('✅ Sync completed:', results);
      return results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('❌ Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { syncNow, isSyncing, error };
};

/**
 * Hook untuk combined online + sync status
 */
export const useOfflineFirst = () => {
  const isOnline = useOnlineStatus();
  const syncStats = useSyncStatus();

  return {
    isOnline,
    isSyncing: syncStats.isSyncing,
    pendingItems: syncStats.pendingItems,
    lastSyncTime: syncStats.lastSyncTime,
  };
};

/**
 * Hook untuk check pending items
 */
export const usePendingItems = () => {
  const [pendingItems, setPendingItems] = useState(0);

  useEffect(() => {
    const updatePendingItems = async () => {
      const stats = await syncService.getSyncStats();
      setPendingItems(stats.pendingItems);
    };

    updatePendingItems();
    const unsubscribe = syncService.subscribe((stats) => {
      setPendingItems(stats.pendingItems);
    });

    return unsubscribe;
  }, []);

  return pendingItems;
};
