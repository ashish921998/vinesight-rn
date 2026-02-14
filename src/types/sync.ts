/**
 * Offline Sync Types
 * Types for the mutation sync queue and offline write support
 */

import type { TableName } from './database';

// ============================================================
// MARK: - Sync Queue Types
// ============================================================

/** Operation types for sync queue entries */
export type SyncOperationType = 'insert' | 'update' | 'delete';

/** Status of a sync queue entry */
export type SyncQueueItemStatus = 'pending' | 'processing' | 'synced' | 'failed';

/** A single entry in the offline mutation sync queue */
export interface SyncQueueItem {
  /** Unique identifier for this queue entry */
  id: string;
  /** The Supabase table this mutation targets */
  table: TableName;
  /** The type of mutation */
  operation: SyncOperationType;
  /** The mutation payload (row data for insert/update, id for delete) */
  payload: Record<string, unknown>;
  /** The record ID (for update/delete operations) */
  recordId?: number;
  /** ISO 8601 timestamp when the mutation was created locally */
  createdAt: string;
  /** ISO 8601 timestamp of the last modification (for conflict resolution) */
  lastModified: string;
  /** Number of sync retry attempts */
  retryCount: number;
  /** Maximum retries before marking as failed */
  maxRetries: number;
  /** Current status of this queue entry */
  status: SyncQueueItemStatus;
  /** Error message if the sync failed */
  errorMessage?: string;
  /** User ID who created this mutation */
  userId?: string;
}

/** Input for creating a new sync queue item */
export type SyncQueueItemInput = Pick<
  SyncQueueItem,
  'table' | 'operation' | 'payload' | 'recordId' | 'userId'
>;

// ============================================================
// MARK: - Sync Status Types
// ============================================================

/** Overall sync status for the app */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

/** Summary of the current sync state */
export interface SyncState {
  /** Current overall sync status */
  status: SyncStatus;
  /** Number of pending (unsynced) mutations */
  pendingCount: number;
  /** Number of failed mutations */
  failedCount: number;
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Timestamp of the last successful sync */
  lastSyncedAt: string | null;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
}

// ============================================================
// MARK: - Conflict Resolution Types
// ============================================================

/** Strategy for resolving conflicts between local and server data */
export type ConflictResolutionStrategy = 'last-write-wins' | 'server-wins';

/** Result of a conflict resolution check */
export interface ConflictResolutionResult {
  /** Whether there was a conflict */
  hasConflict: boolean;
  /** The winning data (local or server) */
  resolvedData: Record<string, unknown> | null;
  /** Which side won */
  winner: 'local' | 'server' | 'none';
}

// ============================================================
// MARK: - Network Status Types
// ============================================================

/** Network connectivity state */
export interface NetworkState {
  /** Whether the device has internet connectivity */
  isConnected: boolean;
  /** Whether the connection is via WiFi */
  isWifi: boolean;
  /** The type of connection (wifi, cellular, etc.) */
  connectionType: string | null;
}
