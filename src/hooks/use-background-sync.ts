/**
 * useBackgroundSync – Hook for background & foreground sync orchestration.
 *
 * Responsibilities:
 *   • Registers the background-fetch task on mount
 *   • Listens for AppState transitions (background → foreground) and
 *     triggers an immediate sync pass on reconnection
 *   • Exposes sync status for UI consumption
 *
 * Usage:
 *   const { lastSyncAt, isSyncing, pendingCount, triggerSync } = useBackgroundSync();
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSyncStore, selectPendingCount } from '@/stores/sync-store';
import { registerBackgroundSync, runSyncPass } from '@/services/background-sync';

export interface BackgroundSyncState {
  /** ISO timestamp of the last successful sync, or `null` if never synced. */
  lastSyncAt: string | null;
  /** `true` while a sync pass is in progress. */
  isSyncing: boolean;
  /** Number of items still waiting to be synced. */
  pendingCount: number;
  /** Manually trigger a sync pass (e.g. pull-to-refresh). */
  triggerSync: () => Promise<void>;
}

/**
 * Hook that manages background sync registration and foreground
 * reconnection sync.
 *
 * Should be mounted once near the root of the app (e.g. in `_layout.tsx`).
 */
export function useBackgroundSync(): BackgroundSyncState {
  const lastSyncAt = useSyncStore((s) => s.lastSyncedAt);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pendingCount = useSyncStore(selectPendingCount);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Register background task on mount ────────────────────────────
  useEffect(() => {
    void registerBackgroundSync();
  }, []);

  // ── Foreground reconnection sync ─────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      const isNowActive = nextState === 'active';

      if (wasBackground && isNowActive) {
        if (__DEV__) console.log('[useBackgroundSync] App foregrounded – triggering sync.');
        void runSyncPass();
      }

      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ── Manual trigger ───────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    await runSyncPass();
  }, []);

  return {
    lastSyncAt,
    isSyncing,
    pendingCount,
    triggerSync,
  };
}
