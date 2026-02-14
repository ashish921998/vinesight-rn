/**
 * Offline Sync Queue Service
 *
 * Queues local writes when offline and replays them to Supabase
 * when connectivity is restored. Uses AsyncStorage for persistence
 * and implements last-write-wins conflict resolution with exponential
 * backoff retry.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { TableName } from '@/types/database';

// ============================================================
// MARK: - Types
// ============================================================

export type MutationOperation = 'INSERT' | 'UPDATE' | 'UPSERT' | 'DELETE';

export interface QueuedMutation {
  /** Unique ID for this queued mutation */
  id: string;
  /** Supabase table name */
  table: TableName;
  /** Type of operation */
  operation: MutationOperation;
  /** Row data for INSERT/UPDATE/UPSERT */
  data?: Record<string, unknown>;
  /** Filter conditions for UPDATE/DELETE (e.g. { id: 5 }) */
  filter?: Record<string, unknown>;
  /** ISO timestamp when the mutation was created locally */
  created_at: string;
  /** Number of upload attempts so far */
  attempts: number;
  /** Last error message if upload failed */
  last_error?: string;
  /** ISO timestamp of last attempt */
  last_attempted_at?: string;
}

export interface SyncConflict {
  mutation: QueuedMutation;
  error: string;
  resolved: boolean;
  resolution: 'last_write_wins' | 'skipped' | 'retried';
  timestamp: string;
}

export interface SyncQueueState {
  pending: number;
  processing: boolean;
  lastSyncedAt: string | null;
  failedCount: number;
}

type SyncQueueListener = (state: SyncQueueState) => void;

// ============================================================
// MARK: - Constants
// ============================================================

const QUEUE_STORAGE_KEY = '@vinesight/sync_queue';
const CONFLICTS_STORAGE_KEY = '@vinesight/sync_conflicts';
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// ============================================================
// MARK: - Helpers
// ============================================================

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

