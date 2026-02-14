/**
 * useBackgroundSync – React hook for background sync status and control.
 *
 * Exposes background sync state (last sync time, next scheduled sync,
 * pending count, sync log) and actions (manual trigger, register/unregister).
 *
 * Phase 7: Background Sync & Periodic Refresh
 */

import { useCallback, useEffect } from 'react';
import { useBackgroundSyncStore } from '../stores/background-sync-store';
import {
  executeSync,
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncRegistered,
  getConfig,
  updateConfig,
  type BackgroundSyncConfig,
} from '../services/background-sync-service';
import { getQueueStats } from '../services/sync-queue-service';

// ============================================================
// MARK: - Hook
// ============================================================

export interface UseBackgroundSyncReturn {
  /** Whether the background fetch task is registered with the OS. */
  isRegistered: boolean;
  /** Whether a sync is currently in progress. */
  isSyncing: boolean;
  /** ISO timestamp of the last successful sync. */
  lastSyncAt: string | null;
  /** ISO timestamp of the last data refresh. */
  lastRefreshAt: string | null;
  /** Approximate next scheduled sync time (OS controls actual timing). */
  nextScheduledAt: string | null;
  /** Number of pending mutations in the sync queue. */
  pendingMutationCount: number;
  /** Last error encountered during sync. */
  lastError: string | null;
  /** Recent sync activity log entries. */
  syncLog: Array<{ timestamp: string; level: string; message: string }>;

  /** Manually trigger a full sync cycle. */
  triggerSync: () => Promise<void>;
  /** Register the background sync task with the OS. */
  register: () => Promise<boolean>;
  /** Unregister the background sync task. */
  unregister: () => Promise<void>;
  /** Update background sync configuration. */
  configure: (patch: Partial<BackgroundSyncConfig>) => Promise<BackgroundSyncConfig>;
  /** Refresh the pending mutation count from the queue. */
  refreshPendingCount: () => Promise<void>;
}

/**
 * Hook to interact with the background sync system.
 *
 * On mount, checks whether the background task is registered and
 * refreshes the pending mutation count.
 */
export function useBackgroundSync(): UseBackgroundSyncReturn {
  const {
    isRegistered,
    isSyncing,
    lastSyncAt,
    lastRefreshAt,
    nextScheduledAt,
    pendingMutationCount,
    lastError,
    syncLog,
    setRegistered,
    setPendingMutationCount,
  } = useBackgroundSyncStore();

  // On mount: check registration status and pending count
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const [registered, stats] = await Promise.all([
        isBackgroundSyncRegistered(),
        getQueueStats(),
      ]);
      if (cancelled) return;
      setRegistered(registered);
      setPendingMutationCount(stats.total);
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [setRegistered, setPendingMutationCount]);

  const triggerSync = useCallback(async () => {
    await executeSync(true);
  }, []);

  const register = useCallback(async () => {
    return registerBackgroundSync();
  }, []);

  const unregister = useCallback(async () => {
    await unregisterBackgroundSync();
  }, []);

  const configure = useCallback(async (patch: Partial<BackgroundSyncConfig>) => {
    return updateConfig(patch);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const stats = await getQueueStats();
    setPendingMutationCount(stats.total);
  }, [setPendingMutationCount]);

  return {
    isRegistered,
    isSyncing,
    lastSyncAt,
    lastRefreshAt,
    nextScheduledAt,
    pendingMutationCount,
    lastError,
    syncLog,
    triggerSync,
    register,
    unregister,
    configure,
    refreshPendingCount,
  };
}
