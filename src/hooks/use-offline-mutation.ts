/**
 * Offline Mutation Hook
 * Wraps Supabase mutations to support offline writes with optimistic updates.
 *
 * When online: mutations go directly to Supabase AND update the React Query cache.
 * When offline: mutations are written to the sync queue and the cache is updated optimistically.
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNetworkStore } from '@/stores/network-store';
import { useSyncStore } from '@/stores/sync-store';
import { enqueueMutation } from '@/services/sync-queue-service';
import type { TableName } from '@/types/database';
import type { SyncOperationType } from '@/types/sync';

// ============================================================
// MARK: - Types
// ============================================================

interface OfflineMutationOptions<TData, TVariables> {
  /** The Supabase table name */
  table: TableName;
  /** The operation type */
  operation: SyncOperationType;
  /** The online mutation function (direct Supabase call) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  /** Optimistic update: transform the cache before the mutation completes */
  optimisticUpdate?: (variables: TVariables) => {
    queryKey: QueryKey;
    updater: (old: unknown) => unknown;
  }[];
  /** Extract the record ID from variables (for update/delete) */
  getRecordId?: (variables: TVariables) => number | undefined;
  /** Extract the payload for the sync queue */
  getPayload: (variables: TVariables) => Record<string, unknown>;
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on error */
  onError?: (error: Error, variables: TVariables) => void;
}

// ============================================================
// MARK: - Helper to get user ID
// ============================================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id;
  } catch {
    return undefined;
  }
}

// ============================================================
// MARK: - Hook
// ============================================================

/**
 * A mutation hook that works both online and offline.
 * When offline, mutations are queued and synced when connectivity returns.
 */
export function useOfflineMutation<TData, TVariables>(
  options: OfflineMutationOptions<TData, TVariables>,
) {
  const queryClient = useQueryClient();
  const isConnected = useNetworkStore((s) => s.isConnected);
  const incrementPending = useSyncStore((s) => s.incrementPending);

  return useMutation({
    mutationFn: async (variables: TVariables): Promise<TData | null> => {
      if (isConnected) {
        // Online: execute directly against Supabase
        return options.mutationFn(variables);
      }

      // Offline: enqueue the mutation
      const userId = await getCurrentUserId();
      const payload = options.getPayload(variables);
      const recordId = options.getRecordId?.(variables);

      await enqueueMutation({
        table: options.table,
        operation: options.operation,
        payload,
        recordId,
        userId,
      });

      incrementPending();

      if (__DEV__) {
        console.log(
          `[OfflineMutation] Queued ${options.operation} on ${options.table} (offline)`,
        );
      }

      // Return null for offline mutations (optimistic update handles the UI)
      return null;
    },

    onMutate: async (variables: TVariables) => {
      // Perform optimistic updates
      if (!options.optimisticUpdate) return undefined;

      const updates = options.optimisticUpdate(variables);
      const previousData: { queryKey: QueryKey; data: unknown }[] = [];

      for (const update of updates) {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: update.queryKey });

        // Snapshot previous value
        const previous = queryClient.getQueryData(update.queryKey);
        previousData.push({ queryKey: update.queryKey, data: previous });

        // Optimistically update the cache
        queryClient.setQueryData(update.queryKey, update.updater);
      }

      return { previousData };
    },

    onError: (error, variables, context) => {
      // Rollback optimistic updates on error
      const ctx = context as { previousData?: { queryKey: QueryKey; data: unknown }[] } | undefined;
      if (ctx?.previousData) {
        for (const { queryKey, data } of ctx.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }

      options.onError?.(error as Error, variables);
    },

    onSuccess: (data, variables) => {
      // Invalidate related queries
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }

      if (data !== null) {
        options.onSuccess?.(data, variables);
      }
    },
  });
}