function getRetryDelay(attempt: number): number {
  const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

// ============================================================
// MARK: - SyncQueue Class
// ============================================================

class SyncQueue {
  private queue: QueuedMutation[] = [];
  private conflicts: SyncConflict[] = [];
  private processing = false;
  private initialized = false;
  private listeners: Set<SyncQueueListener> = new Set();
  private lastSyncedAt: string | null = null;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [queueJson, conflictsJson] = await Promise.all([
        AsyncStorage.getItem(QUEUE_STORAGE_KEY),
        AsyncStorage.getItem(CONFLICTS_STORAGE_KEY),
      ]);

      if (queueJson) {
        this.queue = JSON.parse(queueJson) as QueuedMutation[];
      }
      if (conflictsJson) {
        this.conflicts = JSON.parse(conflictsJson) as SyncConflict[];
      }

      this.initialized = true;
      this.notifyListeners();
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncQueue] Failed to initialize:', error);
      }
      this.initialized = true;
    }
  }

  // ----------------------------------------------------------
  // State & Listeners
  // ----------------------------------------------------------

  getState(): SyncQueueState {
    return {
      pending: this.queue.length,
      processing: this.processing,
      lastSyncedAt: this.lastSyncedAt,
      failedCount: this.queue.filter((m) => m.attempts >= MAX_RETRY_ATTEMPTS).length,
    };
  }

  subscribe(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ----------------------------------------------------------
  // Queue Management
  // ----------------------------------------------------------

  /**
   * Enqueue a mutation for offline sync.
   * Returns the queued mutation ID.
   */
  async enqueue(
    table: TableName,
    operation: MutationOperation,
    data?: Record<string, unknown>,
    filter?: Record<string, unknown>,
  ): Promise<string> {
    await this.initialize();

    const mutation: QueuedMutation = {
      id: generateId(),
      table,
      operation,
      data,
      filter,
      created_at: new Date().toISOString(),
      attempts: 0,
    };

    this.queue.push(mutation);
    await this.persistQueue();
    this.notifyListeners();

    if (__DEV__) {
      console.log(`[SyncQueue] Enqueued ${operation} on ${table} (id: ${mutation.id})`);
    }

    return mutation.id;
  }

  /**
   * Get the current number of pending mutations.
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Get all queued mutations (for debugging).
   */
  getQueue(): ReadonlyArray<QueuedMutation> {
    return [...this.queue];
  }

  /**
   * Get recent conflicts (for debugging).
   */
  getConflicts(): ReadonlyArray<SyncConflict> {
    return [...this.conflicts];
  }

  /**
   * Clear all permanently failed mutations.
   */
  async clearFailed(): Promise<number> {
    const before = this.queue.length;
    this.queue = this.queue.filter((m) => m.attempts < MAX_RETRY_ATTEMPTS);
    const removed = before - this.queue.length;

    if (removed > 0) {
      await this.persistQueue();
      this.notifyListeners();
    }

    return removed;
  }

  // ----------------------------------------------------------
  // Upload / Replay
  // ----------------------------------------------------------

  /**
   * Process all queued mutations in order.
   * Call this when connectivity is restored.
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    await this.initialize();
    this.processing = true;
    this.notifyListeners();

    if (__DEV__) {
      console.log(`[SyncQueue] Processing ${this.queue.length} queued mutations...`);
    }

    const processed: string[] = [];

    for (const mutation of [...this.queue]) {
      // Skip permanently failed mutations
      if (mutation.attempts >= MAX_RETRY_ATTEMPTS) {
        continue;
      }

      try {
        await this.uploadMutation(mutation);
        processed.push(mutation.id);

        if (__DEV__) {
          console.log(`[SyncQueue] ✓ Uploaded ${mutation.operation} on ${mutation.table}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Update attempt count
        mutation.attempts += 1;
        mutation.last_error = errorMessage;
        mutation.last_attempted_at = new Date().toISOString();

        // Check if this is a conflict (row was modified server-side)
        if (this.isConflictError(errorMessage)) {
          await this.resolveConflict(mutation, errorMessage);
          processed.push(mutation.id);
          continue;
        }

        // If max retries reached, log as persistent failure
        if (mutation.attempts >= MAX_RETRY_ATTEMPTS) {
          if (__DEV__) {
            console.error(
              `[SyncQueue] ✗ Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts:`,
              mutation,
            );
          }
        } else {
          // Wait with exponential backoff before next attempt
          const delay = getRetryDelay(mutation.attempts);
          if (__DEV__) {
            console.warn(
              `[SyncQueue] Retry ${mutation.attempts}/${MAX_RETRY_ATTEMPTS} for ${mutation.id} in ${delay}ms`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Remove successfully processed mutations
    this.queue = this.queue.filter((m) => !processed.includes(m.id));
    await this.persistQueue();

    this.processing = false;
    this.lastSyncedAt = new Date().toISOString();
    this.notifyListeners();

    if (__DEV__) {
      console.log(
        `[SyncQueue] Done. ${processed.length} uploaded, ${this.queue.length} remaining.`,
      );
    }
  }

  /**
   * Upload a single mutation to Supabase.
   */
  private async uploadMutation(mutation: QueuedMutation): Promise<void> {
    const { table, operation, data, filter } = mutation;

    switch (operation) {
      case 'INSERT': {
        if (!data) throw new Error('INSERT requires data');
        // Strip local-only fields
        const insertData = { ...data };
        delete insertData._offline_id;
        delete insertData._queued_at;

        const { error } = await supabase.from(table).insert(insertData);
        if (error) throw error;
        break;
      }

      case 'UPDATE': {
        if (!data || !filter) throw new Error('UPDATE requires data and filter');
        const updateData = { ...data };
        delete updateData._offline_id;
        delete updateData._queued_at;

        // Last-write-wins: set updated_at to now
        if ('updated_at' in updateData || this.tableHasUpdatedAt(table)) {
          updateData.updated_at = new Date().toISOString();
        }

        let query = supabase.from(table).update(updateData);
        for (const [key, value] of Object.entries(filter)) {
          query = query.eq(key, value as string | number);
        }
        const { error } = await query;
        if (error) throw error;
        break;
      }

      case 'UPSERT': {
        if (!data) throw new Error('UPSERT requires data');
        const upsertData = { ...data };
        delete upsertData._offline_id;
        delete upsertData._queued_at;

        const { error } = await supabase.from(table).upsert(upsertData);
        if (error) throw error;
        break;
      }

      case 'DELETE': {
        if (!filter) throw new Error('DELETE requires filter');
        let query = supabase.from(table).delete();
        for (const [key, value] of Object.entries(filter)) {
          query = query.eq(key, value as string | number);
        }
        const { error } = await query;
        if (error) throw error;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  // ----------------------------------------------------------
  // Conflict Resolution
  // ----------------------------------------------------------

  /**
   * Check if an error indicates a conflict (row modified/deleted server-side).
   */
  private isConflictError(errorMessage: string): boolean {
    const conflictPatterns = [
      'duplicate key',
      'unique constraint',
      'conflict',
      'PGRST116', // PostgREST: no rows returned (row was deleted)
      '409',
    ];
    const lower = errorMessage.toLowerCase();
    return conflictPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
  }

  /**
   * Resolve a conflict using last-write-wins strategy.
   * For INSERT conflicts (duplicate key), we convert to UPSERT.
   * For UPDATE conflicts (row deleted), we skip.
   */
  private async resolveConflict(mutation: QueuedMutation, errorMessage: string): Promise<void> {
    let resolution: SyncConflict['resolution'] = 'last_write_wins';

    try {
      if (mutation.operation === 'INSERT' && mutation.data) {
        // Duplicate key → upsert instead
        const upsertData = { ...mutation.data };
        delete upsertData._offline_id;
        delete upsertData._queued_at;

        const { error } = await supabase.from(mutation.table).upsert(upsertData);
        if (error) {
          resolution = 'skipped';
          if (__DEV__) {
            console.warn('[SyncQueue] Conflict resolution (upsert) failed, skipping:', error);
          }
        }
      } else if (mutation.operation === 'UPDATE') {
        // Row may have been deleted server-side → skip
        resolution = 'skipped';
      } else if (mutation.operation === 'DELETE') {
        // Already deleted → skip
        resolution = 'skipped';
      }
    } catch {
      resolution = 'skipped';
    }

    const conflict: SyncConflict = {
      mutation,
      error: errorMessage,
      resolved: true,
      resolution,
      timestamp: new Date().toISOString(),
    };

    this.conflicts.push(conflict);
    // Keep only last 50 conflicts
    if (this.conflicts.length > 50) {
      this.conflicts = this.conflicts.slice(-50);
    }
    await this.persistConflicts();

    if (__DEV__) {
      console.log(`[SyncQueue] Conflict resolved (${resolution}):`, mutation.id);
    }
  }

  /**
   * Check if a table has an updated_at column (for last-write-wins).
   */
  private tableHasUpdatedAt(table: string): boolean {
    const tablesWithUpdatedAt = [
      'farms',
      'farm_seasons',
      'daily_notes',
      'warehouse_items',
      'workers',
      'worker_attendance',
      'worker_settlements',
      'temporary_worker_entries',
      'profiles',
    ];
    return tablesWithUpdatedAt.includes(table);
  }

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncQueue] Failed to persist queue:', error);
      }
    }
  }

  private async persistConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(this.conflicts));
    } catch (error) {
      if (__DEV__) {
        console.error('[SyncQueue] Failed to persist conflicts:', error);
      }
    }
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

export const syncQueue = new SyncQueue();
