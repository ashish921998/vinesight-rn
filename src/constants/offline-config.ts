/**
 * Offline & Background Sync Configuration
 *
 * Central configuration for all offline-first behaviour including
 * background sync intervals, retry policies, and data-usage preferences.
 */

/** Minimum interval (in seconds) between background-fetch invocations. */
export const BACKGROUND_SYNC_INTERVAL_SECONDS = 15 * 60; // 15 minutes

/** Maximum number of retry attempts for a single sync-queue item. */
export const MAX_SYNC_RETRIES = 5;

/**
 * Whether to allow large sync operations (media uploads, bulk prefetch)
 * when the device is on a cellular connection.
 *
 * When `false`, only lightweight mutations (text data) are synced on cellular;
 * media uploads and full prefetch are deferred until Wi-Fi.
 */
export const SYNC_ON_CELLULAR = true;

/**
 * Battery level threshold (0–1). If the device battery is below this
 * level, heavy sync work (media uploads, prefetch) is skipped.
 */
export const LOW_BATTERY_THRESHOLD = 0.15;

/**
 * Name of the registered background task used by expo-task-manager.
 * Must be a unique string across the app.
 */
export const BACKGROUND_SYNC_TASK_NAME = 'VINESIGHT_BACKGROUND_SYNC';

/**
 * Consolidated config object for programmatic access.
 */
export const offlineSyncConfig = {
  backgroundSyncIntervalSeconds: BACKGROUND_SYNC_INTERVAL_SECONDS,
  maxSyncRetries: MAX_SYNC_RETRIES,
  syncOnCellular: SYNC_ON_CELLULAR,
  lowBatteryThreshold: LOW_BATTERY_THRESHOLD,
  backgroundSyncTaskName: BACKGROUND_SYNC_TASK_NAME,
} as const;
