/**
 * Factory for the activity-log write hooks.
 *
 * The five surrogate-keyed event tables (irrigation/spray/fertigation/harvest/
 * expense) had three near-identical create/update/delete hooks each — 15 hand-
 * copied functions. This collapses them into one generator so the offline-safe
 * data path (idempotent create on `client_uuid`, edit/delete addressed by `id`
 * OR `client_uuid`) is written and tested once, then stamped out per type.
 *
 * Behaviour is a parity-preserving swap of the previous hooks: same call
 * signatures, same `onSuccess` invalidations. The only change is that creates
 * now carry a `client_uuid` and insert idempotently (`ON CONFLICT DO NOTHING`),
 * which is invisible online (a fresh uuid never conflicts) and becomes the
 * idempotency guarantee once the offline queue can replay. Optimistic `onMutate`
 * is intentionally NOT added here yet — it lands with `onlineManager` so online
 * UX is unchanged until offline pausing exists.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/query-keys';
import { resolveOrCreateSeasonIdForDate } from '@/lib/season-context';
import { idempotentCreate, targetedUpdate, targetedDelete, type RecordRef } from './record-writes';
import { newClientUuid } from './client-id';

interface RecordQueryKeys {
  lists: () => readonly unknown[];
  listByFarm: (farmId: number) => readonly unknown[];
}

export interface RecordWriteHooksConfig {
  /** Supabase table name. */
  table: string;
  /** The record type's query-key bundle (extra members beyond these are ignored). */
  keys: RecordQueryKeys;
  /**
   * Mirror the prior per-type `onSuccess`: irrigation also invalidated the
   * cross-farm `lists()` key on create. The other four did not.
   */
  invalidateListsOnCreate?: boolean;
}

/** Minimum shape a row needs for cache invalidation after a write. */
interface RowWithFarm {
  farm_id: number;
}

/** Minimum shape an insert needs to resolve a season before writing. */
interface InsertWithDate {
  farm_id: number;
  date: string;
  client_uuid?: string | null;
  season_id?: number | null;
}

export function makeRecordWriteHooks<TRow extends RowWithFarm, TInsert extends InsertWithDate>(
  config: RecordWriteHooksConfig,
) {
  const { table, keys, invalidateListsOnCreate } = config;

  function useCreate() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
      mutationFn: async (record: TInsert): Promise<TRow> => {
        const season_id =
          record.season_id ??
          (await resolveOrCreateSeasonIdForDate({ farmId: record.farm_id, date: record.date }));
        // client_uuid was stamped into the variables at capture (below);
        // idempotentCreate generates one only as a last resort.
        const row = await idempotentCreate(table, { ...record, season_id });
        return row as TRow;
      },
      onSuccess: (row) => {
        queryClient.invalidateQueries({ queryKey: keys.listByFarm(row.farm_id) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.reports.unassignedRecordCount(row.farm_id),
        });
        if (invalidateListsOnCreate) {
          queryClient.invalidateQueries({ queryKey: keys.lists() });
        }
      },
    });

    // Stamp client_uuid into the mutation VARIABLES at capture, not inside
    // mutationFn: variables are what TanStack persists, so a paused mutation
    // rehydrated after relaunch replays with the SAME identity instead of
    // minting a fresh uuid (which would duplicate the row).
    const stamp = (record: TInsert): TInsert =>
      record.client_uuid != null ? record : { ...record, client_uuid: newClientUuid() };

    return {
      ...mutation,
      mutate: (record: TInsert, options?: Parameters<typeof mutation.mutate>[1]) =>
        mutation.mutate(stamp(record), options),
      mutateAsync: (record: TInsert, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
        mutation.mutateAsync(stamp(record), options),
    };
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        id,
        clientUuid,
        farmId,
        updates,
      }: RecordRef & {
        updates: Partial<TRow>;
      }): Promise<TRow> => {
        const row = await targetedUpdate(
          table,
          { id, clientUuid, farmId },
          updates as Record<string, unknown>,
        );
        return row as TRow;
      },
      onSuccess: (row) => {
        queryClient.invalidateQueries({ queryKey: keys.listByFarm(row.farm_id) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.reports.unassignedRecordCount(row.farm_id),
        });
      },
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        id,
        clientUuid,
        farmId,
      }: RecordRef & { farmId: number }): Promise<void> => {
        await targetedDelete(table, { id, clientUuid, farmId });
      },
      onSuccess: (_result, { farmId }) => {
        queryClient.invalidateQueries({ queryKey: keys.listByFarm(farmId) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.reports.unassignedRecordCount(farmId),
        });
      },
    });
  }

  return { useCreate, useUpdate, useDelete };
}
