/**
 * useOnlineStatus Hook
 *
 * Provides real-time network connectivity state using @react-native-community/netinfo.
 * Returns `true` when the device has an active internet connection, `false` otherwise.
 *
 * Usage:
 * ```tsx
 * const isOnline = useOnlineStatus();
 * ```
 */

import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook that subscribes to network connectivity changes.
 * @returns `true` if the device is online, `false` if offline.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const handleChange = (state: NetInfoState) => {
      // isInternetReachable can be null during initial check
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
    };

    const unsubscribe = NetInfo.addEventListener(handleChange);

    // Fetch initial state
    void NetInfo.fetch().then(handleChange);

    return () => {
      unsubscribe();
    };
  }, []);

  return isOnline;
}
