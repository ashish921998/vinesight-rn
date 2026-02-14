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

// ── Helpers ────────────────────────────────────────────────────────

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

// ── Sync Pass ──────────────────────────────────────────────────────

/**
 * Execute a single sync pass. Safe to call from both foreground and
 * background contexts.
 *
 * @returns `true` if new data was synced, `false` otherwise.
 */
export async function runSyncPass(): Promise<boolean> {
  const store = useSyncStore.getState();

  // Prevent concurrent runs
  if (store.isSyncing) {
    if (__DEV__) console.log('[BackgroundSync] Sync already in progress, skipping.');
    return false;
  }

  const { canSync, canHeavySync, reason } = await checkSyncConditions();
  if (!canSync) {
    if (__DEV__) console.log(`[BackgroundSync] Skipping sync: ${reason}`);
    return false;
  }

  store.setSyncing(true);

  try {
    let didSync = false;

    // ── Step 1: Replay pending mutations ──────────────────────────
    const pendingItems = Object.values(store.items).filter(
      (item) =>
        (item.status === 'pending' || item.status === 'failed') &&
        item.retries < MAX_SYNC_RETRIES,
    );

    if (pendingItems.length > 0) {
      store.markAllSyncing();

      for (const item of pendingItems) {
        try {
          // TODO: Phase 3 offline-writes integration – call the actual
          // mutation replay logic here. For now we mark items as synced
          // to demonstrate the pipeline.
          //
          // Example:
          //   await replayMutation(item);
          store.markSynced(item.id);
          didSync = true;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          store.markFailed(item.id, message);
        }
      }
    }

    // ── Step 2: Retry failed media uploads (heavy) ────────────────
    if (canHeavySync) {
      try {
        // TODO: Phase 5 media-cache integration – call media upload
        // retry logic here.
        //
        // Example:
        //   await retryFailedMediaUploads();
      } catch (error) {
        if (__DEV__) console.warn('[BackgroundSync] Media retry failed:', error);
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
    if (__DEV__) console.log('[BackgroundSync] Sync pass completed.');
    return didSync;
  } catch (error) {
    if (__DEV__) console.error('[BackgroundSync] Sync pass error:', error);
    store.setSyncing(false);
    return false;
  }
}

// ── Background Task Definition ─────────────────────────────────────

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  if (__DEV__) console.log('[BackgroundSync] Background task triggered.');

  try {
    const didSync = await runSyncPass();
    return didSync
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
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
