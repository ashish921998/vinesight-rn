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
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_eviction'
  | 'media_upload_queued'
  | 'media_upload_success'
  | 'media_upload_failed'
  | 'network_online'
  | 'network_offline'
  | 'background_task_started'
  | 'background_task_completed'
  | 'background_task_failed'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed';

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

// ── In-memory ring buffer ──────────────────────────────────────────

const MAX_LOG_ENTRIES = 200;
const logBuffer: OfflineLogEntry[] = [];
const listeners: Set<OfflineLogListener> = new Set();

// ── Public API ─────────────────────────────────────────────────────

/**
 * Log an offline event. Stores in the ring buffer and notifies listeners.
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

  // Dev console
  if (__DEV__) {
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
export function getOfflineLogSummary(): Record<OfflineEventType, number> {
  const summary = {} as Record<OfflineEventType, number>;
  for (const entry of logBuffer) {
    summary[entry.type] = (summary[entry.type] ?? 0) + 1;
  }
  return summary;
}
