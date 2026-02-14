/**
 * Connectivity Store
 *
 * Zustand store that tracks network connectivity state and
 * coordinates with the sync queue to process pending mutations
 * when connectivity is restored.
 */

import { create } from 'zustand';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { syncQueue, type SyncQueueState } from '@/services/sync-queue';

// ============================================================
// MARK: - Types
// ============================================================

interface ConnectivityState {
  /** Whether the device currently has network connectivity */
  isConnected: boolean;
  /** Whether the connectivity state has been determined */
  isReady: boolean;
  /** Number of mutations waiting to be synced */
  pendingCount: number;
  /** Whether the sync queue is currently processing */
  isSyncing: boolean;
  /** ISO timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** Number of permanently failed mutations */
  failedCount: number;
  /** Whether the offline banner has been manually dismissed */
  bannerDismissed: boolean;
}

interface ConnectivityActions {
  /** Initialize connectivity monitoring and sync queue */
  initialize: () => () => void;
  /** Manually trigger sync queue processing */
  triggerSync: () => Promise<void>;
  /** Clear permanently failed mutations */
  clearFailed: () => Promise<number>;
  /** Dismiss the offline banner */
  dismissBanner: () => void;
  /** Reset banner dismissed state (e.g. when going offline again) */
  resetBanner: () => void;
}

type ConnectivityStore = ConnectivityState & ConnectivityActions;

// ============================================================
// MARK: - Store
// ============================================================

export const useConnectivityStore = create<ConnectivityStore>((set, get) => ({
  // State
  isConnected: true,
  isReady: false,
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  failedCount: 0,
  bannerDismissed: false,

  // Actions
  initialize: () => {
    // Initialize sync queue
    void syncQueue.initialize();

    // Subscribe to sync queue state changes
    const unsubscribeSyncQueue = syncQueue.subscribe((state: SyncQueueState) => {
      set({
        pendingCount: state.pending,
        isSyncing: state.processing,
        lastSyncedAt: state.lastSyncedAt,
        failedCount: state.failedCount,
      });
    });

    // Set initial sync queue state
    const initialState = syncQueue.getState();
    set({
      pendingCount: initialState.pending,
      isSyncing: initialState.processing,
      lastSyncedAt: initialState.lastSyncedAt,
      failedCount: initialState.failedCount,
    });

    // Subscribe to network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = get().isConnected;
      const isNowConnected = state.isConnected ?? false;

      set({
        isConnected: isNowConnected,
        isReady: true,
      });

      // If we just came back online, reset banner and process queue
      if (!wasConnected && isNowConnected) {
        set({ bannerDismissed: false });

        if (__DEV__) {
          console.log('[Connectivity] Back online — processing sync queue...');
        }

        void syncQueue.processQueue();
      }

      // If we just went offline, reset banner dismissed state
      if (wasConnected && !isNowConnected) {
        set({ bannerDismissed: false });

        if (__DEV__) {
          console.log('[Connectivity] Went offline — mutations will be queued.');
        }
      }
    });

    // Fetch initial state
    void NetInfo.fetch().then((state: NetInfoState) => {
      set({
        isConnected: state.isConnected ?? true,
        isReady: true,
      });
    });

    // Return cleanup function
    return () => {
      unsubscribeNetInfo();
      unsubscribeSyncQueue();
    };
  },

  triggerSync: async () => {
    const { isConnected } = get();
    if (!isConnected) {
      if (__DEV__) {
        console.warn('[Connectivity] Cannot sync while offline');
      }
      return;
    }
    await syncQueue.processQueue();
  },

  clearFailed: async () => {
    return syncQueue.clearFailed();
  },

  dismissBanner: () => {
    set({ bannerDismissed: true });
  },

  resetBanner: () => {
    set({ bannerDismissed: false });
  },
}));
