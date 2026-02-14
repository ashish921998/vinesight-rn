/**
 * NetworkProvider
 * React context provider that manages network state and initializes
 * the offline system (StorageManager, NetworkMonitor, OfflineQueue, SyncEngine).
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  networkMonitor,
  NetworkContext,
  StorageManager,
  offlineQueue,
  syncEngine,
} from '@/services/offline';
import type { NetworkState } from '@/services/offline';

// ============================================================
// MARK: - Default State
// ============================================================

const DEFAULT_STATE: NetworkState = {
  isConnected: true,
  isWifi: false,
  isCellular: false,
  type: 'unknown',
  isGoodConnection: true,
};

// ============================================================
// MARK: - Provider Component
// ============================================================

interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app with network state context and initializes
 * all offline services on mount.
 *
 * Place this inside QueryClientProvider in the root layout.
 */
export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkState>(DEFAULT_STATE);

  useEffect(() => {
    // Initialize all offline services
    const init = async () => {
      try {
        await StorageManager.initialize();
        networkMonitor.start();
        await offlineQueue.initialize();
        await syncEngine.initialize();
      } catch (error) {
        if (__DEV__) {
          console.error('[NetworkProvider] Initialization error:', error);
        }
      }
    };

    init();

    // Subscribe to network state changes
    const unsubscribe = networkMonitor.subscribe((state) => {
      setNetworkState(state);
    });

    return () => {
      unsubscribe();
      networkMonitor.stop();
      offlineQueue.stop();
      syncEngine.stop();
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

export default NetworkProvider;
