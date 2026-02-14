/**
 * Sync Status Hook
 *
 * Provides connectivity and sync status information by combining
 * PowerSync's sync state with the pending write queue count.
 * Components can use this to show online/offline indicators and
 * pending change counts.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import { useMemo } from 'react';
import { useStatus } from '@powersync/react';
import { isPowerSyncConfigured } from '../lib/powersync';
import { usePendingSyncCount } from './use-pending-sync';

export interface SyncStatus {
  /** Whether PowerSync is configured and available */
  isOfflineCapable: boolean;
  /** Whether the device is currently connected to the PowerSync service */
  isConnected: boolean;
  /** Whether data is actively being uploaded or downloaded */
  isSyncing: boolean;
  /** Number of local writes waiting to be uploaded */
  pendingChanges: number;
  /** Whether there are any unsynced local changes */
  hasPendingChanges: boolean;
  /** Human-readable status label for UI display */
  statusLabel: string;
}

/**
 * Returns the current sync/connectivity status.
 *
 * When PowerSync is not configured, returns a default "online-only" status
 * (isConnected = true, no pending changes) since all operations go directly
 * to Supabase.
 *
 * Usage:
 * ```tsx
 * const { isConnected, pendingChanges, statusLabel } = useSyncStatus();
 * ```
 */
export function useSyncStatus(): SyncStatus {
  const powerSyncAvailable = isPowerSyncConfigured();
  const pendingChanges = usePendingSyncCount();

  // useStatus() is only valid inside a PowerSync context.
  // When PowerSync is not available, we provide sensible defaults.
  let psStatus: { connected: boolean; dataFlowStatus?: { uploading: boolean; downloading: boolean } } | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      psStatus = useStatus();
    }
  } catch {
    psStatus = null;
  }

  return useMemo((): SyncStatus => {
    if (!powerSyncAvailable || !psStatus) {
      return {
        isOfflineCapable: false,
        isConnected: true, // Assume online when PowerSync is not available
        isSyncing: false,
        pendingChanges: 0,
        hasPendingChanges: false,
        statusLabel: 'Online',
      };
    }

    const isConnected = psStatus.connected;
    const isSyncing =
      psStatus.dataFlowStatus?.uploading === true ||
      psStatus.dataFlowStatus?.downloading === true;
    const hasPendingChanges = pendingChanges > 0;

    let statusLabel: string;
    if (!isConnected && hasPendingChanges) {
      statusLabel = `Offline · ${pendingChanges} pending`;
    } else if (!isConnected) {
      statusLabel = 'Offline';
    } else if (isSyncing) {
      statusLabel = 'Syncing…';
    } else if (hasPendingChanges) {
      statusLabel = `${pendingChanges} pending`;
    } else {
      statusLabel = 'Synced';
    }

    return {
      isOfflineCapable: true,
      isConnected,
      isSyncing,
      pendingChanges,
      hasPendingChanges,
      statusLabel,
    };
  }, [powerSyncAvailable, psStatus, pendingChanges]);
}
