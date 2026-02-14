/**
 * Sync Queue Replay Tests
 *
 * Verifies sync queue operations: seeding, status transitions,
 * failure tracking, and reset behaviour.
 */

import { useSyncStore } from '../src/stores/sync-store';
import {
  seedSyncQueue,
  getSyncQueueSnapshot,
  resetSyncQueue,
} from '../src/utils/offline-test-helpers';

beforeAll(() => {
  // @ts-expect-error – __DEV__ is a global in RN
  global.__DEV__ = false;
});

beforeEach(() => {
  resetSyncQueue();
});

describe('Sync Queue', () => {
  it('seeds items into the queue', () => {
    seedSyncQueue([
      { id: 'item-1', label: 'Irrigation record' },
      { id: 'item-2', label: 'Spray record' },
    ]);

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.totalCount).toBe(2);
    expect(snapshot.pendingCount).toBe(2);
    expect(snapshot.items['item-1'].label).toBe('Irrigation record');
  });

  it('marks items as syncing', () => {
    seedSyncQueue([{ id: 'item-1' }, { id: 'item-2' }]);

    useSyncStore.getState().markAllSyncing();

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.items['item-1'].status).toBe('syncing');
    expect(snapshot.items['item-2'].status).toBe('syncing');
  });

  it('marks individual items as synced (removes them)', () => {
    seedSyncQueue([{ id: 'item-1' }, { id: 'item-2' }]);

    useSyncStore.getState().markSynced('item-1');

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.totalCount).toBe(1);
    expect(snapshot.items['item-1']).toBeUndefined();
    expect(snapshot.items['item-2']).toBeDefined();
  });

  it('marks items as failed with error and increments retries', () => {
    seedSyncQueue([{ id: 'item-1' }]);

    useSyncStore.getState().markFailed('item-1', 'Network error');

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.items['item-1'].status).toBe('failed');
    expect(snapshot.items['item-1'].error).toBe('Network error');
    expect(snapshot.items['item-1'].retries).toBe(1);
    expect(snapshot.failedCount).toBe(1);
  });

  it('tracks retry count across multiple failures', () => {
    seedSyncQueue([{ id: 'item-1' }]);

    const store = useSyncStore.getState();
    store.markFailed('item-1', 'Error 1');
    store.markFailed('item-1', 'Error 2');
    store.markFailed('item-1', 'Error 3');

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.items['item-1'].retries).toBe(3);
    expect(snapshot.items['item-1'].error).toBe('Error 3');
  });

  it('records sync timestamp', () => {
    const store = useSyncStore.getState();
    expect(store.lastSyncedAt).toBeNull();

    store.recordSync();

    const updated = useSyncStore.getState();
    expect(updated.lastSyncedAt).toBeTruthy();
    expect(updated.isSyncing).toBe(false);
  });

  it('resets the queue completely', () => {
    seedSyncQueue([{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }]);
    useSyncStore.getState().recordSync();

    resetSyncQueue();

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.totalCount).toBe(0);
    expect(useSyncStore.getState().lastSyncedAt).toBeNull();
  });

  it('handles upsert for existing items', () => {
    seedSyncQueue([{ id: 'item-1', label: 'Original' }]);

    useSyncStore.getState().upsertItem('item-1', { label: 'Updated', status: 'failed' });

    const snapshot = getSyncQueueSnapshot();
    expect(snapshot.items['item-1'].label).toBe('Updated');
    expect(snapshot.items['item-1'].status).toBe('failed');
    expect(snapshot.totalCount).toBe(1);
  });
});
