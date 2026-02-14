/**
 * Background Sync Processor
 * Processes the offline mutation queue when connectivity is restored.
 * Uses exponential backoff for retries and last-write-wins conflict resolution.
 */

import { supabase } from '@/lib/supabase';
import type { SyncQueueItem, ConflictResolutionResult } from '@/types/sync';
import {
  getNextPendingBatch,
  markAsSynced,
  markAsFailed,
  updateQueueItemStatus,
  getPendingCount,
  getFailedCount,
} from './sync-queue-service';
import { useSyncStore } from '@/stores/sync-store';

// ============================================================
// MARK: - Constants
// ============================================================

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BATCH_SIZE = 5;

// ============================================================
// MARK: - Exponential Backoff
// ============================================================

function getBackoffDelay(retryCount: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// MARK: - Conflict Resolution (Last-Write-Wins)
// ============================================================

/**
 * Check for conflicts using last-write-wins strategy.
 * Compares the local `lastModified` timestamp against the server's `updated_at`.
 */
async function resolveConflict(
  item: SyncQueueItem,
): Promise<ConflictResolutionResult> {
  // Only check conflicts for updates (inserts and deletes don't have conflicts)
  if (item.operation !== 'update' || !item.recordId) {
    return { hasConflict: false, resolvedData: null, winner: 'none' };
  }

  try {
    const { data: serverRecord, error } = await supabase
      .from(item.table)
      .select('updated_at')
      .eq('id', item.recordId)
      .maybeSingle();

    if (error || !serverRecord) {
      // Record doesn't exist on server or error - no conflict, proceed with local
      return { hasConflict: false, resolvedData: null, winner: 'none' };
    }

    const serverUpdatedAt = serverRecord.updated_at
      ? new Date(serverRecord.updated_at as string).getTime()
      : 0;
    const localModifiedAt = new Date(item.lastModified).getTime();

    if (serverUpdatedAt > localModifiedAt) {
      // Server has newer data - server wins
      if (__DEV__) {
        console.log(
          `[SyncProcessor] Conflict detected for ${item.table}#${item.recordId}: server wins`,
        );
      }
      return { hasConflict: true, resolvedData: null, winner: 'server' };
    }

    // Local data is newer or same - local wins
    return { hasConflict: false, resolvedData: null, winner: 'local' };
  } catch {
    // On error, default to attempting the local write
    return { hasConflict: false, resolvedData: null, winner: 'none' };
  }
}

// ============================================================
// MARK: - Process Single Item
// ============================================================

async function processQueueItem(item: SyncQueueItem): Promise<boolean> {
  try {
    // Mark as processing
    await updateQueueItemStatus(item.id, 'processing');

    // Check for conflicts (update operations only)
    const conflictResult = await resolveConflict(item);
    if (conflictResult.hasConflict && conflictResult.winner === 'server') {
      // Server wins - discard local change
      await markAsSynced(item.id);
      return true;
    }

    // Add _last_modified field to payload for future conflict detection
    const payloadWithTimestamp = {
      ...item.payload,
      _last_modified: item.lastModified,
    };

    // Execute the mutation against Supabase
    switch (item.operation) {
      case 'insert': {
        // Remove local-only fields before sending to server
        const { _offline_id: _removed, ...insertPayload } = payloadWithTimestamp as Record<
          string,
          unknown
        >;
        const { error: insertError } = await supabase
          .from(item.table)
          .insert(insertPayload);

        if (insertError) throw insertError;
        break;
      }

      case 'update': {
        if (!item.recordId) {
          throw new Error('Update operation requires a recordId');
        }
        const { error: updateError } = await supabase
          .from(item.table)
          .update(payloadWithTimestamp)
          .eq('id', item.recordId);

        if (updateError) throw updateError;
        break;
      }

      case 'delete': {
        if (!item.recordId) {
          throw new Error('Delete operation requires a recordId');
        }
        const { error: deleteError } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.recordId);

        if (deleteError) throw deleteError;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }

    // Success - remove from queue
    await markAsSynced(item.id);
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown sync error';

    if (item.retryCount >= item.maxRetries) {
      await markAsFailed(item.id, errorMessage);
      if (__DEV__) {
        console.error(
          `[SyncProcessor] Item ${item.id} exceeded max retries, marking as failed`,
        );
      }
    } else {
      // Reset to pending for retry
      await updateQueueItemStatus(item.id, 'pending', errorMessage);
    }

    return false;
  }
}

// ============================================================
// MARK: - Process Queue
// ============================================================

let isProcessing = false;

/**
 * Process the sync queue in FIFO order.
 * Called when connectivity is restored or manually triggered.
 */
export async function processSyncQueue(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    if (__DEV__) {
      console.log('[SyncProcessor] Already processing, skipping');
    }
    return;
  }

  isProcessing = true;
  const syncStore = useSyncStore.getState();

  try {
    syncStore.setSyncing(true);

    let batch = await getNextPendingBatch(BATCH_SIZE);

    while (batch.length > 0) {
      for (const item of batch) {
        const success = await processQueueItem(item);

        if (!success && item.retryCount < item.maxRetries) {
          // Wait with exponential backoff before next attempt
          const delay = getBackoffDelay(item.retryCount);
          if (__DEV__) {
            console.log(
              `[SyncProcessor] Retrying ${item.id} in ${delay}ms (attempt ${item.retryCount + 1})`,
            );
          }
          await sleep(delay);
        }
      }

      // Get next batch
      batch = await getNextPendingBatch(BATCH_SIZE);
    }

    // Update sync store with final counts
    const pendingCount = await getPendingCount();
    const failedCount = await getFailedCount();
    syncStore.updateCounts(pendingCount, failedCount);

    if (pendingCount === 0 && failedCount === 0) {
      syncStore.setLastSyncedAt(new Date().toISOString());
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[SyncProcessor] Queue processing error:', error);
    }
  } finally {
    isProcessing = false;
    syncStore.setSyncing(false);
  }
}

/**
 * Check if the processor is currently running.
 */
export function isSyncProcessing(): boolean {
  return isProcessing;
}
