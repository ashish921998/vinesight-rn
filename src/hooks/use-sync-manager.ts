/**
 * Sync Manager Hook
 * Initializes the network listener and sync processor.
 * Should be used once at the app root level.
 */

import { useEffect, useRef } from 'react';
import { useNetworkStore } from '@/stores/network-store';
import { useSyncStore } from '@/stores/sync-store';
import { processSyncQueue } from '@/services/sync-processor';
import { getPendingCount, getFailedCount } from '@/services/sync-queue-service';

/**
 * Initialize and manage the offline sync system.
 * Call this once in the root layout component.
 */
export function useSyncManager(): void {
  const initializeNetwork = useNetworkStore((s) => s.initialize);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const hasCheckedInitial = useNetworkStore((s) => s.hasCheckedInitial);
  const updateCounts = useSyncStore((s) => s.updateCounts);
  const refreshStatus = useSyncStore((s) => s.refreshStatus);

  const wasOfflineRef = useRef(false);

  // Initialize network listener
  useEffect(() => {
    const unsubscribe = initializeNetwork();
    return unsubscribe;
  }, [initializeNetwork]);

  // Load initial queue counts
  useEffect(() => {
    const loadCounts = async () => {
      const pending = await getPendingCount();
      const failed = await getFailedCount();
      updateCounts(pending, failed);
    };

    loadCounts();
  }, [updateCounts]);

  // Watch for connectivity changes and trigger sync
  useEffect(() => {
    if (!hasCheckedInitial) return;

    if (!isConnected) {
      wasOfflineRef.current = true;
      refreshStatus();
      return;
    }

    // Just came back online - process the queue
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;

      if (__DEV__) {
        console.log('[SyncManager] Connectivity restored, processing sync queue');
      }

      processSyncQueue().then(() => {
        refreshStatus();
      });
    }

    refreshStatus();
  }, [isConnected, hasCheckedInitial, refreshStatus]);
}
