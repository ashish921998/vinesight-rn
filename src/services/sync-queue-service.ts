/**
 * Sync Queue Service – AsyncStorage-backed FIFO queue for offline mutations.
 *
 * Stores pending mutations in AsyncStorage and replays them when connectivity
 * is restored. Designed to integrate with the Phase 3 sync queue and Phase 4
 * conflict resolution once those are merged.
 *
 * Phase 7: Background Sync & Periodic Refresh
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// MARK: - Types
// ============================================================

export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface QueuedMutation {
  /** Unique ID for this queued item. */
  id: string;
  /** Target Supabase table name. */
  table: string;
  /** The CRUD operation. */
  operation: MutationOperation;
  /** The payload to send (row data for INSERT/UPDATE, filter for DELETE). */
  payload: Record<string, unknown>;
  /** ISO timestamp when the mutation was queued. */
  queuedAt: string;
  /** Number of retry attempts so far. */
  retries: number;
  /** Last error message, if any. */
  lastError?: string;
}

export interface SyncQueueStats {
  /** Total items in the queue. */
  total: number;
  /** Items that have never been attempted. */
  pending: number;
  /** Items that failed at least once. */
  failed: number;
}

// ============================================================
// MARK: - Constants
// ============================================================

const QUEUE_STORAGE_KEY = '@vinesight/sync-queue';
const MAX_RETRIES = 5;

// ============================================================
// MARK: - Queue Operations
// ============================================================

/**
 * Read the full queue from AsyncStorage.
 */
export async function getQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch (error) {
    if (__DEV__) {
      console.error('[SyncQueue] Failed to read queue:', error);
    }
    return [];
  }
}

/**
 * Persist the queue to AsyncStorage.
 */
async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    if (__DEV__) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }
}

/**
 * Enqueue a new mutation at the end of the FIFO queue.
 */
export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'queuedAt' | 'retries'>,
): Promise<QueuedMutation> {
  const item: QueuedMutation = {
    ...mutation,
    id: generateId(),
    queuedAt: new Date().toISOString(),
    retries: 0,
  };

  const queue = await getQueue();
  queue.push(item);
  await saveQueue(queue);

  if (__DEV__) {
    console.log(`[SyncQueue] Enqueued ${item.operation} on ${item.table} (id: ${item.id})`);
  }

  return item;
}

/**
 * Remove a specific item from the queue (e.g. after successful sync).
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await saveQueue(filtered);
}

/**
 * Mark an item as failed, incrementing its retry count.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((item) => {
    if (item.id !== id) return item;
    return { ...item, retries: item.retries + 1, lastError: error };
  });
  await saveQueue(updated);
}

/**
 * Get items eligible for retry (retries < MAX_RETRIES).
 */
export async function getRetryableItems(): Promise<QueuedMutation[]> {
  const queue = await getQueue();
  return queue.filter((item) => item.retries < MAX_RETRIES);
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<SyncQueueStats> {
  const queue = await getQueue();
  return {
    total: queue.length,
    pending: queue.filter((item) => item.retries === 0).length,
    failed: queue.filter((item) => item.retries > 0).length,
  };
}

/**
 * Clear the entire queue (e.g. on logout).
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}

// ============================================================
// MARK: - Helpers
// ============================================================

function generateId(): string {
  return `sq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export { MAX_RETRIES };
