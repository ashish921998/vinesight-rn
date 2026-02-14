/**
 * OfflineQueue
 * Queues failed API mutations for retry when connectivity is restored.
 * Persists the queue to AsyncStorage so it survives app restarts.
 * Uses exponential backoff for retry logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { networkMonitor } from './NetworkMonitor';
import type { QueuedMutation } from './types';

// ============================================================
// MARK: - Constants
// ============================================================

const QUEUE_STORAGE_KEY = '@vinesight_offline_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// ============================================================
// MARK: - Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateBackoffDelay(retryCount: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

// ============================================================
// MARK: - Queue Event Types
// ============================================================

type QueueListener = (queue: QueuedMutation[]) => void;

// ============================================================
// MARK: - OfflineQueue Class
// ============================================================

class OfflineQueueImpl {
  private queue: QueuedMutation[] = [];
  private listeners: Set<QueueListener> = new Set();
  private processing = false;
  private initialized = false;
  private networkUnsubscribe: (() => void) | null = null;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  /**
   * Initialize the queue from persisted storage and start
   * listening for network changes.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QueuedMutation[];
        // Reset any "processing" items back to "pending" (app may have crashed)
        this.queue = parsed.map((item) =>
          item.status === 'processing' ? { ...item, status: 'pending' as const } : item,
        );
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[OfflineQueue] Failed to load queue:', error);
      }
    }

    // Listen for connectivity changes to trigger processing
    this.networkUnsubscribe = networkMonitor.subscribe((state) => {
      if (state.isConnected && this.queue.length > 0 && !this.processing) {
        this.processQueue().catch(() => {});
      }
    });

    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * Stop the queue and clean up listeners.
   */
  stop(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }

  // ----------------------------------------------------------
  // Queue Operations
  // ----------------------------------------------------------

  /**
   * Add a mutation to the offline queue.
   */
  async enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retryCount' | 'status' | 'maxRetries'>,
  ): Promise<string> {
    await this.initialize();

    const queuedMutation: QueuedMutation = {
      ...mutation,
      id: generateId(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      status: 'pending',
    };

    this.queue.push(queuedMutation);
    await this.persistQueue();
    this.notifyListeners();

    if (__DEV__) {
      console.log(
        `[OfflineQueue] Enqueued ${mutation.operation} on ${mutation.table} (${queuedMutation.id})`,
      );
    }

    // Try to process immediately if online
    if (networkMonitor.isOnline() && !this.processing) {
      this.processQueue().catch(() => {});
    }

    return queuedMutation.id;
  }

  /**
   * Remove a specific mutation from the queue.
   */
  async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Get all queued mutations.
   */
  getQueue(): QueuedMutation[] {
    return [...this.queue];
  }

  /**
   * Get the number of pending mutations.
   */
  getPendingCount(): number {
    return this.queue.filter((m) => m.status === 'pending' || m.status === 'processing').length;
  }

  /**
   * Check if the queue is currently processing.
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear all queued mutations.
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
    this.notifyListeners();
  }

  // ----------------------------------------------------------
  // Queue Processing
  // ----------------------------------------------------------

  /**
   * Process all pending mutations in the queue.
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    if (!networkMonitor.isOnline()) return;

    this.processing = true;
    this.notifyListeners();

    const pendingItems = this.queue.filter((m) => m.status === 'pending');

    for (const mutation of pendingItems) {
      if (!networkMonitor.isOnline()) {
        break;
      }

      try {
        mutation.status = 'processing';
        this.notifyListeners();

        await this.executeMutation(mutation);

        // Success - remove from queue
        mutation.status = 'completed';
        this.queue = this.queue.filter((m) => m.id !== mutation.id);

        if (__DEV__) {
          console.log(`[OfflineQueue] Completed ${mutation.operation} on ${mutation.table}`);
        }
      } catch (error) {
        mutation.retryCount++;
        mutation.errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (mutation.retryCount >= mutation.maxRetries) {
          mutation.status = 'failed';
          if (__DEV__) {
            console.error(
              `[OfflineQueue] Failed permanently: ${mutation.operation} on ${mutation.table}`,
              error,
            );
          }
        } else {
          mutation.status = 'pending';
          // Wait with exponential backoff before next attempt
          const delay = calculateBackoffDelay(mutation.retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      await this.persistQueue();
      this.notifyListeners();
    }

    this.processing = false;
    this.notifyListeners();
  }

  // ----------------------------------------------------------
  // Mutation Execution
  // ----------------------------------------------------------

  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    const { table, operation, payload, filters } = mutation;

    switch (operation) {
      case 'insert': {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        break;
      }
      case 'update': {
        let query = supabase.from(table).update(payload);
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value as string | number);
          }
        }
        const { error } = await query;
        if (error) throw error;
        break;
      }
      case 'delete': {
        let query = supabase.from(table).delete();
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value as string | number);
          }
        }
        const { error } = await query;
        if (error) throw error;
        break;
      }
      case 'upsert': {
        const { error } = await supabase.from(table).upsert(payload);
        if (error) throw error;
        break;
      }
    }
  }

  // ----------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------

  /**
   * Subscribe to queue changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getQueue());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getQueue();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      if (__DEV__) {
        console.error('[OfflineQueue] Failed to persist queue:', error);
      }
    }
  }
}

// ============================================================
// MARK: - Singleton Export
// ============================================================

export const offlineQueue = new OfflineQueueImpl();
export default offlineQueue;
