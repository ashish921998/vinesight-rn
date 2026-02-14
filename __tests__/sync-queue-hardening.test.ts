/**
 * Sync Queue Hardening Tests
 *
 * Verifies edge-case handling: corrupt entries, stale pruning,
 * mid-sync recovery, network debounce, and storage quota checks.
 *
 * Phase 8 of offline functionality.
 */

import { useSyncStore } from '../src/stores/sync-store';
import {
  validateSyncItem,
  purgeCorruptQueueEntries,
  pruneStaleQueueEntries,
  recoverFromInterruptedSync,
  handleNetworkChange,
  resetNetworkDebounce,
  checkStorageQuota,
  runStartupHardening,
} from '../src/services/sync-queue-hardening';
import { clearOfflineLog, getOfflineLogEntries } from '../src/services/offline-logger';
import { seedSyncQueue, resetSyncQueue } from '../src/utils/offline-test-helpers';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
}));

const AsyncStorage =
  require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage').default;

beforeAll(() => {
  // @ts-expect-error – __DEV__ is a global in RN
  global.__DEV__ = false;
});

beforeEach(() => {
  resetSyncQueue();
  clearOfflineLog();
  resetNetworkDebounce();
  jest.clearAllMocks();
});

// ── Validation ─────────────────────────────────────────────────────

describe('validateSyncItem', () => {
  it('accepts a valid sync item', () => {
    expect(
      validateSyncItem({
        id: 'item-1',
        status: 'pending',
        queuedAt: new Date().toISOString(),
        retries: 0,
      }),
    ).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(validateSyncItem(null)).toBe(false);
    expect(validateSyncItem(undefined)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(validateSyncItem('string')).toBe(false);
    expect(validateSyncItem(42)).toBe(false);
  });

  it('rejects items with missing required fields', () => {
    expect(validateSyncItem({ id: 'x', status: 'pending' })).toBe(false);
    expect(validateSyncItem({ id: 'x', queuedAt: '2024-01-01' })).toBe(false);
  });

  it('rejects items with empty id', () => {
    expect(
      validateSyncItem({
        id: '',
        status: 'pending',
        queuedAt: new Date().toISOString(),
        retries: 0,
      }),
    ).toBe(false);
  });

  it('rejects items with invalid status', () => {
    expect(
      validateSyncItem({
        id: 'x',
        status: 'invalid',
        queuedAt: new Date().toISOString(),
        retries: 0,
      }),
    ).toBe(false);
  });

  it('rejects items with invalid date', () => {
    expect(
      validateSyncItem({
        id: 'x',
        status: 'pending',
        queuedAt: 'not-a-date',
        retries: 0,
      }),
    ).toBe(false);
  });

  it('rejects items with negative retries', () => {
    expect(
      validateSyncItem({
        id: 'x',
        status: 'pending',
        queuedAt: new Date().toISOString(),
        retries: -1,
      }),
    ).toBe(false);
  });
});

// ── Corrupt Entry Purging ──────────────────────────────────────────

describe('purgeCorruptQueueEntries', () => {
  it('removes nothing from a valid queue', () => {
    seedSyncQueue([{ id: 'item-1' }, { id: 'item-2' }]);

    const removed = purgeCorruptQueueEntries();
    expect(removed).toBe(0);
    expect(Object.keys(useSyncStore.getState().items).length).toBe(2);
  });

  it('removes corrupt entries and logs them', () => {
    // Manually inject a corrupt entry
    const store = useSyncStore.getState();
    store.upsertItem('good-item', { label: 'Good', status: 'pending', retries: 0 });

    // Force a corrupt entry by directly manipulating state
    useSyncStore.setState((state) => ({
      items: {
        ...state.items,
        'corrupt-item': {
          id: 'corrupt-item',
          status: 'invalid-status' as 'pending',
          queuedAt: 'not-a-date',
          retries: -1,
        },
      },
    }));

    const removed = purgeCorruptQueueEntries();
    expect(removed).toBe(1);
    expect(useSyncStore.getState().items['corrupt-item']).toBeUndefined();
    expect(useSyncStore.getState().items['good-item']).toBeDefined();

    // Check that a log entry was created
    const logs = getOfflineLogEntries();
    expect(logs.some((l) => l.type === 'queue_entry_corrupt')).toBe(true);
  });
});

// ── Stale Entry Pruning ────────────────────────────────────────────

describe('pruneStaleQueueEntries', () => {
  it('removes entries older than 7 days', () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    seedSyncQueue([
      { id: 'old-item', queuedAt: oldDate },
      { id: 'new-item' }, // defaults to now
    ]);

    const removed = pruneStaleQueueEntries();
    expect(removed).toBe(1);
    expect(useSyncStore.getState().items['old-item']).toBeUndefined();
    expect(useSyncStore.getState().items['new-item']).toBeDefined();
  });

  it('removes entries that exceeded max retries', () => {
    seedSyncQueue([
      { id: 'exhausted-item', retries: 5 },
      { id: 'ok-item', retries: 2 },
    ]);

    const removed = pruneStaleQueueEntries();
    expect(removed).toBe(1);
    expect(useSyncStore.getState().items['exhausted-item']).toBeUndefined();
    expect(useSyncStore.getState().items['ok-item']).toBeDefined();
  });
});

