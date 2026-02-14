/**
 * Background Sync Service – Orchestrates background fetch, sync queue replay,
 * and periodic data refresh using expo-background-fetch and expo-task-manager.
 *
 * Responsibilities:
 * - Register/unregister background fetch tasks with the OS
 * - Replay pending mutations from the sync queue
 * - Refresh critical data from Supabase
 * - Smart scheduling: Wi-Fi preference, battery awareness, rate limiting
 * - Logging sync activity for debugging
 *
 * Phase 7: Background Sync & Periodic Refresh
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useBackgroundSyncStore } from '../stores/background-sync-store';
import {
  getQueue,
  dequeue,
  markFailed,
  getQueueStats,
  type QueuedMutation,
} from './sync-queue-service';
import { refreshAllData, type RefreshConfig } from './data-refresh-service';

// ============================================================
// MARK: - Types
// ============================================================

type TaskManager = typeof import('expo-task-manager');
type BackgroundFetch = typeof import('expo-background-fetch');
type NetInfo = typeof import('@react-native-community/netinfo');
type Battery = typeof import('expo-battery');

export interface BackgroundSyncConfig {
  /** Minimum interval for background fetch in seconds. Default: 900 (15 min). */
  minimumIntervalSec: number;
  /** Whether to only sync on Wi-Fi. Default: false. */
  wifiOnly: boolean;
  /** Minimum battery level (0–1) required to sync. Default: 0.15 (15%). */
  minBatteryLevel: number;
  /** Data refresh configuration. */
  refreshConfig: Partial<RefreshConfig>;
  /** Maximum mutations to replay per background fetch cycle. */
  maxMutationsPerCycle: number;
}

export interface SyncResult {
  /** Number of mutations successfully replayed. */
  mutationsSynced: number;
  /** Number of mutations that failed. */
  mutationsFailed: number;
  /** Whether data refresh was performed. */
  dataRefreshed: boolean;
  /** ISO timestamp of completion. */
  completedAt: string;
}

// ============================================================
// MARK: - Constants
// ============================================================

const BACKGROUND_SYNC_TASK = 'VINESIGHT_BACKGROUND_SYNC';
const CONFIG_STORAGE_KEY = '@vinesight/background-sync-config';

const DEFAULT_CONFIG: BackgroundSyncConfig = {
  minimumIntervalSec: 15 * 60, // 15 minutes
  wifiOnly: false,
  minBatteryLevel: 0.15,
  refreshConfig: {},
  maxMutationsPerCycle: 20,
};

// ============================================================
// MARK: - Dynamic Imports (safe for web)
// ============================================================

async function getTaskManager(): Promise<TaskManager | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await import('expo-task-manager');
  } catch {
    if (__DEV__) console.log('[BackgroundSync] expo-task-manager not available');
    return null;
  }
}

async function getBackgroundFetch(): Promise<BackgroundFetch | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await import('expo-background-fetch');
  } catch {
    if (__DEV__) console.log('[BackgroundSync] expo-background-fetch not available');
    return null;
  }
}

async function getNetInfo(): Promise<NetInfo | null> {
  try {
    return await import('@react-native-community/netinfo');
  } catch {
    if (__DEV__) console.log('[BackgroundSync] @react-native-community/netinfo not available');
    return null;
  }
}

async function getBattery(): Promise<Battery | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await import('expo-battery');
  } catch {
    if (__DEV__) console.log('[BackgroundSync] expo-battery not available');
    return null;
  }
}

// ============================================================
// MARK: - Store Helpers
// ============================================================

function log(level: 'info' | 'warn' | 'error', message: string): void {
  const store = useBackgroundSyncStore.getState();
  store.addLogEntry(level, message);

  if (__DEV__) {
    const prefix = `[BackgroundSync]`;
    if (level === 'error') console.error(prefix, message);
    else if (level === 'warn') console.warn(prefix, message);
    else console.log(prefix, message);
  }
}

// ============================================================
// MARK: - Configuration
// ============================================================

/**
 * Load persisted configuration or return defaults.
 */
export async function getConfig(): Promise<BackgroundSyncConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Persist configuration changes.
 */
