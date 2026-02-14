/**
 * Offline Logger – Structured logging for offline events.
 *
 * Captures sync success/failure, conflicts, cache hits/misses, and
 * other offline-related events in a structured format that can be
 * wired to analytics (PostHog, Sentry, etc.) later.
 *
 * Phase 8 of offline functionality.
 */

// ── Types ──────────────────────────────────────────────────────────

export type OfflineEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'sync_item_success'
  | 'sync_item_failed'
  | 'sync_item_skipped'
  | 'sync_interrupted'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_eviction'
  | 'cache_quota_warning'
  | 'media_upload_queued'
  | 'media_upload_success'
  | 'media_upload_failed'
  | 'network_online'
  | 'network_offline'
  | 'network_debounced'
  | 'background_task_started'
  | 'background_task_completed'
  | 'background_task_failed'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed'
  | 'queue_entry_corrupt'
  | 'queue_entry_pruned'
  | 'storage_quota_exceeded';

export interface OfflineLogEntry {
  /** Event type identifier */
  type: OfflineEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Optional structured metadata */
  metadata?: Record<string, unknown>;
  /** Error message if applicable */
  error?: string;
}

export type OfflineLogListener = (entry: OfflineLogEntry) => void;

// ── Aggregate counters for analytics ───────────────────────────────

export interface SyncAnalytics {
  totalSyncAttempts: number;
  totalSyncSuccesses: number;
  totalSyncFailures: number;
  totalItemsSynced: number;
  totalItemsFailed: number;
  totalConflicts: number;
  totalConflictsResolved: number;
  totalCorruptEntries: number;
  totalStorageWarnings: number;
  lastResetAt: string;
}

const analytics: SyncAnalytics = {
  totalSyncAttempts: 0,
  totalSyncSuccesses: 0,
  totalSyncFailures: 0,
  totalItemsSynced: 0,
  totalItemsFailed: 0,
  totalConflicts: 0,
  totalConflictsResolved: 0,
  totalCorruptEntries: 0,
  totalStorageWarnings: 0,
  lastResetAt: new Date().toISOString(),
};

// ── In-memory ring buffer ──────────────────────────────────────────

const MAX_LOG_ENTRIES = 200;
const logBuffer: OfflineLogEntry[] = [];
const listeners: Set<OfflineLogListener> = new Set();

// ── Public API ─────────────────────────────────────────────────────

/**
 * Log an offline event. Stores in the ring buffer, updates analytics
 * counters, and notifies listeners.
 */
export function logOfflineEvent(
  type: OfflineEventType,
  metadata?: Record<string, unknown>,
  error?: string,
): void {
  const entry: OfflineLogEntry = {
    type,
    timestamp: new Date().toISOString(),
    metadata,
    error,
  };

  // Ring buffer – drop oldest when full
  if (logBuffer.length >= MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
  logBuffer.push(entry);

  // Update aggregate analytics
  updateAnalytics(type);

  // Dev console
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const prefix = `[OfflineLog:${type}]`;
    if (error) {
      console.warn(prefix, metadata ?? '', `Error: ${error}`);
    } else {
      console.log(prefix, metadata ?? '');
    }
  }

  // Notify listeners
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // Swallow listener errors to avoid cascading failures
    }
  }
}

/**
 * Subscribe to offline log events. Returns an unsubscribe function.
 */
export function addOfflineLogListener(listener: OfflineLogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get all log entries currently in the buffer (newest last).
 */
export function getOfflineLogEntries(): readonly OfflineLogEntry[] {
  return logBuffer;
}

/**
 * Clear the log buffer.
 */
export function clearOfflineLog(): void {
  logBuffer.length = 0;
}

/**
 * Get a summary of recent events by type.
 */
export function getOfflineLogSummary(): Partial<Record<OfflineEventType, number>> {
  const summary: Partial<Record<OfflineEventType, number>> = {};
  for (const entry of logBuffer) {
    summary[entry.type] = (summary[entry.type] ?? 0) + 1;
  }
  return summary;
}

/**
 * Get the current analytics counters.
 */
export function getSyncAnalytics(): Readonly<SyncAnalytics> {
  return { ...analytics };
}

/**
 * Reset analytics counters.
 */
export function resetSyncAnalytics(): void {
  analytics.totalSyncAttempts = 0;
  analytics.totalSyncSuccesses = 0;
  analytics.totalSyncFailures = 0;
  analytics.totalItemsSynced = 0;
  analytics.totalItemsFailed = 0;
  analytics.totalConflicts = 0;
  analytics.totalConflictsResolved = 0;
  analytics.totalCorruptEntries = 0;
  analytics.totalStorageWarnings = 0;
  analytics.lastResetAt = new Date().toISOString();
}

// ── Private helpers ────────────────────────────────────────────────

function updateAnalytics(type: OfflineEventType): void {
  switch (type) {
    case 'sync_started':
      analytics.totalSyncAttempts++;
      break;
    case 'sync_completed':
      analytics.totalSyncSuccesses++;
      break;
    case 'sync_failed':
      analytics.totalSyncFailures++;
      break;
    case 'sync_item_success':
      analytics.totalItemsSynced++;
      break;
    case 'sync_item_failed':
      analytics.totalItemsFailed++;
      break;
    case 'conflict_detected':
      analytics.totalConflicts++;
      break;
    case 'conflict_resolved':
      analytics.totalConflictsResolved++;
      break;
    case 'queue_entry_corrupt':
      analytics.totalCorruptEntries++;
      break;
    case 'storage_quota_exceeded':
    case 'cache_quota_warning':
      analytics.totalStorageWarnings++;
      break;
  }
}
