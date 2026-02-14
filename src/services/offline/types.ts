/**
 * Offline System Types
 * Type definitions for the offline hardening layer
 */

// ============================================================
// MARK: - Storage Types
// ============================================================

/** Metadata stored alongside each cached item */
export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** ISO timestamp when the entry was stored */
  storedAt: string;
  /** TTL in milliseconds; null means no expiration */
  ttlMs: number | null;
  /** Approximate size in bytes */
  sizeBytes: number;
  /** Last access timestamp for LRU eviction */
  lastAccessedAt: string;
  /** Cache key for this entry */
  key: string;
}

/** Storage budget configuration */
export interface StorageBudget {
  /** Maximum storage in bytes (default: 100MB) */
  maxBytes: number;
  /** Current usage in bytes */
  currentBytes: number;
}

// ============================================================
// MARK: - Network Types
// ============================================================

/** Network connectivity state */
export interface NetworkState {
  /** Whether the device is connected to the internet */
  isConnected: boolean;
  /** Whether the connection is via WiFi */
  isWifi: boolean;
  /** Whether the connection is via cellular */
  isCellular: boolean;
  /** Connection type string */
  type: string;
  /** Whether the connection is considered "good" (WiFi or fast cellular) */
  isGoodConnection: boolean;
}

// ============================================================
// MARK: - Queue Types
// ============================================================

/** Queued mutation operation */
export interface QueuedMutation {
  /** Unique ID for this queued operation */
  id: string;
  /** Supabase table name */
  table: string;
  /** Operation type */
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  /** The payload to send */
  payload: Record<string, unknown>;
  /** Filter conditions for update/delete */
  filters?: Record<string, unknown>;
  /** ISO timestamp when the mutation was queued */
  createdAt: string;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Maximum retries before giving up */
  maxRetries: number;
  /** Current status */
  status: 'pending' | 'processing' | 'failed' | 'completed';
  /** Error message if failed */
  errorMessage?: string;
  /** Related entity type for sync tracking */
  entityType?: string;
  /** Related entity ID for sync tracking */
  entityId?: string | number;
}

// ============================================================
// MARK: - Sync Types
// ============================================================

/** Sync status for a specific entity */
export interface SyncStatus {
  /** Entity type (e.g., 'farms', 'irrigationRecords') */
  entityType: string;
  /** Entity ID */
  entityId: string | number;
  /** Current sync state */
  state: 'synced' | 'pending' | 'syncing' | 'conflict' | 'error';
  /** ISO timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** ISO timestamp of last local modification */
  lastModifiedAt: string;
  /** Error message if in error state */
  errorMessage?: string;
}

/** Conflict resolution strategy */
export type ConflictStrategy = 'last-write-wins' | 'server-wins' | 'client-wins';

/** Sync engine configuration */
export interface SyncConfig {
  /** Conflict resolution strategy */
  conflictStrategy: ConflictStrategy;
  /** Whether to auto-sync when connectivity is restored */
  autoSync: boolean;
  /** Minimum interval between syncs in ms */
  syncIntervalMs: number;
}

// ============================================================
// MARK: - Hook Types
// ============================================================

/** Options for offline-first data hooks */
export interface OfflineQueryOptions<T> {
  /** Cache key for storage */
  cacheKey: string;
  /** TTL for cached data in milliseconds */
  ttlMs?: number;
  /** Whether to fetch fresh data when online */
  fetchWhenOnline?: boolean;
  /** Transform function for cached data */
  transform?: (data: unknown) => T;
}

/** Result from offline-first data hooks */
export interface OfflineQueryResult<T> {
  /** The data (from cache or network) */
  data: T | undefined;
  /** Whether data is being loaded */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Whether the data is from cache */
  isFromCache: boolean;
  /** Whether a network fetch is in progress */
  isFetching: boolean;
  /** ISO timestamp of when data was last updated */
  lastUpdatedAt: string | null;
  /** Force refresh from network */
  refetch: () => Promise<void>;
}
