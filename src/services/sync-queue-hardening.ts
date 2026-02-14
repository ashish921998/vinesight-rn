/**
 * Sync Queue Hardening – Edge-case handling for the offline sync queue.
 *
 * Handles:
 *   - Corrupt/invalid queue entries (graceful skip + log)
 *   - Storage quota exceeded (warn user, prune old cache)
 *   - Rapid online/offline toggling (debounce)
 *   - App killed mid-sync (recovery on next launch)
 *
 * Phase 8 of offline functionality.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncStore, type SyncItem } from '@/stores/sync-store';
import { logOfflineEvent } from './offline-logger';
import { MAX_SYNC_RETRIES } from '@/constants/offline-config';

// ── Constants ──────────────────────────────────────────────────────

/** AsyncStorage key for persisting the sync-in-progress flag. */
const SYNC_IN_PROGRESS_KEY = '@vinesight/sync-in-progress';

/** AsyncStorage key for persisting the sync queue snapshot. */
const SYNC_QUEUE_SNAPSHOT_KEY = '@vinesight/sync-queue-snapshot';

/** Maximum age (ms) for a queue entry before it's considered stale and prunable. */
const MAX_QUEUE_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Debounce delay (ms) for network status changes. */
const NETWORK_DEBOUNCE_MS = 2_000;

/** Storage quota warning threshold (bytes). Warn when AsyncStorage usage exceeds this. */
const STORAGE_QUOTA_WARNING_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Queue Entry Validation ─────────────────────────────────────────

/**
 * Required fields for a valid SyncItem.
 */
const REQUIRED_SYNC_ITEM_FIELDS: Array<keyof SyncItem> = ['id', 'status', 'queuedAt', 'retries'];

/**
 * Validate a sync queue entry. Returns `true` if the entry is valid,
 * `false` if it's corrupt and should be skipped.
 */
export function validateSyncItem(item: unknown): item is SyncItem {
  if (item === null || item === undefined || typeof item !== 'object') {
    return false;
  }

  const record = item as Record<string, unknown>;

  // Check required fields exist
  for (const field of REQUIRED_SYNC_ITEM_FIELDS) {
    if (!(field in record)) {
      return false;
    }
  }

  // Type checks
  if (typeof record.id !== 'string' || record.id.length === 0) return false;
  if (typeof record.status !== 'string') return false;
  if (!['pending', 'syncing', 'synced', 'failed'].includes(record.status as string)) return false;
  if (typeof record.queuedAt !== 'string') return false;
  if (typeof record.retries !== 'number' || record.retries < 0) return false;

  // Validate queuedAt is a parseable date
  const date = new Date(record.queuedAt as string);
  if (isNaN(date.getTime())) return false;

  return true;
}

/**
 * Scan the sync queue for corrupt entries, remove them, and log each one.
 * Returns the number of entries removed.
 */
export function purgeCorruptQueueEntries(): number {
  const store = useSyncStore.getState();
  const items = store.items;
  let removedCount = 0;

  for (const [id, item] of Object.entries(items)) {
    if (!validateSyncItem(item)) {
      logOfflineEvent('queue_entry_corrupt', {
        itemId: id,
        rawValue: JSON.stringify(item).slice(0, 200),
      });
      store.removeItem(id);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logOfflineEvent('queue_entry_pruned', { count: removedCount, reason: 'corrupt' });
  }

  return removedCount;
}

/**
 * Prune stale queue entries that have exceeded the maximum age or retry limit.
 * Returns the number of entries removed.
 */
export function pruneStaleQueueEntries(): number {
  const store = useSyncStore.getState();
  const items = store.items;
  const now = Date.now();
  let removedCount = 0;

  for (const [id, item] of Object.entries(items)) {
    const queuedAt = new Date(item.queuedAt).getTime();
    const isStale = now - queuedAt > MAX_QUEUE_ENTRY_AGE_MS;
    const isExhausted = item.retries >= MAX_SYNC_RETRIES;

    if (isStale || isExhausted) {
      logOfflineEvent('queue_entry_pruned', {
        itemId: id,
        reason: isStale ? 'stale' : 'max_retries',
        age: now - queuedAt,
        retries: item.retries,
      });
      store.removeItem(id);
      removedCount++;
    }
  }

  return removedCount;
}

// ── Mid-Sync Recovery ──────────────────────────────────────────────

/**
 * Mark that a sync pass is in progress. Called at the start of a sync.
 * If the app is killed mid-sync, the next launch can detect this.
 */
export async function markSyncInProgress(): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_IN_PROGRESS_KEY, new Date().toISOString());
  } catch {
    // Non-critical – best effort
  }
}

/**
 * Clear the sync-in-progress flag. Called when sync completes or fails.
 */
export async function clearSyncInProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SYNC_IN_PROGRESS_KEY);
  } catch {
    // Non-critical
  }
}

