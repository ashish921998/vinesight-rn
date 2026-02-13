/**
 * Network Status Hook
 *
 * Provides real-time network connectivity information to the UI.
 * Uses @react-native-community/netinfo to detect online/offline state.
 *
 * Usage:
 * ```tsx
 * const { isOnline, isOffline, connectionType } = useNetworkStatus();
 *
 * if (isOffline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import NetInfo, { type NetInfoState, type NetInfoStateType } from '@react-native-community/netinfo';

// ============================================================
// MARK: - Types
// ============================================================

export interface NetworkStatus {
  /** Whether the device has an active internet connection */
  isOnline: boolean;
  /** Convenience inverse of isOnline */
  isOffline: boolean;
  /** The type of connection (wifi, cellular, none, etc.) */
  connectionType: NetInfoStateType | null;
  /** Whether the connection is expensive (e.g., cellular data) */
  isExpensive: boolean;
  /** Whether the network status has been determined at least once */
  isReady: boolean;
}

// ============================================================
// MARK: - Hook Implementation
// ============================================================

/**
 * Hook that monitors network connectivity status.
 *
 * Subscribes to NetInfo events and provides reactive network state.
 * The hook automatically cleans up the subscription on unmount.
 *
 * @returns NetworkStatus object with connectivity information
 */
export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>({
    isOnline: true, // Optimistic default
    isOffline: false,
    connectionType: null,
    isExpensive: false,
    isReady: false,
  });

  const handleNetworkChange = useCallback((netInfoState: NetInfoState) => {
    const isConnected = netInfoState.isConnected ?? false;
    const isInternetReachable = netInfoState.isInternetReachable ?? isConnected;
    const online = isConnected && isInternetReachable;

    setState({
      isOnline: online,
      isOffline: !online,
      connectionType: netInfoState.type,
      isExpensive: netInfoState.details
        ? 'isConnectionExpensive' in netInfoState.details
          ? Boolean(netInfoState.details.isConnectionExpensive)
          : false
        : false,
      isReady: true,
    });
  }, []);

  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then(handleNetworkChange).catch(() => {
      // If fetch fails, assume online (optimistic)
      setState((prev) => ({ ...prev, isReady: true }));
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      unsubscribe();
    };
  }, [handleNetworkChange]);

  return state;
}
