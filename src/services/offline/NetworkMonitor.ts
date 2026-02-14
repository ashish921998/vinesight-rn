/**
 * NetworkMonitor
 * Real-time network state detection using @react-native-community/netinfo.
 * Provides a React context/provider and event-based API for components.
 */

import { createContext, useContext } from 'react';
import NetInfo, { type NetInfoState, type NetInfoSubscription } from '@react-native-community/netinfo';
import type { NetworkState } from './types';

// ============================================================
// MARK: - Default State
// ============================================================

const DEFAULT_NETWORK_STATE: NetworkState = {
  isConnected: true,
  isWifi: false,
  isCellular: false,
  type: 'unknown',
  isGoodConnection: true,
};

// ============================================================
// MARK: - Event Listener Types
// ============================================================

type NetworkListener = (state: NetworkState) => void;

// ============================================================
// MARK: - NetworkMonitor Class
// ============================================================

class NetworkMonitorImpl {
  private currentState: NetworkState = DEFAULT_NETWORK_STATE;
  private listeners: Set<NetworkListener> = new Set();
  private subscription: NetInfoSubscription | null = null;
  private initialized = false;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  /**
   * Start monitoring network state changes.
   * Call this once at app startup.
   */
  start(): void {
    if (this.initialized) return;

    this.subscription = NetInfo.addEventListener((state) => {
      this.handleStateChange(state);
    });

    this.initialized = true;

    // Fetch initial state
    NetInfo.fetch().then((state) => {
      this.handleStateChange(state);
    }).catch(() => {
      // Silently handle - we'll get updates from the listener
    });
  }

  /**
   * Stop monitoring network state changes.
   */
  stop(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }

  // ----------------------------------------------------------
  // State Access
  // ----------------------------------------------------------

  /**
   * Get the current network state.
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Check if the device is currently online.
   */
  isOnline(): boolean {
    return this.currentState.isConnected;
  }

  // ----------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------

  /**
   * Subscribe to network state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private handleStateChange(netInfoState: NetInfoState): void {
    const newState: NetworkState = {
      isConnected: netInfoState.isConnected ?? false,
      isWifi: netInfoState.type === 'wifi',
      isCellular: netInfoState.type === 'cellular',
      type: netInfoState.type,
      isGoodConnection:
        netInfoState.type === 'wifi' ||
        (netInfoState.type === 'cellular' &&
          netInfoState.details !== null &&
          'cellularGeneration' in netInfoState.details &&
          (netInfoState.details.cellularGeneration === '4g' ||
            netInfoState.details.cellularGeneration === '5g')),
    };

    const wasConnected = this.currentState.isConnected;
    this.currentState = newState;

    // Notify all listeners
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (error) {
        if (__DEV__) {
          console.error('[NetworkMonitor] Listener error:', error);
        }
      }
    }

    // Log connectivity changes in dev
    if (__DEV__ && wasConnected !== newState.isConnected) {
      console.log(
        `[NetworkMonitor] Connection ${newState.isConnected ? 'restored' : 'lost'} (${newState.type})`,
      );
    }
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

export const networkMonitor = new NetworkMonitorImpl();

// ============================================================
// MARK: - React Context
// ============================================================

export const NetworkContext = createContext<NetworkState>(DEFAULT_NETWORK_STATE);

/**
 * Hook to access the current network state from the NetworkProvider.
 */
export function useNetworkState(): NetworkState {
  return useContext(NetworkContext);
}

/**
 * Hook to check if the device is online.
 */
export function useIsOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected;
}

export default networkMonitor;
