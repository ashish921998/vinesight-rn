/**
 * useNetworkStatus – Reactive hook for device connectivity state.
 *
 * Wraps @react-native-community/netinfo and exposes a simple
 * `isConnected` / `isInternetReachable` surface that the rest of
 * the offline-first UI layer can consume.
 */

import { useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  /** `true` when the device has an active network interface. */
  isConnected: boolean;
  /** `true` when the device can actually reach the internet. */
  isInternetReachable: boolean;
  /** `true` while the initial fetch is still in-flight. */
  isLoading: boolean;
  /** `true` when the device just came back online (for brief "Back online" toast). */
  justReconnected: boolean;
  /** `true` when the device is on a cellular connection. */
  isCellular: boolean;
}

/**
 * Subscribe to real-time network changes.
 *
 * @param reconnectedDuration – How long `justReconnected` stays `true` (ms).
 *   Defaults to 3 000 ms.
 */
export function useNetworkStatus(reconnectedDuration = 3_000): NetworkStatus {
  const [state, setState] = useState<Omit<NetworkStatus, 'justReconnected'>>({
    isConnected: true,
    isInternetReachable: true,
    isLoading: true,
    isCellular: false,
  });
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleChange = (netState: NetInfoState) => {
      const connected = netState.isConnected ?? false;
      const reachable = netState.isInternetReachable ?? connected;
      const cellular = netState.type === 'cellular';

      setState({
        isConnected: connected,
        isInternetReachable: reachable,
        isLoading: false,
        isCellular: cellular,
      });

      // Detect reconnection
      if (connected && reachable && wasOfflineRef.current) {
        setJustReconnected(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setJustReconnected(false), reconnectedDuration);
      }

      wasOfflineRef.current = !connected || !reachable;
    };

    const unsubscribe = NetInfo.addEventListener(handleChange);

    // Also do an initial fetch
    void NetInfo.fetch().then(handleChange);

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reconnectedDuration]);

  return { ...state, justReconnected };
}
