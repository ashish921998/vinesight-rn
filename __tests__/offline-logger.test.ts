/**
 * Offline Logger Tests
 *
 * Verifies structured logging, ring buffer behaviour, listener
 * notifications, analytics counters, and summary generation.
 *
 * Phase 8 of offline functionality.
 */

import {
  logOfflineEvent,
  getOfflineLogEntries,
  clearOfflineLog,
  getOfflineLogSummary,
  addOfflineLogListener,
  getSyncAnalytics,
  resetSyncAnalytics,
  type OfflineLogEntry,
} from '../src/services/offline-logger';

beforeAll(() => {
  // @ts-expect-error – __DEV__ is a global in RN
  global.__DEV__ = false;
});

beforeEach(() => {
  clearOfflineLog();
  resetSyncAnalytics();
});

describe('Offline Logger', () => {
  it('logs events to the buffer', () => {
    logOfflineEvent('sync_started', { test: true });

    const entries = getOfflineLogEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe('sync_started');
    expect(entries[0].metadata).toEqual({ test: true });
    expect(entries[0].timestamp).toBeTruthy();
  });

  it('logs events with error messages', () => {
    logOfflineEvent('sync_failed', { duration: 100 }, 'Network timeout');

    const entries = getOfflineLogEntries();
    expect(entries[0].error).toBe('Network timeout');
  });

  it('respects ring buffer max size', () => {
    // Log more than MAX_LOG_ENTRIES (200)
    for (let i = 0; i < 210; i++) {
      logOfflineEvent('sync_started', { index: i });
    }

    const entries = getOfflineLogEntries();
    expect(entries.length).toBe(200);
    // Oldest entries should have been dropped
    expect((entries[0].metadata as Record<string, number>).index).toBe(10);
  });

  it('clears the log buffer', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');

    clearOfflineLog();

    expect(getOfflineLogEntries().length).toBe(0);
  });

  it('generates a summary by event type', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_item_success');

    const summary = getOfflineLogSummary();
    expect(summary.sync_started).toBe(2);
    expect(summary.sync_completed).toBe(1);
    expect(summary.sync_item_success).toBe(1);
  });

  it('notifies listeners on new events', () => {
    const received: OfflineLogEntry[] = [];
    const unsubscribe = addOfflineLogListener((entry) => {
      received.push(entry);
    });

    logOfflineEvent('network_online');
    logOfflineEvent('network_offline');

    expect(received.length).toBe(2);
    expect(received[0].type).toBe('network_online');
    expect(received[1].type).toBe('network_offline');

    unsubscribe();

    logOfflineEvent('sync_started');
    // Should not receive after unsubscribe
    expect(received.length).toBe(2);
  });

  it('does not crash if a listener throws', () => {
    const unsubscribe = addOfflineLogListener(() => {
      throw new Error('Listener error');
    });

    // Should not throw
    expect(() => logOfflineEvent('sync_started')).not.toThrow();

    unsubscribe();
  });
});

describe('Sync Analytics', () => {
  it('tracks sync attempts and successes', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_failed');

    const analytics = getSyncAnalytics();
    expect(analytics.totalSyncAttempts).toBe(2);
    expect(analytics.totalSyncSuccesses).toBe(1);
    expect(analytics.totalSyncFailures).toBe(1);
  });

  it('tracks item-level sync results', () => {
    logOfflineEvent('sync_item_success');
    logOfflineEvent('sync_item_success');
    logOfflineEvent('sync_item_failed');

    const analytics = getSyncAnalytics();
    expect(analytics.totalItemsSynced).toBe(2);
    expect(analytics.totalItemsFailed).toBe(1);
  });

  it('tracks conflicts', () => {
    logOfflineEvent('conflict_detected');
    logOfflineEvent('conflict_detected');
    logOfflineEvent('conflict_resolved');

    const analytics = getSyncAnalytics();
    expect(analytics.totalConflicts).toBe(2);
    expect(analytics.totalConflictsResolved).toBe(1);
  });

  it('tracks corrupt entries and storage warnings', () => {
    logOfflineEvent('queue_entry_corrupt');
    logOfflineEvent('storage_quota_exceeded');
    logOfflineEvent('cache_quota_warning');

    const analytics = getSyncAnalytics();
    expect(analytics.totalCorruptEntries).toBe(1);
    expect(analytics.totalStorageWarnings).toBe(2);
  });

  it('resets analytics counters', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');

    resetSyncAnalytics();

    const analytics = getSyncAnalytics();
    expect(analytics.totalSyncAttempts).toBe(0);
    expect(analytics.totalSyncSuccesses).toBe(0);
    expect(analytics.lastResetAt).toBeTruthy();
  });
});
