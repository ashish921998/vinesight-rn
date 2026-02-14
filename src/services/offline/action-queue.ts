/**
 * Offline Action Queue
 * Persistent queue for mutations made while offline.
 * Auto-replays when connectivity returns with exponential backoff on failures.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// MARK: - Types
// ============================================================

export interface QueuedAction {
  /** Unique identifier for this action */
  id: string;
  /** Timestamp when the action was queued */
  createdAt: number;
  /** Human-readable action type (e.g. "createFarm", "updateWorker") */
  type: string;
  /** Serialisable payload for the action */
  payload: unknown;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Maximum retries before the action is dropped */
  maxRetries: number;
  /** Status of the action */
  status: 'pending' | 'processing' | 'failed';
  /** Last error message if failed */
  lastError?: string;
}

export type ActionExecutor = (action: QueuedAction) => Promise<void>;

// ============================================================
// MARK: - Constants
// ============================================================

const QUEUE_KEY = 'vs_offline_queue';
const LAST_SYNC_KEY = 'vs_last_sync_timestamp';

/** Base delay for exponential backoff (1 second) */
const BASE_DELAY_MS = 1_000;

/** Maximum delay cap (2 minutes) */
const MAX_DELAY_MS = 2 * 60 * 1_000;

/** Default max retries per action */
const DEFAULT_MAX_RETRIES = 5;

// ============================================================
// MARK: - Queue State
// ============================================================

/** Registry of action executors keyed by action type */
const executors = new Map<string, ActionExecutor>();

/** Whether the queue is currently processing */
let isProcessing = false;

/** Listeners for queue state changes */
type QueueListener = (queue: QueuedAction[]) => void;
const listeners = new Set<QueueListener>();

// ============================================================
// MARK: - Persistence
// ============================================================

async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyListeners(queue);
}

function notifyListeners(queue: QueuedAction[]): void {
  for (const listener of listeners) {
    try {
      listener(queue);
    } catch {
      // ignore listener errors
    }
  }
}

// ============================================================
// MARK: - Public API
// ============================================================

/**
 * Register an executor for a given action type.
 * Must be called at app startup before processing begins.
 */
export function registerActionExecutor(type: string, executor: ActionExecutor): void {
  executors.set(type, executor);
}

/**
 * Enqueue an action to be executed when online.
 */
export async function enqueueAction(
  type: string,
  payload: unknown,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<QueuedAction> {
  const action: QueuedAction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    type,
    payload,
    retryCount: 0,
    maxRetries,
    status: 'pending',
  };

  const queue = await loadQueue();
  queue.push(action);
  await saveQueue(queue);

  if (__DEV__) {
    console.log(`[OfflineQueue] Enqueued action: ${type} (${action.id})`);
  }

  return action;
}

/**
 * Process all pending actions in FIFO order.
 * Called automatically when connectivity is restored.
 */
export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let queue = await loadQueue();
    const pending = queue.filter((a) => a.status === 'pending' || a.status === 'failed');

    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    if (__DEV__) {
      console.log(`[OfflineQueue] Processing ${pending.length} queued actions`);
    }

    for (const action of pending) {
      const executor = executors.get(action.type);
      if (!executor) {
        if (__DEV__) {
          console.warn(`[OfflineQueue] No executor registered for type: ${action.type}`);
        }
        // Mark as failed permanently
        action.status = 'failed';
        action.lastError = `No executor registered for type: ${action.type}`;
        action.retryCount = action.maxRetries;
        queue = await loadQueue();
        const idx = queue.findIndex((a) => a.id === action.id);
        if (idx !== -1) {
          queue[idx] = action;
          await saveQueue(queue);
        }
        continue;
      }

      // Mark as processing
      action.status = 'processing';
      queue = await loadQueue();
      let idx = queue.findIndex((a) => a.id === action.id);
      if (idx !== -1) {
        queue[idx] = action;
        await saveQueue(queue);
      }

      try {
        await executor(action);

        // Success – remove from queue
        queue = await loadQueue();
        queue = queue.filter((a) => a.id !== action.id);
        await saveQueue(queue);

        if (__DEV__) {
          console.log(`[OfflineQueue] Successfully processed: ${action.type} (${action.id})`);
        }
      } catch (error) {
        action.retryCount += 1;
        action.lastError = error instanceof Error ? error.message : String(error);

        if (action.retryCount >= action.maxRetries) {
          action.status = 'failed';
          if (__DEV__) {
            console.error(
              `[OfflineQueue] Action permanently failed after ${action.maxRetries} retries: ${action.type} (${action.id})`,
            );
          }
        } else {
          action.status = 'pending';
          // Wait with exponential backoff before continuing
          const delay = Math.min(
            BASE_DELAY_MS * Math.pow(2, action.retryCount - 1),
            MAX_DELAY_MS,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        queue = await loadQueue();
        idx = queue.findIndex((a) => a.id === action.id);
        if (idx !== -1) {
          queue[idx] = action;
          await saveQueue(queue);
        }
      }
    }

    // Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } finally {
    isProcessing = false;
  }
}

/**
 * Get the current queue contents.
 */
export async function getQueue(): Promise<QueuedAction[]> {
  return loadQueue();
}

/**
 * Get the count of pending actions.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.filter((a) => a.status === 'pending' || a.status === 'processing').length;
}

/**
 * Remove a specific action from the queue.
 */
export async function removeAction(id: string): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(queue.filter((a) => a.id !== id));
}

/**
 * Clear all actions from the queue.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
  notifyListeners([]);
}

/**
 * Get the last successful sync timestamp.
 */
export async function getLastSyncTimestamp(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to queue state changes.
 * Returns an unsubscribe function.
 */
export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Check if the queue is currently processing.
 */
export function isQueueProcessing(): boolean {
  return isProcessing;
}
