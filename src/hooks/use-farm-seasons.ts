import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDataAccess } from '@/data-access';
import { queryKeys } from './query-keys';
import { taskQueryKeys } from './use-tasks';
import type { FarmSeason, FarmSeasonInsert, FarmSeasonUpdate } from '../types';
import { TABLES } from '../types';
import { parseDbDateToLocalDate } from '../utils/date';
import { recomputeSeasonAssignmentsClient, invalidateSeasonIdCache } from '../lib/season-context';

function isRpcFunctionMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  return typeof error.message === 'string' && /function .* does not exist/i.test(error.message);
}

/**
 * A season-start recompute call can fail outright (network/RPC error) without
 * ever reaching the server-side logic that flags ambiguous assignments in
 * `season_inference_audit` — so `needsSeasonReview` alone can't surface it.
 *
 * The durable copy of this client-only signal lives in its own AsyncStorage
 * key, NOT the persisted query cache: the cache has a 24h maxAge/gcTime, so a
 * flag stored only there silently evaporates while the affected records can
 * still be sitting at season_id null. The query below reads storage directly
 * (so a cold start doesn't depend on cache rehydration either) and the two
 * mutation writers keep storage and cache in sync — setRecomputeRetryFlag is
 * the only writer. Kept off the `farmSeasons.*` key hierarchy so unrelated
 * season invalidations don't wipe the in-memory copy.
 */
function recomputeRetryQueryKey(farmId: number) {
  return ['farm-season-recompute-retry', farmId] as const;
}

function recomputeRetryStorageKey(farmId: number): string {
  return `VINESIGHT_SEASON_RECOMPUTE_RETRY_${farmId}`;
}

async function readRecomputeRetryFlag(farmId: number): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(recomputeRetryStorageKey(farmId))) === '1';
  } catch {
    return false;
  }
}

function setRecomputeRetryFlag(
  queryClient: ReturnType<typeof useQueryClient>,
  farmId: number,
  value: boolean,
): void {
  queryClient.setQueryData(recomputeRetryQueryKey(farmId), value);
  // Fire-and-forget: the in-memory cache above is already correct for this
  // session; storage failure only costs cross-restart durability.
  const write = value
    ? AsyncStorage.setItem(recomputeRetryStorageKey(farmId), '1')
    : AsyncStorage.removeItem(recomputeRetryStorageKey(farmId));
  write.catch((error) => {
    console.warn('[farm-seasons] failed to persist recompute-retry flag:', error);
  });
}

async function recomputeSeasonAssignments(farmId: number): Promise<void> {
  const { error } = await getDataAccess().rpc('recompute_farm_season_assignments', {
    p_farm_id: farmId,
  });
  if (error) {
    if (isRpcFunctionMissing(error)) {
      await recomputeSeasonAssignmentsClient(farmId);
      return;
    }
    throw error;
  }
}

/**
 * Season windows changed — every record query for the farm may now carry a
 * different season_id. Shared by the start/end/recompute mutations. Must
 * cover every table recomputeSeasonAssignmentsClient touches (season-context.ts)
 * — daily notes and task reminders included, not just the five "record" hooks.
 */
function invalidateSeasonScopedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  farmId: number,
): void {
  invalidateSeasonIdCache(farmId);
  queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.sprayRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.fertigationRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.harvestRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.dailyNotes.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.soilTestRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.petioleTestRecords.listByFarm(farmId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.soilProfiles.listByFarm(farmId) });
  queryClient.invalidateQueries({
    queryKey: queryKeys.temporaryWorkerEntries.listByFarm(farmId),
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.unassignedRecordCount(farmId) });
  // Tasks use their own query-key namespace (use-tasks.ts), not the shared
  // queryKeys object — invalidate broadly since it isn't farm-scoped there.
  queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
}

function sortFarmSeasonsByEndDate(items: FarmSeason[]) {
  const next = [...items];
  next.sort((a, b) => {
    if (!a.end_date && !b.end_date) return 0;
    if (!a.end_date) return 1;
    if (!b.end_date) return -1;
    const aDate = parseDbDateToLocalDate(a.end_date);
    const bDate = parseDbDateToLocalDate(b.end_date);
    if (!aDate || !bDate) return 0;
    return aDate.getTime() - bDate.getTime();
  });
  return next;
}

export function useFarmSeasons(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.farmSeasons.listByFarm(farmId ?? -1),
    queryFn: async (): Promise<FarmSeason[]> => {
      if (!farmId) return [];
      const { data, error } = await getDataAccess()
        .from(TABLES.FARM_SEASONS)
        .select('*')
        .eq('farm_id', farmId);

      if (error) {
        // Allow gradual rollout if migration isn't applied yet.
        if ('code' in error && error.code === '42P01') return [];
        throw error;
      }
      return sortFarmSeasonsByEndDate(data ?? []);
    },
    enabled: !!farmId && !Number.isNaN(farmId),
  });
}

