/**
 * Offline Logger Tests
 *
 * Verifies structured logging: ring buffer, listeners, summary.
 */

import {
  logOfflineEvent,
  getOfflineLogEntries,
  clearOfflineLog,
  getOfflineLogSummary,
  addOfflineLogListener,
  type OfflineLogEntry,
} from '../src/services/offline-logger';

beforeAll(() => {
  // @ts-expect-error – __DEV__ is a global in RN
  global.__DEV__ = false;
});

beforeEach(() => {
  clearOfflineLog();
});

describe('Offline Logger', () => {
  it('logs events to the buffer', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed', { itemsSynced: 3 });

    const entries = getOfflineLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('sync_started');
    expect(entries[1].type).toBe('sync_completed');
    expect(entries[1].metadata).toEqual({ itemsSynced: 3 });
  });

  it('includes error field when provided', () => {
    logOfflineEvent('sync_failed', { step: 'replay' }, 'Network timeout');

    const entries = getOfflineLogEntries();
    expect(entries[0].error).toBe('Network timeout');
  });

  it('clears the log buffer', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');
    clearOfflineLog();

    expect(getOfflineLogEntries()).toHaveLength(0);
  });

  it('generates a summary by event type', () => {
    logOfflineEvent('sync_started');
    logOfflineEvent('sync_completed');
    logOfflineEvent('sync_started');
    logOfflineEvent('cache_hit');

    const summary = getOfflineLogSummary();
    expect(summary.sync_started).toBe(2);
    expect(summary.sync_completed).toBe(1);
    expect(summary.cache_hit).toBe(1);
  });

  it('notifies listeners on new events', () => {
    const received: OfflineLogEntry[] = [];
    const unsubscribe = addOfflineLogListener((entry) => received.push(entry));

    logOfflineEvent('network_online');
    logOfflineEvent('network_offline');

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('network_online');
    expect(received[1].type).toBe('network_offline');

    unsubscribe();

    logOfflineEvent('sync_started');
    expect(received).toHaveLength(2); // No new events after unsubscribe
  });

  it('respects the ring buffer max size', () => {
    // Log more than MAX_LOG_ENTRIES (200)
    for (let i = 0; i < 210; i++) {
      logOfflineEvent('cache_hit', { index: i });
    }

    const entries = getOfflineLogEntries();
    expect(entries.length).toBeLessThanOrEqual(200);
    // Oldest entries should have been dropped
    expect((entries[0].metadata as Record<string, number>).index).toBe(10);
  });
});
