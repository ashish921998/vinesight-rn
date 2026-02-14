/**
 * Background Sync Service
 *
 * Registers an expo-task-manager background task that periodically:
 *   1. Replays the sync queue (pending mutations)
 *   2. Retries failed media uploads
 *   3. Refreshes / prefetches critical cached data
 *
 * Also provides a `runSyncPass()` function that can be called from
 * foreground reconnection handlers or manual "sync now" triggers.
 *
 * Phase 8 additions: circuit-breaker integration, structured logging,
 * exponential back-off for individual item retries, mid-sync recovery.
 */

import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import {
  BACKGROUND_SYNC_TASK_NAME,
  BACKGROUND_SYNC_INTERVAL_SECONDS,
  LOW_BATTERY_THRESHOLD,
  MAX_SYNC_RETRIES,
  offlineSyncConfig,
} from '@/constants/offline-config';
import { useSyncStore } from '@/stores/sync-store';
import { logOfflineEvent } from './offline-logger';
import {
  syncCircuitBreaker,
  mediaUploadCircuitBreaker,
  CircuitBreakerOpenError,
} from './circuit-breaker';
import {
  markSyncInProgress,
  clearSyncInProgress,
  validateSyncItem,
} from './sync-queue-hardening';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Calculate exponential back-off delay for a given retry count.
 * Returns delay in ms: min(baseMs * 2^retries, maxMs).
 */
export function getRetryDelay(retries: number, baseMs = 1_000, maxMs = 60_000): number {
  return Math.min(baseMs * Math.pow(2, retries), maxMs);
}

/**
 * Check whether the device conditions allow a full (heavy) sync.
 * Returns `{ canSync, canHeavySync, reason? }`.
 */
export async function checkSyncConditions(): Promise<{
  canSync: boolean;
  canHeavySync: boolean;
  reason?: string;
}> {
  // Network check
  const netState = await NetInfo.fetch();
  const isConnected = netState.isConnected ?? false;
  const isReachable = netState.isInternetReachable ?? isConnected;

  if (!isConnected || !isReachable) {
    return { canSync: false, canHeavySync: false, reason: 'No internet connection' };
  }

  const isCellular = netState.type === 'cellular';
  let canHeavySync = true;

  // Cellular restriction
  if (isCellular && !offlineSyncConfig.syncOnCellular) {
    canHeavySync = false;
  }

  // Battery check (native only)
  if (Platform.OS !== 'web') {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      if (batteryLevel >= 0 && batteryLevel < LOW_BATTERY_THRESHOLD) {
        canHeavySync = false;
      }
    } catch {
      // Battery API may not be available on all devices; proceed anyway
    }
  }

  return { canSync: true, canHeavySync };
}

// ── Background task history (in-memory, for debug screen) ──────────

export interface BackgroundTaskRecord {
  timestamp: string;
  result: 'success' | 'no_data' | 'failed' | 'skipped';
  itemsSynced: number;
  duration: number; // ms
  error?: string;
}

const MAX_TASK_HISTORY = 50;
const taskHistory: BackgroundTaskRecord[] = [];

export function getBackgroundTaskHistory(): readonly BackgroundTaskRecord[] {
  return taskHistory;
}

function recordTaskRun(record: BackgroundTaskRecord): void {
  if (taskHistory.length >= MAX_TASK_HISTORY) {
    taskHistory.shift();
  }
  taskHistory.push(record);
}

// ── Sync Pass ──────────────────────────────────────────────────────

/**
 * Execute a single sync pass. Safe to call from both foreground and
 * background contexts.
 *
 * @returns `true` if new data was synced, `false` otherwise.
 */
