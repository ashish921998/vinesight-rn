/**
 * useOfflineMutation
 * A hook that wraps TanStack Query mutations with offline queue support.
 * When offline, mutations are queued and retried when connectivity returns.
 * Supports optimistic updates.
 */

import { useMutation, useQueryClient, type UseMutationOptions, type QueryKey } from '@tanstack/react-query';
import { useIsOnline, offlineQueue, syncEngine } from '@/services/offline';
import type { QueuedMutation } from '@/services/offline';

// ============================================================
// MARK: - Types
// ============================================================

interface OfflineMutationConfig {
  /** Supabase table name for offline queue */
  table: string;
  /** Operation type */
  operation: QueuedMutation['operation'];
  /** Entity type for sync tracking */
  entityType?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: QueryKey[];
  /** Whether to support optimistic updates */
  optimistic?: boolean;
}

// ============================================================
// MARK: - Hook
// ============================================================

/**
 * Wraps a mutation with offline queue support.
 *
 * When online: executes the mutation normally.
 * When offline: queues the mutation for later retry.
 *
 * Usage:
 * ```ts
 * const mutation = useOfflineMutation(
 *   async (data) => {
 *     const { error } = await supabase.from('farms').insert(data);
 *     if (error) throw error;
 *   },
 *   {
 *     table: 'farms',
 *     operation: 'insert',
 *     entityType: 'farms',
 *     invalidateKeys: [queryKeys.farms.all],
 *   }
 * );
 * ```
 */
export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  offlineConfig: OfflineMutationConfig,
  mutationOptions?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (isOnline) {
        // Online: execute normally
        const result = await mutationFn(variables);

        // Mark entity as synced
        if (offlineConfig.entityType) {
          const entityId = (variables as Record<string, unknown>)?.id ?? 'new';
          syncEngine.markSynced(offlineConfig.entityType, String(entityId));
        }

        return result;
      }

      // Offline: queue the mutation
      const payload =
        typeof variables === 'object' && variables !== null
          ? (variables as Record<string, unknown>)
          : { data: variables };

      const entityId = payload.id ?? `temp-${Date.now()}`;

      await offlineQueue.enqueue({
        table: offlineConfig.table,
        operation: offlineConfig.operation,
        payload,
        entityType: offlineConfig.entityType,
        entityId: String(entityId),
      });

      // Mark entity as pending sync
      if (offlineConfig.entityType) {
        syncEngine.markPending(offlineConfig.entityType, String(entityId));
      }

      // Return the variables as optimistic data
      return variables as unknown as TData;
    },
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      // Invalidate related queries
      if (offlineConfig.invalidateKeys) {
        for (const key of offlineConfig.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }

      mutationOptions?.onSuccess?.(data, variables, context);
    },
  });
}

export default useOfflineMutation;
