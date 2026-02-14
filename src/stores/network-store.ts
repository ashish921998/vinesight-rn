/**
 * Network Store
 * Zustand store for tracking online/offline status using @react-native-community/netinfo.
 * Also manages the offline action queue sync state.
 */

import { create } from 'zustand';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import {
  processQueue,
  getPendingCount,
  getLastSyncTimestamp,
  subscribeToQueue,
  type QueuedAction,
} from '@/services/offline';

// ============================================================
// MARK: - Types
// ============================================================

interface NetworkState {
  /** Whether the device currently has internet connectivity */
  isConnected: boolean;
  /** Whether the connection status has been determined at least once */
  isInternetReachable: boolean | null;
  /** Connection type (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Number of pending offline actions */
  pendingActionCount: number;
  /** Whether the queue is currently syncing */
  isSyncing: boolean;
  /** Timestamp of last successful sync */
  lastSyncedAt: number | null;
}

interface NetworkActions {
  /** Initialize the network listener – call once at app startup */
  initialize: () => () => void;
  /** Manually trigger queue processing */
  syncNow: () => Promise<void>;
  /** Refresh pending count and last sync timestamp */
  refreshSyncState: () => Promise<void>;
}

// ============================================================
// MARK: - Store
// ============================================================

export const useNetworkStore = create<NetworkState & NetworkActions>()((set, get) => ({
  isConnected: true, // Optimistic default
  isInternetReachable: null,
  connectionType: null,
  pendingActionCount: 0,
  isSyncing: false,
  lastSyncedAt: null,

  initialize: () => {
    // Subscribe to NetInfo changes
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = get().isConnected;
      const isNowConnected = state.isConnected ?? false;

      set({
        isConnected: isNowConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });

      // Auto-process queue when connectivity is restored
      if (!wasConnected && isNowConnected) {
        if (__DEV__) {
          console.log('[NetworkStore] Connectivity restored – processing offline queue');
        }
        void get().syncNow();
      }
    });

    // Subscribe to queue changes to keep pendingActionCount in sync
    const unsubscribeQueue = subscribeToQueue((queue: QueuedAction[]) => {
      set({
        pendingActionCount: queue.filter(
          (a) => a.status === 'pending' || a.status === 'processing',
        ).length,
      });
    });

    // Load initial state
    void get().refreshSyncState();

    // Return cleanup function
    return () => {
      unsubscribeNetInfo();
      unsubscribeQueue();
    };
  },

  syncNow: async () => {
    if (get().isSyncing) return;
    if (!get().isConnected) return;

    set({ isSyncing: true });
    try {
      await processQueue();
      const lastSyncedAt = await getLastSyncTimestamp();
      set({ lastSyncedAt });
    } catch (error) {
      if (__DEV__) {
        console.error('[NetworkStore] Sync failed:', error);
      }
    } finally {
      set({ isSyncing: false });
      // Refresh pending count
      const count = await getPendingCount();
      set({ pendingActionCount: count });
    }
  },

  refreshSyncState: async () => {
    const [count, lastSyncedAt] = await Promise.all([
      getPendingCount(),
      getLastSyncTimestamp(),
    ]);
    set({ pendingActionCount: count, lastSyncedAt });
  },
}));
