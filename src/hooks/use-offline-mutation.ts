/**
 * Offline-Capable Mutation Hook
 *
 * Wraps TanStack Query mutations to support offline writes.
 * When online, mutations go directly to Supabase as usual.
 * When offline, mutations are queued in the sync queue and
 * optimistically applied to the local query cache.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnectivityStore } from '@/stores/connectivity-store';
import { syncQueue, type MutationOperation } from '@/services/sync-queue';
import type { TableName } from '@/types/database';

// ============================================================
// MARK: - Types
// ============================================================

interface OfflineMutationConfig<TData, TVariables> {
  /** The Supabase table this mutation targets */
  table: TableName;
  /** The operation type (INSERT, UPDATE, DELETE) */
  operation: MutationOperation;
  /** The online mutation function (called when connected) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /**
   * Extract the data payload to queue for offline sync.
   * Should return the row data for INSERT/UPDATE or undefined for DELETE.
   */
  getQueueData?: (variables: TVariables) => Record<string, unknown> | undefined;
  /**
   * Extract filter conditions for UPDATE/DELETE operations.
   * Should return e.g. { id: 5 }.
   */
  getQueueFilter?: (variables: TVariables) => Record<string, unknown> | undefined;
  /**
   * Query keys to invalidate after a successful mutation.
   */
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
  /**
   * Called on success (both online and offline).
   */
  onSuccess?: (data: TData) => void;
  /**
   * Called on error.
   */
  onError?: (error: Error) => void;
}

// ============================================================
// MARK: - Hook
// ============================================================

/**
 * A mutation hook that automatically queues writes when offline.
 *
 * Usage:
 * ```ts
 * const createFarm = useOfflineMutation({
 *   table: 'farms',
 *   operation: 'INSERT',
 *   mutationFn: async (farm: FarmInsert) => {
 *     const { data, error } = await supabase.from('farms').insert(farm).select().single();
 *     if (error) throw error;
 *     return data;
 *   },
 *   getQueueData: (farm) => ({ ...farm, user_id: userId }),
 *   invalidateKeys: [queryKeys.farms.all],
 * });
 * ```
 */
export function useOfflineMutation<TData, TVariables>(
  config: OfflineMutationConfig<TData, TVariables>,
) {
  const queryClient = useQueryClient();
  const isConnected = useConnectivityStore((s) => s.isConnected);

  const {
    table,
    operation,
    mutationFn,
    getQueueData,
    getQueueFilter,
    invalidateKeys,
    onSuccess,
    onError,
  } = config;

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      // If online, execute the mutation directly
      if (isConnected) {
        return mutationFn(variables);
      }

      // If offline, queue the mutation
      const data = getQueueData?.(variables);
      const filter = getQueueFilter?.(variables);

      await syncQueue.enqueue(table, operation, data, filter);

      if (__DEV__) {
        console.log(`[OfflineMutation] Queued ${operation} on ${table} (offline)`);
      }

      // Return a synthetic response for optimistic updates
      // The actual server response will come when the queue is processed
      return (data ?? {}) as TData;
    },

    onSuccess: (data: TData) => {
      // Invalidate relevant queries
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          void queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }

      onSuccess?.(data);
    },

    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ============================================================
// MARK: - Convenience Helpers
// ============================================================

/**
 * Check if the app is currently online.
 * Useful for conditional logic outside of React components.
 */
export function isOnline(): boolean {
  return useConnectivityStore.getState().isConnected;
}

/**
 * Get the current pending sync count.
 */
export function getPendingSyncCount(): number {
  return useConnectivityStore.getState().pendingCount;
}
