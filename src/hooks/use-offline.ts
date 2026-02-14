/**
 * Offline Hook
 * Convenience hook for offline-aware data fetching and mutations.
 */

import { useCallback } from 'react';
import { useNetworkStore } from '@/stores/network-store';
import { cacheFetch, cacheGet, cacheSet, enqueueAction } from '@/services/offline';

// ============================================================
// MARK: - useOffline
// ============================================================

/**
 * Returns network state and helpers for offline-aware operations.
 */
export function useOffline() {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const pendingActionCount = useNetworkStore((s) => s.pendingActionCount);
  const lastSyncedAt = useNetworkStore((s) => s.lastSyncedAt);
  const syncNow = useNetworkStore((s) => s.syncNow);

  /**
   * Fetch data with cache-first strategy.
   * Uses cached data when available; falls back to network.
   * Returns stale cache if network fails.
   */
  const fetchWithCache = useCallback(
    <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => cacheFetch<T>(key, fetcher, ttl),
    [],
  );

  /**
   * Queue a mutation for later execution if offline.
   * If online, the caller should execute immediately and skip queueing.
   */
  const queueMutation = useCallback(
    (type: string, payload: unknown) => enqueueAction(type, payload),
    [],
  );

  return {
    isConnected,
    isSyncing,
    pendingActionCount,
    lastSyncedAt,
    syncNow,
    fetchWithCache,
    queueMutation,
    cacheGet,
    cacheSet,
  };
}
