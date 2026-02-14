/**
 * Tests for Background Sync Service (Phase 7)
 *
 * Tests sync queue operations, data refresh, and background sync orchestration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mock modules ────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: { user: { id: 'test-user-id' } } },
          error: null,
        }),
      ),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          eq: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
        })),
        count: 0,
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  unregisterTaskAsync: jest.fn(() => Promise.resolve()),
  getStatusAsync: jest.fn(() => Promise.resolve(3)), // Available
  BackgroundFetchResult: {
    NewData: 2,
    NoData: 1,
    Failed: 3,
  },
  BackgroundFetchStatus: {
    Denied: 1,
    Restricted: 2,
    Available: 3,
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
      }),
    ),
  },
}));

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.8)),
}));

// ── Import after mocks ─────────────────────────────────────────

import {
  enqueue,
  getQueue,
  dequeue,
  markFailed,
  getQueueStats,
  clearQueue,
} from '../src/services/sync-queue-service';

import {
  refreshAllData,
  shouldRefresh,
  getLastRefreshTime,
  clearAllCachedData,
  getCachedData,
} from '../src/services/data-refresh-service';

import {
  executeSync,
  getConfig,
  updateConfig,
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncRegistered,
  defineBackgroundSyncTask,
} from '../src/services/background-sync-service';

import { useBackgroundSyncStore } from '../src/stores/background-sync-store';

// ── Helpers ─────────────────────────────────────────────────────

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAsyncStorage.getItem.mockResolvedValue(null);
  mockAsyncStorage.setItem.mockResolvedValue(undefined);
  mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  mockAsyncStorage.getAllKeys.mockResolvedValue([]);
  mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
  useBackgroundSyncStore.getState().reset();
});

// ================================================================
// MARK: - Sync Queue Service Tests
// ================================================================

describe('SyncQueueService', () => {
  it('enqueues a mutation and persists to AsyncStorage', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null); // empty queue

    const item = await enqueue({
      table: 'farms',
      operation: 'INSERT',
      payload: { name: 'Test Farm' },
    });

    expect(item.id).toBeDefined();
    expect(item.table).toBe('farms');
    expect(item.operation).toBe('INSERT');
    expect(item.retries).toBe(0);
    expect(item.queuedAt).toBeDefined();
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('reads the queue from AsyncStorage', async () => {
    const mockQueue = [
      {
        id: 'sq_1',
        table: 'farms',
        operation: 'INSERT',
        payload: { name: 'Farm 1' },
        queuedAt: '2026-01-01T00:00:00.000Z',
        retries: 0,
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockQueue));

    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].table).toBe('farms');
  });

  it('dequeues an item by id', async () => {
    const mockQueue = [
      {
        id: 'sq_1',
        table: 'farms',
        operation: 'INSERT',
        payload: {},
        queuedAt: '2026-01-01T00:00:00.000Z',
        retries: 0,
      },
      {
        id: 'sq_2',
        table: 'tasks',
        operation: 'UPDATE',
        payload: {},
        queuedAt: '2026-01-01T00:00:01.000Z',
        retries: 0,
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockQueue));

    await dequeue('sq_1');

    const savedCall = mockAsyncStorage.setItem.mock.calls[0];
    const savedQueue = JSON.parse(savedCall[1] as string);
    expect(savedQueue).toHaveLength(1);
    expect(savedQueue[0].id).toBe('sq_2');
  });

  it('marks an item as failed with incremented retries', async () => {
    const mockQueue = [
      {
        id: 'sq_1',
        table: 'farms',
        operation: 'INSERT',
        payload: {},
        queuedAt: '2026-01-01T00:00:00.000Z',
        retries: 0,
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockQueue));

    await markFailed('sq_1', 'Network error');

    const savedCall = mockAsyncStorage.setItem.mock.calls[0];
    const savedQueue = JSON.parse(savedCall[1] as string);
    expect(savedQueue[0].retries).toBe(1);
    expect(savedQueue[0].lastError).toBe('Network error');
  });

  it('returns correct queue stats', async () => {
    const mockQueue = [
      { id: 'sq_1', retries: 0 },
      { id: 'sq_2', retries: 2 },
      { id: 'sq_3', retries: 0 },
    ];
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockQueue));

    const stats = await getQueueStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(2);
    expect(stats.failed).toBe(1);
  });

  it('clears the queue', async () => {
    await clearQueue();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@vinesight/sync-queue');
  });
});

// ================================================================
// MARK: - Data Refresh Service Tests
// ================================================================

describe('DataRefreshService', () => {
  it('shouldRefresh returns true when no previous refresh', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const result = await shouldRefresh();
    expect(result).toBe(true);
  });

  it('shouldRefresh returns false when recently refreshed', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(new Date().toISOString());
    const result = await shouldRefresh(15 * 60 * 1000);
    expect(result).toBe(false);
  });

  it('shouldRefresh returns true when interval has elapsed', async () => {
    const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    mockAsyncStorage.getItem.mockResolvedValueOnce(oldTime);
    const result = await shouldRefresh(15 * 60 * 1000);
    expect(result).toBe(true);
  });

  it('refreshAllData skips when interval not elapsed', async () => {
    // Return recent timestamp for shouldRefresh check
    mockAsyncStorage.getItem.mockResolvedValueOnce(new Date().toISOString());

    const result = await refreshAllData({}, false);
    expect(result.refreshed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('refreshAllData executes when forced', async () => {
    const result = await refreshAllData({ dataSets: ['farms'] }, true);
    // Should attempt to refresh farms (may succeed or fail depending on mock)
    expect(result.completedAt).toBeDefined();
  });

  it('clearAllCachedData removes cache keys', async () => {
    mockAsyncStorage.getAllKeys.mockResolvedValueOnce([
      '@vinesight/cache/farms',
      '@vinesight/cache/tasks',
      '@vinesight/other-key',
    ]);

    await clearAllCachedData();

    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@vinesight/cache/farms',
      '@vinesight/cache/tasks',
    ]);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@vinesight/last-data-refresh');
  });

  it('getCachedData returns null for missing key', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const result = await getCachedData('farms');
    expect(result).toBeNull();
  });
});

// ================================================================
// MARK: - Background Sync Store Tests
// ================================================================

describe('BackgroundSyncStore', () => {
  it('initializes with default state', () => {
    const state = useBackgroundSyncStore.getState();
    expect(state.isRegistered).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncAt).toBeNull();
    expect(state.pendingMutationCount).toBe(0);
    expect(state.syncLog).toHaveLength(0);
  });

  it('tracks sync state changes', () => {
    const store = useBackgroundSyncStore.getState();

    store.setSyncing(true);
    expect(useBackgroundSyncStore.getState().isSyncing).toBe(true);

    store.setLastSyncAt('2026-01-01T00:00:00.000Z');
    expect(useBackgroundSyncStore.getState().lastSyncAt).toBe('2026-01-01T00:00:00.000Z');

    store.setPendingMutationCount(5);
    expect(useBackgroundSyncStore.getState().pendingMutationCount).toBe(5);
  });

  it('adds log entries and caps at 50', () => {
    const store = useBackgroundSyncStore.getState();

    for (let i = 0; i < 60; i++) {
      store.addLogEntry('info', `Log entry ${i}`);
    }

    const state = useBackgroundSyncStore.getState();
    expect(state.syncLog).toHaveLength(50);
    // Most recent entry should be first
    expect(state.syncLog[0].message).toBe('Log entry 59');
  });

  it('resets to initial state', () => {
    const store = useBackgroundSyncStore.getState();
    store.setSyncing(true);
    store.setRegistered(true);
    store.addLogEntry('info', 'test');

    store.reset();

    const state = useBackgroundSyncStore.getState();
    expect(state.isRegistered).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.syncLog).toHaveLength(0);
  });
});

// ================================================================
// MARK: - Background Sync Service Tests
// ================================================================

describe('BackgroundSyncService', () => {
  it('getConfig returns defaults when no stored config', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const config = await getConfig();
    expect(config.minimumIntervalSec).toBe(900);
    expect(config.wifiOnly).toBe(false);
    expect(config.minBatteryLevel).toBe(0.15);
    expect(config.maxMutationsPerCycle).toBe(20);
  });

  it('updateConfig persists and returns merged config', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    const config = await updateConfig({ wifiOnly: true, minimumIntervalSec: 1800 });
    expect(config.wifiOnly).toBe(true);
    expect(config.minimumIntervalSec).toBe(1800);
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('executeSync updates store state', async () => {
    // Empty queue
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const result = await executeSync(true);

    expect(result.completedAt).toBeDefined();
    expect(result.mutationsSynced).toBe(0);

    const state = useBackgroundSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncAt).toBeDefined();
  });

  it('executeSync skips when already syncing', async () => {
    useBackgroundSyncStore.getState().setSyncing(true);

    const result = await executeSync(true);
    expect(result.mutationsSynced).toBe(0);
    expect(result.dataRefreshed).toBe(false);
  });

  it('defineBackgroundSyncTask calls TaskManager.defineTask', async () => {
    const TaskManager = require('expo-task-manager');
    await defineBackgroundSyncTask();
    expect(TaskManager.defineTask).toHaveBeenCalledWith(
      'VINESIGHT_BACKGROUND_SYNC',
      expect.any(Function),
    );
  });

  it('registerBackgroundSync registers the task', async () => {
    const BackgroundFetch = require('expo-background-fetch');
    const result = await registerBackgroundSync();
    expect(result).toBe(true);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      'VINESIGHT_BACKGROUND_SYNC',
      expect.objectContaining({
        minimumInterval: 900,
        stopOnTerminate: false,
        startOnBoot: true,
      }),
    );
    expect(useBackgroundSyncStore.getState().isRegistered).toBe(true);
  });

  it('unregisterBackgroundSync unregisters the task', async () => {
    const BackgroundFetch = require('expo-background-fetch');
    useBackgroundSyncStore.getState().setRegistered(true);

    await unregisterBackgroundSync();

    expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(
      'VINESIGHT_BACKGROUND_SYNC',
    );
    expect(useBackgroundSyncStore.getState().isRegistered).toBe(false);
  });

  it('isBackgroundSyncRegistered checks task registration', async () => {
    const TaskManager = require('expo-task-manager');
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);

    const result = await isBackgroundSyncRegistered();
    expect(result).toBe(true);
  });
});
