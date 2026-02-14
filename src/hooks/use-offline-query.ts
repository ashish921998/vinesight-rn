/**
 * useOfflineQuery
 * A hook that wraps TanStack Query with offline-first caching.
 * Serves cached data immediately, fetches fresh data when online,
 * and updates the cache transparently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { StorageManager, useIsOnline } from '@/services/offline';
import type { CacheEntry } from '@/services/offline';

// ============================================================
// MARK: - Types
// ============================================================

interface UseOfflineQueryOptions<TData> {
  /** Cache key for offline storage (separate from React Query key) */
  cacheKey: string;
  /** TTL for cached data in milliseconds (default: 24 hours) */
  ttlMs?: number;
  /** Whether to skip the offline cache entirely */
  skipCache?: boolean;
}

interface UseOfflineQueryResult<TData> {
  /** Whether the returned data came from offline cache */
  isFromCache: boolean;
  /** ISO timestamp of when the cached data was stored */
  lastUpdatedAt: string | null;
}

// ============================================================
// MARK: - Hook
// ============================================================

/**
 * Wraps a standard TanStack Query with offline-first caching.
 *
 * Usage:
 * ```ts
 * const { data, isLoading, offline } = useOfflineQuery(
 *   queryKeys.farms.lists(),
 *   fetchFarms,
 *   { cacheKey: 'farms-list', ttlMs: 60 * 60 * 1000 }
 * );
 * ```
 */
export function useOfflineQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  offlineOptions: UseOfflineQueryOptions<TData>,
  queryOptions?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>,
) {
  const { cacheKey, ttlMs = 24 * 60 * 60 * 1000, skipCache = false } = offlineOptions;
  const isOnline = useIsOnline();

  const [cachedData, setCachedData] = useState<TData | undefined>(undefined);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const cacheLoaded = useRef(false);

  // Load cached data on mount
  useEffect(() => {
    if (skipCache || cacheLoaded.current) return;

    let cancelled = false;

    const loadCache = async () => {
      try {
        const entry = await StorageManager.getEntry<TData>(cacheKey);
        if (entry && !cancelled) {
          setCachedData(entry.data);
          setLastUpdatedAt(entry.storedAt);
          setIsFromCache(true);
        }
      } catch {
        // Cache miss is fine
      } finally {
        cacheLoaded.current = true;
      }
    };

    loadCache();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, skipCache]);

  // The actual query - disabled when offline (will use cache)
  const query = useQuery<TData, Error, TData, QueryKey>({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();

      // Update cache with fresh data
      if (!skipCache) {
        StorageManager.set(cacheKey, data, ttlMs).catch(() => {});
        setLastUpdatedAt(new Date().toISOString());
        setIsFromCache(false);
      }

      return data;
    },
    ...queryOptions,
    // When offline, don't retry and use longer stale time
    enabled: (queryOptions?.enabled ?? true) && isOnline,
    retry: isOnline ? (queryOptions?.retry ?? 2) : false,
    staleTime: isOnline ? queryOptions?.staleTime : Infinity,
  });

  // Use cached data as fallback when query has no data
  const data = query.data ?? cachedData;
  const isLoading = query.isLoading && !cachedData;

  const offline: UseOfflineQueryResult<TData> = {
    isFromCache: isFromCache && !query.data,
    lastUpdatedAt,
  };

  return {
    ...query,
    data,
    isLoading,
    offline,
  };
}

export default useOfflineQuery;