// ── Mid-Sync Recovery ──────────────────────────────────────────────

describe('recoverFromInterruptedSync', () => {
  it('does nothing when no sync was in progress', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const recovered = await recoverFromInterruptedSync();
    expect(recovered).toBe(false);
  });

  it('recovers items stuck in syncing state', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date().toISOString());

    seedSyncQueue([
      { id: 'item-1', status: 'syncing' },
      { id: 'item-2', status: 'pending' },
      { id: 'item-3', status: 'syncing' },
    ]);

    const recovered = await recoverFromInterruptedSync();
    expect(recovered).toBe(true);

    const items = useSyncStore.getState().items;
    expect(items['item-1'].status).toBe('pending');
    expect(items['item-2'].status).toBe('pending');
    expect(items['item-3'].status).toBe('pending');
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it('clears the in-progress flag after recovery', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(new Date().toISOString());

    await recoverFromInterruptedSync();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@vinesight/sync-in-progress');
  });
});

// ── Network Debounce ───────────────────────────────────────────────

describe('handleNetworkChange', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces rapid online/offline toggling', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    // Rapid toggling
    handleNetworkChange(false, onOnline, onOffline, 500);
    handleNetworkChange(true, onOnline, onOffline, 500);
    handleNetworkChange(false, onOnline, onOffline, 500);
    handleNetworkChange(true, onOnline, onOffline, 500);

    // Nothing should fire yet
    expect(onOnline).not.toHaveBeenCalled();
    expect(onOffline).not.toHaveBeenCalled();

    // After debounce, only the last state should fire
    jest.advanceTimersByTime(600);

    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onOffline).not.toHaveBeenCalled();
  });

  it('fires offline callback when going offline', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    handleNetworkChange(false, onOnline, onOffline, 100);

    jest.advanceTimersByTime(150);

    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onOnline).not.toHaveBeenCalled();
  });

  it('ignores duplicate state changes', () => {
    const onOnline = jest.fn();
    const onOffline = jest.fn();

    // First change
    handleNetworkChange(false, onOnline, onOffline, 100);
    jest.advanceTimersByTime(150);
    expect(onOffline).toHaveBeenCalledTimes(1);

    // Same state again – should be ignored
    handleNetworkChange(false, onOnline, onOffline, 100);
    jest.advanceTimersByTime(150);
    expect(onOffline).toHaveBeenCalledTimes(1); // Still 1
  });
});

// ── Storage Quota ──────────────────────────────────────────────────

describe('checkStorageQuota', () => {
  it('returns true when storage is within limits', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['key1']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([['key1', 'small']]);

    const ok = await checkStorageQuota();
    expect(ok).toBe(true);
  });

  it('returns false and logs when storage exceeds threshold', async () => {
    // Simulate large storage (> 5MB)
    const largeValue = 'x'.repeat(3 * 1024 * 1024); // 3MB string = 6MB in UTF-16
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['key1']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([['key1', largeValue]]);

    const ok = await checkStorageQuota();
    expect(ok).toBe(false);

    const logs = getOfflineLogEntries();
    expect(logs.some((l) => l.type === 'storage_quota_exceeded')).toBe(true);
  });

  it('returns true when estimation fails', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('fail'));

    const ok = await checkStorageQuota();
    expect(ok).toBe(true);
  });
});

// ── Startup Hardening ──────────────────────────────────────────────

describe('runStartupHardening', () => {
  it('runs all checks and returns results', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);

    seedSyncQueue([{ id: 'item-1' }]);

    const result = await runStartupHardening();

    expect(result.recoveredFromInterrupt).toBe(false);
    expect(result.corruptEntriesRemoved).toBe(0);
    expect(result.staleEntriesRemoved).toBe(0);
    expect(result.storageOk).toBe(true);
  });
});
