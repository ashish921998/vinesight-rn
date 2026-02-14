/**
 * Sync Store
 * Zustand store for tracking the overall sync state and pending mutation counts.
 */

import { create } from 'zustand';
import type { SyncStatus } from '@/types/sync';

// ============================================================
// MARK: - Store Interface
// ============================================================

interface SyncStoreState {
  /** Current overall sync status */
  status: SyncStatus;
  /** Number of pending (unsynced) mutations */
  pendingCount: number;
  /** Number of failed mutations */
  failedCount: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Timestamp of the last successful sync */
  lastSyncedAt: string | null;
}

interface SyncStoreActions {
  /** Set the syncing flag */
  setSyncing: (isSyncing: boolean) => void;
  /** Update pending and failed counts */
  updateCounts: (pendingCount: number, failedCount: number) => void;
  /** Increment the pending count (when a new mutation is queued) */
  incrementPending: () => void;
  /** Set the last synced timestamp */
  setLastSyncedAt: (timestamp: string) => void;
  /** Compute and update the overall status */
  refreshStatus: () => void;
}

// ============================================================
// MARK: - Status Computation
// ============================================================

function computeStatus(state: {
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
}): SyncStatus {
  if (!state.isOnline) return 'offline';
  if (state.isSyncing) return 'syncing';
  if (state.failedCount > 0) return 'error';
  if (state.pendingCount > 0) return 'pending';
  return 'synced';
}

// ============================================================
// MARK: - Store
// ============================================================

export const useSyncStore = create<SyncStoreState & SyncStoreActions>((set, get) => ({
  status: 'synced',
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  lastSyncedAt: null,

  setSyncing: (isSyncing) => {
    set({ isSyncing });
    get().refreshStatus();
  },

  updateCounts: (pendingCount, failedCount) => {
    set({ pendingCount, failedCount });
    get().refreshStatus();
  },

  incrementPending: () => {
    set((state) => ({ pendingCount: state.pendingCount + 1 }));
    get().refreshStatus();
  },

  setLastSyncedAt: (timestamp) => {
    set({ lastSyncedAt: timestamp });
  },

  refreshStatus: () => {
    const state = get();
    // We need to check network status from the network store
    // Import dynamically to avoid circular deps
    let isOnline = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useNetworkStore } = require('./network-store') as {
        useNetworkStore: { getState: () => { isConnected: boolean } };
      };
      isOnline = useNetworkStore.getState().isConnected;
    } catch {
      // Default to online if network store isn't available
    }

    const newStatus = computeStatus({
      isSyncing: state.isSyncing,
      pendingCount: state.pendingCount,
      failedCount: state.failedCount,
      isOnline,
    });

    if (newStatus !== state.status) {
      set({ status: newStatus });
    }
  },
}));