/**
 * Check if the app was killed during a previous sync pass.
 * If so, reset any items stuck in 'syncing' state back to 'pending'.
 * Should be called once during app initialization.
 */
export async function recoverFromInterruptedSync(): Promise<boolean> {
  try {
    const inProgress = await AsyncStorage.getItem(SYNC_IN_PROGRESS_KEY);
    if (!inProgress) return false;

    logOfflineEvent('sync_interrupted', {
      interruptedAt: inProgress,
      recoveredAt: new Date().toISOString(),
    });

    // Reset any items stuck in 'syncing' back to 'pending'
    const store = useSyncStore.getState();
    const items = store.items;
    let recoveredCount = 0;

    for (const [id, item] of Object.entries(items)) {
      if (item.status === 'syncing') {
        store.upsertItem(id, { status: 'pending' });
        recoveredCount++;
      }
    }

    // Also ensure the global syncing flag is cleared
    store.setSyncing(false);

    await clearSyncInProgress();

    if (recoveredCount > 0) {
      logOfflineEvent('sync_item_skipped', {
        reason: 'interrupted_recovery',
        count: recoveredCount,
      });
    }

    return recoveredCount > 0;
  } catch {
    // If we can't read AsyncStorage, just clear the flag
    await clearSyncInProgress();
    return false;
  }
}

// ── Storage Quota Monitoring ───────────────────────────────────────

/**
 * Estimate the current AsyncStorage usage by serializing all keys.
 * This is an approximation – actual storage may differ.
 *
 * Returns the estimated size in bytes, or -1 if estimation fails.
 */
export async function estimateStorageUsage(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys);
    let totalBytes = 0;

    for (const [key, value] of pairs) {
      totalBytes += (key?.length ?? 0) * 2; // UTF-16
      totalBytes += (value?.length ?? 0) * 2;
    }

    return totalBytes;
  } catch {
    return -1;
  }
}

/**
 * Check if storage usage is approaching the quota limit.
 * Logs a warning event if usage exceeds the threshold.
 *
 * Returns `true` if storage is within safe limits, `false` if near quota.
 */
export async function checkStorageQuota(): Promise<boolean> {
  const usage = await estimateStorageUsage();
  if (usage < 0) return true; // Can't estimate, assume OK

  if (usage > STORAGE_QUOTA_WARNING_BYTES) {
    logOfflineEvent('storage_quota_exceeded', {
      estimatedUsageBytes: usage,
      thresholdBytes: STORAGE_QUOTA_WARNING_BYTES,
    });
    return false;
  }

  return true;
}

// ── Network Debounce ───────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastNetworkState: boolean | null = null;

/**
 * Debounced network status handler. Prevents rapid online/offline
 * toggling from triggering multiple sync passes.
 *
 * @param isOnline - Current network state
 * @param onStableOnline - Callback when network is stably online
 * @param onStableOffline - Callback when network is stably offline
 * @param debounceMs - Debounce delay in ms (default: 2000)
 */
export function handleNetworkChange(
  isOnline: boolean,
  onStableOnline: () => void,
  onStableOffline: () => void,
  debounceMs: number = NETWORK_DEBOUNCE_MS,
): void {
  // Clear any pending debounce
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // If state hasn't changed, ignore
  if (lastNetworkState === isOnline) return;

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    // Only fire if state is still the same after debounce
    const previousState = lastNetworkState;
    lastNetworkState = isOnline;

    if (isOnline) {
      logOfflineEvent('network_online', {
        previousState: previousState === null ? 'unknown' : previousState ? 'online' : 'offline',
      });
      onStableOnline();
    } else {
      logOfflineEvent('network_offline', {
        previousState: previousState === null ? 'unknown' : previousState ? 'online' : 'offline',
      });
      onStableOffline();
    }
  }, debounceMs);
}

/**
 * Reset the debounce state. Useful for testing.
 */
export function resetNetworkDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  lastNetworkState = null;
}

// ── Startup Hardening ──────────────────────────────────────────────

/**
 * Run all startup hardening checks. Should be called once during
 * app initialization, after the sync store is hydrated.
 *
 * 1. Recover from interrupted sync
 * 2. Purge corrupt queue entries
 * 3. Prune stale entries
 * 4. Check storage quota
 */
export async function runStartupHardening(): Promise<{
  recoveredFromInterrupt: boolean;
  corruptEntriesRemoved: number;
  staleEntriesRemoved: number;
  storageOk: boolean;
}> {
  const recoveredFromInterrupt = await recoverFromInterruptedSync();
  const corruptEntriesRemoved = purgeCorruptQueueEntries();
  const staleEntriesRemoved = pruneStaleQueueEntries();
  const storageOk = await checkStorageQuota();

  return {
    recoveredFromInterrupt,
    corruptEntriesRemoved,
    staleEntriesRemoved,
    storageOk,
  };
}