export function useCreateFarmSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (season: FarmSeasonInsert): Promise<FarmSeason> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.FARM_SEASONS)
        .insert(season)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newSeason) => {
      invalidateSeasonIdCache(newSeason.farm_id);
      queryClient.setQueryData<FarmSeason[]>(
        queryKeys.farmSeasons.listByFarm(newSeason.farm_id),
        (old) => {
          if (!old) return [newSeason];
          return sortFarmSeasonsByEndDate([...old, newSeason]);
        },
      );
    },
  });
}

export function useUpdateFarmSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      farmId,
      updates,
    }: {
      id: number;
      farmId: number;
      updates: FarmSeasonUpdate;
    }): Promise<FarmSeason> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.FARM_SEASONS)
        .update(updates)
        .eq('id', id)
        .eq('farm_id', farmId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedSeason) => {
      invalidateSeasonIdCache(updatedSeason.farm_id);
      queryClient.setQueryData<FarmSeason[]>(
        queryKeys.farmSeasons.listByFarm(updatedSeason.farm_id),
        (old) => {
          if (!old) return [updatedSeason];
          const next = old.map((season) =>
            season.id === updatedSeason.id ? updatedSeason : season,
          );
          return sortFarmSeasonsByEndDate(next);
        },
      );
    },
  });
}

export function useUpdateFarmSeasonTargetHarvestDate() {
  const updateSeason = useUpdateFarmSeason();

  interface UpdateFarmSeasonTargetArgs {
    id: number;
    farmId: number;
    targetHarvestDate: string | null;
  }

  return useMutation({
    mutationFn: async ({ id, farmId, targetHarvestDate }: UpdateFarmSeasonTargetArgs) =>
      updateSeason.mutateAsync({
        id,
        farmId,
        updates: { target_harvest_date: targetHarvestDate },
      }),
  });
}

export function useStartFarmSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      farmId,
      startDate,
      seasonName,
      cropTypeSnapshot,
      templateKey,
      templateVersion,
      configJson,
    }: {
      farmId: number;
      startDate: string;
      seasonName?: string | null;
      cropTypeSnapshot?: string | null;
      templateKey?: string | null;
      templateVersion?: number | null;
      configJson?: Record<string, unknown> | null;
    }): Promise<FarmSeason & { recomputeFailed: boolean }> => {
      const startSeason = async (): Promise<FarmSeason> => {
        const { data: rpcData, error: rpcError } = await getDataAccess().rpc('start_farm_season', {
          p_farm_id: farmId,
          p_start_date: startDate,
          p_template_key: templateKey ?? null,
          p_config_json: configJson ?? null,
          p_season_name: seasonName ?? null,
        });

        if (!rpcError) {
          if (rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
            return rpcData as FarmSeason;
          }
          // Fallback refetch path if rpc returns scalar/void.
          const { data: latest, error: latestError } = await getDataAccess()
            .from(TABLES.FARM_SEASONS)
            .select('*')
            .eq('farm_id', farmId)
            .is('end_date', null)
            .order('start_date', { ascending: false })
            .limit(1)
            .single();
          if (latestError) throw latestError;
          return latest;
        }
        if (!isRpcFunctionMissing(rpcError)) {
          throw rpcError;
        }

        const { data, error } = await getDataAccess()
          .from(TABLES.FARM_SEASONS)
          .insert({
            farm_id: farmId,
            start_date: startDate,
            end_date: null,
            season_name: seasonName ?? null,
            crop_type_snapshot: cropTypeSnapshot ?? null,
            template_key: templateKey ?? null,
            template_version: templateVersion ?? null,
            config_json: configJson ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      };

      const season = await startSeason();

      // A backdated start can cover records logged while the farm was between
      // seasons (season_id null) — re-bucket them now instead of waiting for
      // the season to end. The season itself has already started successfully
      // by this point, so a recompute failure doesn't fail the mutation — but
      // it must not be swallowed either, or records can stay silently
      // unassigned with no indication anything went wrong. Callers surface
      // `recomputeFailed` to the user (see handleStartSeason in farm/[id].tsx)
      // instead of treating this like a fully successful start.
      let recomputeFailed = false;
      try {
        await recomputeSeasonAssignments(farmId);
      } catch (error) {
        console.warn('[farm-seasons] recompute after season start failed:', error);
        recomputeFailed = true;
      }

      return { ...season, recomputeFailed };
    },
    onSuccess: (newSeason) => {
      invalidateSeasonScopedQueries(queryClient, newSeason.farm_id);
      if (newSeason.recomputeFailed) {
        setRecomputeRetryFlag(queryClient, newSeason.farm_id, true);
      }
    },
  });
}