export async function runSyncPass(): Promise<boolean> {
  const store = useSyncStore.getState();
  const startTime = Date.now();

  // Prevent concurrent runs
  if (store.isSyncing) {
    logOfflineEvent('sync_started', { skipped: true, reason: 'already_syncing' });
    return false;
  }

  const { canSync, canHeavySync, reason } = await checkSyncConditions();
  if (!canSync) {
    logOfflineEvent('sync_started', { skipped: true, reason });
    recordTaskRun({
      timestamp: new Date().toISOString(),
      result: 'skipped',
      itemsSynced: 0,
      duration: Date.now() - startTime,
      error: reason,
    });
    return false;
  }

  store.setSyncing(true);
  await markSyncInProgress();
  logOfflineEvent('sync_started', { canHeavySync });

  try {
    let didSync = false;
    let itemsSynced = 0;

    // ── Step 1: Replay pending mutations (through circuit breaker) ──
    const pendingItems = Object.values(store.items).filter(
      (item) =>
        (item.status === 'pending' || item.status === 'failed') &&
        item.retries < MAX_SYNC_RETRIES,
    );

    if (pendingItems.length > 0 && syncCircuitBreaker.canExecute()) {
      store.markAllSyncing();

      for (const item of pendingItems) {
        // Validate queue entry before processing
        if (!validateSyncItem(item)) {
          logOfflineEvent('queue_entry_corrupt', {
            itemId: item.id,
            rawValue: JSON.stringify(item).slice(0, 200),
          });
          store.removeItem(item.id);
          continue;
        }

        try {
          await syncCircuitBreaker.execute(async () => {
            // TODO: Phase 3 offline-writes integration – call the actual
            // mutation replay logic here. For now we mark items as synced
            // to demonstrate the pipeline.
            //
            // Example:
            //   await replayMutation(item);
            store.markSynced(item.id);
          });
          logOfflineEvent('sync_item_success', { itemId: item.id, label: item.label });
          didSync = true;
          itemsSynced++;
        } catch (error: unknown) {
          if (error instanceof CircuitBreakerOpenError) {
            logOfflineEvent('sync_item_failed', {
              itemId: item.id,
              reason: 'circuit_breaker_open',
            });
            break; // Stop processing – circuit is open
          }
          const message = error instanceof Error ? error.message : 'Unknown error';
          store.markFailed(item.id, message);
          logOfflineEvent(
            'sync_item_failed',
            {
              itemId: item.id,
              retries: item.retries + 1,
              nextRetryDelay: getRetryDelay(item.retries + 1),
            },
            message,
          );
        }
      }
    }

    // ── Step 2: Retry failed media uploads (heavy, through circuit breaker) ──
    if (canHeavySync && mediaUploadCircuitBreaker.canExecute()) {
      try {
        await mediaUploadCircuitBreaker.execute(async () => {
          // TODO: Phase 5 media-cache integration – call media upload
          // retry logic here.
          //
          // Example:
          //   await retryFailedMediaUploads();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logOfflineEvent('media_upload_failed', { step: 'batch_retry' }, message);
      }
    }

    // ── Step 3: Prefetch / refresh critical data (heavy) ──────────
    if (canHeavySync) {
      try {
        // TODO: Phase 2 read-through-cache integration – call prefetch
        // logic here to refresh stale cached data.
        //
        // Example:
        //   await prefetchCriticalData();
      } catch (error) {
        if (__DEV__) console.warn('[BackgroundSync] Prefetch failed:', error);
      }
    }

    // Record successful sync
    store.recordSync();
    await clearSyncInProgress();
    const duration = Date.now() - startTime;
    logOfflineEvent('sync_completed', { itemsSynced, duration });
    recordTaskRun({
      timestamp: new Date().toISOString(),
      result: didSync ? 'success' : 'no_data',
      itemsSynced,
      duration,
    });
    return didSync;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    logOfflineEvent('sync_failed', { duration }, message);
    recordTaskRun({
      timestamp: new Date().toISOString(),
      result: 'failed',
      itemsSynced: 0,
      duration,
      error: message,
    });
    store.setSyncing(false);
    await clearSyncInProgress();
    return false;
  }
}

// ── Background Task Definition ─────────────────────────────────────

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  logOfflineEvent('background_task_started');

  try {
    const didSync = await runSyncPass();
    logOfflineEvent('background_task_completed', { didSync });
    return didSync
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logOfflineEvent('background_task_failed', undefined, message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Registration ───────────────────────────────────────────────────

/**
 * Register the background fetch task with the OS.
 * Should be called once during app initialisation (e.g. in _layout.tsx).
 *
 * On web this is a no-op.
 */
export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
    if (isRegistered) {
      if (__DEV__) console.log('[BackgroundSync] Task already registered.');
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: BACKGROUND_SYNC_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    if (__DEV__) {
      console.log(
        `[BackgroundSync] Registered with interval ${BACKGROUND_SYNC_INTERVAL_SECONDS}s.`,
      );
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[BackgroundSync] Registration failed (expected in Expo Go):', error);
    }
  }
}

/**
 * Unregister the background fetch task.
 * Useful for logout or when the user disables background sync.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK_NAME);
    if (!isRegistered) return;

    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    if (__DEV__) console.log('[BackgroundSync] Task unregistered.');
  } catch (error) {
    if (__DEV__) console.warn('[BackgroundSync] Unregister failed:', error);
  }
}

/**
 * Check the current background fetch status from the OS.
 */
export async function getBackgroundSyncStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
  if (Platform.OS === 'web') return null;

  try {
    return await BackgroundFetch.getStatusAsync();
  } catch {
    return null;
  }
}