export async function updateConfig(
  patch: Partial<BackgroundSyncConfig>,
): Promise<BackgroundSyncConfig> {
  const current = await getConfig();
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// ============================================================
// MARK: - Pre-Sync Checks
// ============================================================

/**
 * Check whether conditions are suitable for syncing.
 */
async function canSync(config: BackgroundSyncConfig): Promise<{ ok: boolean; reason?: string }> {
  // Check Supabase configuration
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'Supabase not configured' };
  }

  // Check authentication
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return { ok: false, reason: 'User not authenticated' };
    }
  } catch {
    return { ok: false, reason: 'Failed to check auth session' };
  }

  // Check network connectivity
  const NetInfoModule = await getNetInfo();
  if (NetInfoModule) {
    const state = await NetInfoModule.default.fetch();
    if (!state.isConnected) {
      return { ok: false, reason: 'No network connection' };
    }
    if (config.wifiOnly && state.type !== 'wifi') {
      return { ok: false, reason: 'Wi-Fi required but not connected to Wi-Fi' };
    }
  }

  // Check battery level
  const BatteryModule = await getBattery();
  if (BatteryModule) {
    try {
      const batteryLevel = await BatteryModule.getBatteryLevelAsync();
      if (batteryLevel >= 0 && batteryLevel < config.minBatteryLevel) {
        return {
          ok: false,
          reason: `Battery too low: ${Math.round(batteryLevel * 100)}% < ${Math.round(config.minBatteryLevel * 100)}%`,
        };
      }
    } catch {
      // Battery API may not be available on all devices; proceed anyway
    }
  }

  return { ok: true };
}

// ============================================================
// MARK: - Sync Queue Replay
// ============================================================

/**
 * Replay pending mutations from the sync queue against Supabase.
 */
async function replaySyncQueue(maxItems: number): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const batch = queue.slice(0, maxItems);
  let synced = 0;
  let failed = 0;

  for (const item of batch) {
    try {
      await replayMutation(item);
      await dequeue(item.id);
      synced++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await markFailed(item.id, errorMsg);
      failed++;
      log('error', `Failed to replay mutation ${item.id}: ${errorMsg}`);
    }
  }

  return { synced, failed };
}

/**
 * Replay a single mutation against Supabase.
 */