export function useEndFarmSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      farmId,
      endDate,
    }: {
      farmId: number;
      endDate: string;
    }): Promise<FarmSeason> => {
      const { data: rpcData, error: rpcError } = await getDataAccess().rpc('end_farm_season', {
        p_farm_id: farmId,
        p_end_date: endDate,
      });

      if (!rpcError) {
        if (rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
          return rpcData as FarmSeason;
        }
        const { data: latestEnded, error: latestEndedError } = await getDataAccess()
          .from(TABLES.FARM_SEASONS)
          .select('*')
          .eq('farm_id', farmId)
          .eq('end_date', endDate)
          .order('id', { ascending: false })
          .limit(1)
          .single();
        if (latestEndedError) throw latestEndedError;
        return latestEnded;
      }
      if (!isRpcFunctionMissing(rpcError)) {
        throw rpcError;
      }

      const { data: activeSeason, error: activeSeasonError } = await getDataAccess()
        .from(TABLES.FARM_SEASONS)
        .select('*')
        .eq('farm_id', farmId)
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();
      if (activeSeasonError) throw activeSeasonError;

      const { data, error } = await getDataAccess()
        .from(TABLES.FARM_SEASONS)
        .update({ end_date: endDate })
        .eq('id', activeSeason.id)
        .eq('farm_id', farmId)
        .select()
        .single();
      if (error) throw error;

      // Keep beta environments functional even before recompute RPC is deployed.
      await recomputeSeasonAssignmentsClient(farmId);
      return data;
    },
    onSuccess: (endedSeason) => {
      invalidateSeasonScopedQueries(queryClient, endedSeason.farm_id);
    },
  });
}

export function useRecomputeFarmSeasonAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ farmId }: { farmId: number }): Promise<void> => {
      await recomputeSeasonAssignments(farmId);
    },
    onSuccess: (_, { farmId }) => {
      invalidateSeasonScopedQueries(queryClient, farmId);
      setRecomputeRetryFlag(queryClient, farmId, false);
    },
  });
}

export function useFarmSeasonStatus(farmId: number | undefined) {
  const seasonsQuery = useFarmSeasons(farmId);
  const reviewQuery = useQuery({
    queryKey: [...queryKeys.farmSeasons.listByFarm(farmId ?? -1), 'reviewStatus'],
    queryFn: async (): Promise<boolean> => {
      if (!farmId) return false;
      const { data, error } = await getDataAccess()
        .from('season_inference_audit')
        .select('status')
        .eq('farm_id', farmId)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01') return false;
        throw error;
      }
      return data?.status === 'needs_review';
    },
    enabled: !!farmId && !Number.isNaN(farmId),
  });
  // Client-only fallback for a recompute that failed outright (network/RPC
  // error) rather than completing and flagging ambiguity server-side — see
  // recomputeRetryQueryKey. The queryFn reads the durable AsyncStorage copy,
  // so the flag survives query-cache eviction (24h maxAge) and doesn't depend
  // on cache rehydration timing at cold start. staleTime: 0 so every mount
  // re-reads storage (a cheap local read) — a rehydrated cache entry from a
  // previous session must not mask a storage write the persister's throttle
  // window dropped.
  const recomputeRetryQuery = useQuery({
    queryKey: recomputeRetryQueryKey(farmId ?? -1),
    queryFn: () => readRecomputeRetryFlag(farmId ?? -1),
    enabled: !!farmId && !Number.isNaN(farmId),
    staleTime: 0,
  });

  const seasons = seasonsQuery.data ?? [];
  const activeSeason = seasons.find((season) => season.end_date === null) ?? null;
  const ended = seasons.filter((season) => season.end_date !== null);
  const lastEndedSeason = ended.length > 0 ? ended[ended.length - 1] : null;

  return {
    activeSeason,
    hasActiveSeason: activeSeason !== null,
    lastEndedSeason,
    needsReview: (reviewQuery.data ?? false) || (recomputeRetryQuery.data ?? false),
    isLoading: seasonsQuery.isLoading || reviewQuery.isLoading,
    // True only once the seasons lookup has settled successfully. Consumers
    // that hard-block on "no active season" must gate on this rather than
    // `!isLoading && !activeSeason`: a failed query also leaves activeSeason
    // null with isLoading false, which would otherwise falsely block a farm
    // that does have a season.
    hasResolvedSeasons: seasonsQuery.isSuccess,
    refetch: async () => {
      await Promise.all([
        seasonsQuery.refetch(),
        reviewQuery.refetch(),
        recomputeRetryQuery.refetch(),
      ]);
    },
  };
}
