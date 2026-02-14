/**
 * Sync Queue Service
 * Persistent queue backed by AsyncStorage for storing offline mutations.
 * Entries are processed FIFO when connectivity is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SyncQueueItem,
  SyncQueueItemInput,
  SyncQueueItemStatus,
} from '@/types/sync';

// ============================================================
// MARK: - Constants
// ============================================================

const SYNC_QUEUE_KEY = '@vinesight/sync_queue';
const MAX_RETRIES = 5;

// ============================================================
// MARK: - ID Generator
// ============================================================

/** Generate a simple unique ID without external dependencies */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

// ============================================================
// MARK: - Queue Persistence
// ============================================================

/** Load the entire queue from AsyncStorage */
async function loadQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SyncQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (__DEV__) {
      console.error('[SyncQueue] Failed to load queue:', error);
    }
    return [];
  }
}

/** Save the entire queue to AsyncStorage */
async function saveQueue(queue: SyncQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    if (__DEV__) {
      console.error('[SyncQueue] Failed to save queue:', error);
    }
  }
}

// ============================================================
// MARK: - Public API
// ============================================================

/**
 * Add a new mutation to the sync queue.
 * Returns the created queue item.
 */
export async function enqueueMutation(input: SyncQueueItemInput): Promise<SyncQueueItem> {
  const now = new Date().toISOString();
  const item: SyncQueueItem = {
    id: generateId(),
    table: input.table,
    operation: input.operation,
    payload: input.payload,
    recordId: input.recordId,
    userId: input.userId,
    createdAt: now,
    lastModified: now,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    status: 'pending',
  };

  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);

  if (__DEV__) {
    console.log(`[SyncQueue] Enqueued ${input.operation} on ${input.table} (id: ${item.id})`);
  }

  return item;
}

/**
 * Get all items in the queue, optionally filtered by status.
 */
export async function getQueueItems(
  status?: SyncQueueItemStatus,
): Promise<SyncQueueItem[]> {
  const queue = await loadQueue();
  if (!status) return queue;
  return queue.filter((item) => item.status === status);
}

/**
 * Get the count of pending items in the queue.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.filter((item) => item.status === 'pending' || item.status === 'processing').length;
}

/**
 * Get the count of failed items in the queue.
 */
export async function getFailedCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.filter((item) => item.status === 'failed').length;
}

/**
 * Update the status of a queue item.
 */
export async function updateQueueItemStatus(
  id: string,
  status: SyncQueueItemStatus,
  errorMessage?: string,
): Promise<void> {
  const queue = await loadQueue();
  const index = queue.findIndex((item) => item.id === id);
  if (index === -1) return;

  queue[index] = {
    ...queue[index],
    status,
    errorMessage: errorMessage ?? queue[index].errorMessage,
    retryCount:
      status === 'processing' ? queue[index].retryCount + 1 : queue[index].retryCount,
  };

  await saveQueue(queue);
}

/**
 * Mark a queue item as synced and remove it from the queue.
 */
export async function markAsSynced(id: string): Promise<void> {
  const queue = await loadQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await saveQueue(filtered);

  if (__DEV__) {
    console.log(`[SyncQueue] Marked ${id} as synced and removed from queue`);
  }
}

/**
 * Mark a queue item as failed.
 */
export async function markAsFailed(id: string, errorMessage: string): Promise<void> {
  await updateQueueItemStatus(id, 'failed', errorMessage);

  if (__DEV__) {
    console.log(`[SyncQueue] Marked ${id} as failed: ${errorMessage}`);
  }
}

/**
 * Get the next batch of pending items to process (FIFO order).
 */
export async function getNextPendingBatch(batchSize: number = 10): Promise<SyncQueueItem[]> {
  const queue = await loadQueue();
  return queue
    .filter((item) => item.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, batchSize);
}

/**
 * Reset failed items back to pending for retry.
 */
export async function retryFailedItems(): Promise<number> {
  const queue = await loadQueue();
  let retryCount = 0;

  const updated = queue.map((item) => {
    if (item.status === 'failed' && item.retryCount < item.maxRetries) {
      retryCount++;
      return { ...item, status: 'pending' as const, errorMessage: undefined };
    }
    return item;
  });

  await saveQueue(updated);
  return retryCount;
}

/**
 * Clear all synced/completed items from the queue.
 */
export async function clearSyncedItems(): Promise<void> {
  const queue = await loadQueue();
  const filtered = queue.filter((item) => item.status !== 'synced');
  await saveQueue(filtered);
}

/**
 * Clear the entire queue (use with caution).
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Remove a specific item from the queue.
 */
export async function removeQueueItem(id: string): Promise<void> {
  const queue = await loadQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await saveQueue(filtered);
}