async function replayMutation(item: QueuedMutation): Promise<void> {
  const { table, operation, payload } = item;

  switch (operation) {
    case 'INSERT': {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE': {
      const { id: recordId, ...updateData } = payload;
      if (!recordId) throw new Error('UPDATE mutation missing record id');
      const { error } = await supabase.from(table).update(updateData).eq('id', recordId);
      if (error) throw error;
      break;
    }
    case 'DELETE': {
      const deleteId = payload.id;
      if (!deleteId) throw new Error('DELETE mutation missing record id');
      const { error } = await supabase.from(table).delete().eq('id', deleteId);
      if (error) throw error;
      break;
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// ============================================================
// MARK: - Core Sync Execution
// ============================================================

/**
 * Execute a full background sync cycle:
 * 1. Check preconditions (network, battery, auth)
 * 2. Replay pending mutations from the sync queue
 * 3. Refresh critical data from Supabase
 */
export async function executeSync(force = false): Promise<SyncResult> {
  const store = useBackgroundSyncStore.getState();

  if (store.isSyncing) {
    log('warn', 'Sync already in progress, skipping');
    return {
      mutationsSynced: 0,
      mutationsFailed: 0,
      dataRefreshed: false,
      completedAt: new Date().toISOString(),
    };
  }

  store.setSyncing(true);
  store.setLastError(null);
  log('info', 'Starting background sync cycle');

  const config = await getConfig();

  try {
    // Pre-sync checks
    if (!force) {
      const check = await canSync(config);
      if (!check.ok) {
        log('warn', `Sync skipped: ${check.reason}`);
        store.setSyncing(false);
        return {
          mutationsSynced: 0,
          mutationsFailed: 0,
          dataRefreshed: false,
          completedAt: new Date().toISOString(),
        };
      }
    }

    // Step 1: Replay sync queue
    log('info', 'Replaying sync queue...');
    const queueResult = await replaySyncQueue(config.maxMutationsPerCycle);
    log(
      'info',
      `Queue replay complete: ${queueResult.synced} synced, ${queueResult.failed} failed`,
    );

    // Step 2: Refresh data
    log('info', 'Refreshing data...');
    const refreshResult = await refreshAllData(config.refreshConfig, force);
    const dataRefreshed = refreshResult.refreshed.length > 0;
    if (dataRefreshed) {
      store.setLastRefreshAt(refreshResult.completedAt);
      log('info', `Data refreshed: ${refreshResult.refreshed.join(', ')}`);
    }
    if (refreshResult.failed.length > 0) {
      log(
        'warn',
        `Data refresh failures: ${refreshResult.failed.map((f) => `${f.key}: ${f.error}`).join('; ')}`,
      );
    }

    // Update store
    const completedAt = new Date().toISOString();
    store.setLastSyncAt(completedAt);

    const stats = await getQueueStats();
    store.setPendingMutationCount(stats.total);

    // Estimate next sync
    const nextSync = new Date(Date.now() + config.minimumIntervalSec * 1000).toISOString();
    store.setNextScheduledAt(nextSync);

    log('info', `Sync cycle complete at ${completedAt}`);

    return {
      mutationsSynced: queueResult.synced,
      mutationsFailed: queueResult.failed,
      dataRefreshed,
      completedAt,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    store.setLastError(errorMsg);
    log('error', `Sync cycle failed: ${errorMsg}`);

    return {
      mutationsSynced: 0,
      mutationsFailed: 0,
      dataRefreshed: false,
      completedAt: new Date().toISOString(),
    };
  } finally {
    store.setSyncing(false);
  }
}

// ============================================================
// MARK: - Background Task Registration
// ============================================================

/**
 * Define the background task handler. Must be called at module level
 * (outside of any component) before registerBackgroundSync.
 */
export async function defineBackgroundSyncTask(): Promise<void> {
  const TaskManagerModule = await getTaskManager();
  if (!TaskManagerModule) {
    if (__DEV__) console.log('[BackgroundSync] TaskManager not available, skipping task definition');
    return;
  }

  TaskManagerModule.defineTask(BACKGROUND_SYNC_TASK, async () => {
    const BackgroundFetchModule = await getBackgroundFetch();
    if (!BackgroundFetchModule) {
      return BackgroundFetchModule?.BackgroundFetchResult?.NoData ?? 1;
    }

    try {
      log('info', 'Background fetch triggered by OS');
      const result = await executeSync();

      if (result.mutationsSynced > 0 || result.dataRefreshed) {
        return BackgroundFetchModule.BackgroundFetchResult.NewData;
      }
      return BackgroundFetchModule.BackgroundFetchResult.NoData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log('error', `Background fetch task error: ${errorMsg}`);
      return BackgroundFetchModule.BackgroundFetchResult.Failed;
    }
  });
}

/**
 * Register the background fetch task with the OS.
 *
 * On iOS, the OS decides when to actually run the task based on usage patterns.
 * On Android, it runs approximately at the specified interval.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  const BackgroundFetchModule = await getBackgroundFetch();
  if (!BackgroundFetchModule) {
    log('warn', 'Background fetch not available on this platform');
    return false;
  }

  const config = await getConfig();

  try {
    // Check current status
    const status = await BackgroundFetchModule.getStatusAsync();
    if (
      status === null ||
      status === BackgroundFetchModule.BackgroundFetchStatus.Denied
    ) {
      log('warn', 'Background fetch permission denied by user/OS');
      return false;
    }

    if (status === BackgroundFetchModule.BackgroundFetchStatus.Restricted) {
      log('warn', 'Background fetch restricted by OS');
      return false;
    }

    await BackgroundFetchModule.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: config.minimumIntervalSec,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    const store = useBackgroundSyncStore.getState();
    store.setRegistered(true);
    store.setNextScheduledAt(
      new Date(Date.now() + config.minimumIntervalSec * 1000).toISOString(),
    );

    log('info', `Background sync registered (interval: ${config.minimumIntervalSec}s)`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('error', `Failed to register background sync: ${errorMsg}`);
    return false;
  }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  const BackgroundFetchModule = await getBackgroundFetch();
  if (!BackgroundFetchModule) return;

  try {
    await BackgroundFetchModule.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    const store = useBackgroundSyncStore.getState();
    store.setRegistered(false);
    store.setNextScheduledAt(null);
    log('info', 'Background sync unregistered');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('error', `Failed to unregister background sync: ${errorMsg}`);
  }
}

/**
 * Check if the background sync task is currently registered.
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  const TaskManagerModule = await getTaskManager();
  if (!TaskManagerModule) return false;

  try {
    return await TaskManagerModule.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  } catch {
    return false;
  }
}

// ============================================================
// MARK: - Exports
// ============================================================

export { BACKGROUND_SYNC_TASK };
