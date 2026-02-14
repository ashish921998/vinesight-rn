/**
 * Data Refresh Service – Prefetches critical data from Supabase and caches
 * it in AsyncStorage so the app has fresh data when the user returns.
 *
 * Phase 7: Background Sync & Periodic Refresh
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================================
// MARK: - Types
// ============================================================

export interface RefreshResult {
  /** Which data sets were refreshed. */
  refreshed: string[];
  /** Which data sets failed to refresh. */
  failed: Array<{ key: string; error: string }>;
  /** ISO timestamp of when the refresh completed. */
  completedAt: string;
}

export interface RefreshConfig {
  /** Minimum interval between refreshes in milliseconds. Default: 15 minutes. */
  minIntervalMs: number;
  /** Which data sets to refresh. Default: all critical sets. */
  dataSets: DataSetKey[];
}

export type DataSetKey = 'farms' | 'tasks' | 'workers' | 'dashboard' | 'weather';

// ============================================================
// MARK: - Constants
// ============================================================

const CACHE_PREFIX = '@vinesight/cache/';
const LAST_REFRESH_KEY = '@vinesight/last-data-refresh';
const DEFAULT_MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const DEFAULT_CONFIG: RefreshConfig = {
  minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
  dataSets: ['farms', 'tasks', 'workers', 'dashboard'],
};

// ============================================================
// MARK: - Data Fetchers
// ============================================================

async function getUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

type DataFetcher = (userId: string) => Promise<unknown>;

const DATA_FETCHERS: Record<DataSetKey, DataFetcher> = {
  farms: async (userId) => {
    const { data, error } = await supabase
      .from('farms')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  tasks: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  workers: async (userId) => {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data;
  },

  dashboard: async (userId) => {
    // Fetch a lightweight summary for the dashboard
    const [farmsResult, tasksResult] = await Promise.all([
      supabase
        .from('farms')
        .select('id, name, crop_type, area_hectares', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('tasks')
        .select('id, status', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'pending'),
    ]);

    return {
      farmCount: farmsResult.count ?? 0,
      pendingTaskCount: tasksResult.count ?? 0,
      fetchedAt: new Date().toISOString(),
    };
  },

  weather: async (_userId) => {
    // Weather data is location-based and may not need user_id.
    // This is a placeholder; the actual implementation would use
    // the weather service with the user's farm locations.
    return { note: 'Weather refresh delegated to weather-service' };
  },
};

// ============================================================
// MARK: - Cache Operations
// ============================================================

/**
 * Store fetched data in AsyncStorage cache.
 */
async function cacheData(key: DataSetKey, data: unknown): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const envelope = {
    data,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(envelope));
}

/**
 * Read cached data from AsyncStorage.
 */
export async function getCachedData<T = unknown>(
  key: DataSetKey,
): Promise<{ data: T; cachedAt: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { data: T; cachedAt: string };
  } catch {
    return null;
  }
}

/**
 * Get the timestamp of the last successful refresh.
 */
export async function getLastRefreshTime(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_REFRESH_KEY);
}

/**
 * Check whether enough time has passed since the last refresh.
 */
export async function shouldRefresh(minIntervalMs = DEFAULT_MIN_INTERVAL_MS): Promise<boolean> {
  const lastRefresh = await getLastRefreshTime();
  if (!lastRefresh) return true;

  const elapsed = Date.now() - new Date(lastRefresh).getTime();
  return elapsed >= minIntervalMs;
}

// ============================================================
// MARK: - Refresh Execution
// ============================================================

/**
 * Refresh all configured data sets from Supabase and cache locally.
 *
 * Skips the refresh if the minimum interval hasn't elapsed (unless `force` is true).
 */
export async function refreshAllData(
  config: Partial<RefreshConfig> = {},
  force = false,
): Promise<RefreshResult> {
  const mergedConfig: RefreshConfig = { ...DEFAULT_CONFIG, ...config };

  if (!force) {
    const ready = await shouldRefresh(mergedConfig.minIntervalMs);
    if (!ready) {
      return {
        refreshed: [],
        failed: [],
        completedAt: new Date().toISOString(),
      };
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      refreshed: [],
      failed: [{ key: 'all', error: 'Supabase not configured' }],
      completedAt: new Date().toISOString(),
    };
  }

  const userId = await getUserId();
  if (!userId) {
    return {
      refreshed: [],
      failed: [{ key: 'all', error: 'User not authenticated' }],
      completedAt: new Date().toISOString(),
    };
  }

  const refreshed: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  // Batch fetch all data sets concurrently
  const results = await Promise.allSettled(
    mergedConfig.dataSets.map(async (key) => {
      const fetcher = DATA_FETCHERS[key];
      if (!fetcher) {
        throw new Error(`No fetcher for data set: ${key}`);
      }
      const data = await fetcher(userId);
      await cacheData(key, data);
      return key;
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      refreshed.push(result.value);
    } else {
      const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failed.push({ key: 'unknown', error: errorMsg });
    }
  }

  // Record the refresh timestamp
  const completedAt = new Date().toISOString();
  await AsyncStorage.setItem(LAST_REFRESH_KEY, completedAt);

  if (__DEV__) {
    console.log(
      `[DataRefresh] Refreshed: ${refreshed.join(', ')}. Failed: ${failed.length}. At: ${completedAt}`,
    );
  }

  return { refreshed, failed, completedAt };
}

/**
 * Clear all cached data (e.g. on logout).
 */
export async function clearAllCachedData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
  await AsyncStorage.removeItem(LAST_REFRESH_KEY);
}
