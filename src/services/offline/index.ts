/**
 * Offline Services - Barrel Export
 * Central export for all offline hardening modules.
 */

export { StorageManager } from './StorageManager';
export { networkMonitor, NetworkContext, useNetworkState, useIsOnline } from './NetworkMonitor';
export { offlineQueue } from './OfflineQueue';
export { syncEngine } from './SyncEngine';
export type {
  CacheEntry,
  StorageBudget,
  NetworkState,
  QueuedMutation,
  SyncStatus,
  SyncConfig,
  ConflictStrategy,
  OfflineQueryOptions,
  OfflineQueryResult,
} from './types';
