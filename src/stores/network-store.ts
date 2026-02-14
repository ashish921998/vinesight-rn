/**
 * Network Status Store
 * Zustand store that tracks online/offline connectivity using NetInfo
 */

import { create } from 'zustand';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { NetworkState } from '@/types/sync';

// ============================================================
// MARK: - Store Interface
// ============================================================

interface NetworkStoreState extends NetworkState {
  /** Whether the initial connectivity check has completed */
  hasCheckedInitial: boolean;
}

interface NetworkStoreActions {
  /** Initialize the network listener */
  initialize: () => () => void;
  /** Manually update network state (for testing) */
  setNetworkState: (state: Partial<NetworkState>) => void;
}

// ============================================================
// MARK: - Store
// ============================================================

export const useNetworkStore = create<NetworkStoreState & NetworkStoreActions>((set) => ({
  // Initial state - assume online until we know otherwise
  isConnected: true,
  isWifi: false,
  connectionType: null,
  hasCheckedInitial: false,

  initialize: () => {
    // Perform initial fetch
    NetInfo.fetch().then((state: NetInfoState) => {
      set({
        isConnected: state.isConnected ?? true,
        isWifi: state.type === 'wifi',
        connectionType: state.type ?? null,
        hasCheckedInitial: true,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isConnected: state.isConnected ?? true,
        isWifi: state.type === 'wifi',
        connectionType: state.type ?? null,
        hasCheckedInitial: true,
      });
    });

    return unsubscribe;
  },

  setNetworkState: (state) => {
    set(state);
  },
}));
