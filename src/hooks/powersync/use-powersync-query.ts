/**
 * PowerSync ↔ React Query Bridge
 *
 * Provides hooks that execute watched SQL queries against the local
 * PowerSync/SQLite database and keep the TanStack React Query cache
 * in sync. When PowerSync syncs new data from the server, the watched
 * query fires and the React Query cache is automatically updated.
 *
 * On web (where PowerSync is unavailable), transparently falls back
 * to the provided Supabase query function.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { getInstance } from './powersync-instance';

// ============================================================
// MARK: - List Query (multiple rows)
// ============================================================

interface UsePowerSyncReadOptions<T> {
  /** TanStack React Query cache key */
  queryKey: readonly unknown[];
  /** SQL query to run against the local PowerSync SQLite database */
  sql: string;
  /** Bind parameters for the SQL query */
  parameters?: (string | number | null)[];
  /** Transform raw SQLite row objects into the desired application type */
  transform: (rows: Record<string, unknown>[]) => T[];
  /** Fallback query function used on web or when PowerSync is unavailable */
  fallbackQueryFn: () => Promise<T[]>;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Read data from the local PowerSync SQLite database with automatic
 * reactivity — when synced data changes, the React Query cache is
 * invalidated and the UI re-renders with fresh local data.
 *
 * Falls back to Supabase on web where PowerSync is not available.
 */
export function usePowerSyncRead<T>(options: UsePowerSyncReadOptions<T>): UseQueryResult<T[]> {
  const {
    queryKey,
    sql,
    parameters = [],
    transform,
    fallbackQueryFn,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const isPowerSyncAvailable = Platform.OS !== 'web';

  // The query function: read from local SQLite on native, Supabase on web
  const queryFn = useCallback(async (): Promise<T[]> => {
    if (isPowerSyncAvailable) {
      const db = getInstance();
      if (db) {
        const rows = await db.getAll<Record<string, unknown>>(sql, parameters);
        return transform(rows);
      }
    }
    // Fallback to Supabase
    return fallbackQueryFn();
  }, [isPowerSyncAvailable, sql, parameters, transform, fallbackQueryFn]);

  // Set up a PowerSync watched query that invalidates the React Query cache
  // whenever the underlying SQLite data changes (e.g., after a sync).
  useEffect(() => {
    if (!isPowerSyncAvailable || !enabled) return;

    const db = getInstance();
    if (!db) return;

    // Abort any previous watcher
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Watch for changes using the callback overload:
    // watch(sql, parameters, handler, options)
    db.watch(
      sql,
      parameters,
      {
        onResult: () => {
          // Invalidate the React Query cache so it re-fetches from local SQLite
          queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
          if (__DEV__) {
            console.warn('[PowerSync] Watch error for query:', sql, error);
          }
        },
      },
      { signal: controller.signal },
    );

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPowerSyncAvailable, enabled, sql, JSON.stringify(parameters)]);

  return useQuery({
    queryKey,
    queryFn,
    enabled,
    // Local reads are instant — keep data fresh longer since PowerSync
    // watch will invalidate when new data syncs
    ...(isPowerSyncAvailable
      ? {
          staleTime: 1000 * 60 * 10, // 10 minutes (watch handles freshness)
        }
      : {}),
  });
}

// ============================================================
// MARK: - Single Record Query
// ============================================================

interface UsePowerSyncReadOneOptions<T> {
  queryKey: readonly unknown[];
  sql: string;
  parameters?: (string | number | null)[];
  transform: (row: Record<string, unknown>) => T;
  fallbackQueryFn: () => Promise<T | null>;
  enabled?: boolean;
}

/**
 * Variant for single-record queries (e.g., profile, single farm).
 * Returns null if no matching row is found.
 */
export function usePowerSyncReadOne<T>(
  options: UsePowerSyncReadOneOptions<T>,
): UseQueryResult<T | null> {
  const {
    queryKey,
    sql,
    parameters = [],
    transform,
    fallbackQueryFn,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const isPowerSyncAvailable = Platform.OS !== 'web';

  const queryFn = useCallback(async (): Promise<T | null> => {
    if (isPowerSyncAvailable) {
      const db = getInstance();
      if (db) {
        const rows = await db.getAll<Record<string, unknown>>(sql, parameters);
        if (rows.length === 0) return null;
        return transform(rows[0]);
      }
    }
    return fallbackQueryFn();
  }, [isPowerSyncAvailable, sql, parameters, transform, fallbackQueryFn]);

  useEffect(() => {
    if (!isPowerSyncAvailable || !enabled) return;

    const db = getInstance();
    if (!db) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    db.watch(
      sql,
      parameters,
      {
        onResult: () => {
          queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
          if (__DEV__) {
            console.warn('[PowerSync] Watch error for query:', sql, error);
          }
        },
      },
      { signal: controller.signal },
    );

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPowerSyncAvailable, enabled, sql, JSON.stringify(parameters)]);

  return useQuery({
    queryKey,
    queryFn,
    enabled,
    ...(isPowerSyncAvailable
      ? {
          staleTime: 1000 * 60 * 10,
        }
      : {}),
  });
}
