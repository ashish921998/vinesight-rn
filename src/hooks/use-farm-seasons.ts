/**
 * Farm Seasons Hooks
 *
 * READ operations delegate to offline hooks (use-offline-farm-seasons.ts)
 * which use PowerSync local SQLite reads with Supabase fallback.
 *
 * WRITE operations (Phase 3) now go through PowerSync local DB when
 * available, falling back to direct Supabase writes otherwise.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
import type { FarmSeason, FarmSeasonInsert, FarmSeasonUpdate } from '../types';
import { TABLES } from '../types';
import { parseDbDateToLocalDate } from '../utils/date';
import { recomputeSeasonAssignmentsClient } from '../lib/season-context';
import { useOfflineFarmSeasons } from './use-offline-farm-seasons';
import {
  useOfflineCreateFarmSeason,
  useOfflineUpdateFarmSeason,
} from './use-offline-mutations';

function isRpcFunctionMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  return typeof error.message === 'string' && /function .* does not exist/i.test(error.message);
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

/**
 * Fetch all seasons for a given farm.
 * Now uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useFarmSeasons(farmId: number | undefined) {
  return useOfflineFarmSeasons(farmId);
}

export function useCreateFarmSeason() {
  const queryClient = useQueryClient();
  const offlineCreate = useOfflineCreateFarmSeason();

  return useMutation({
    mutationFn: async (season: FarmSeasonInsert): Promise<FarmSeason> => {
      return offlineCreate.mutateAsync(season);
    },
    onSuccess: (newSeason) => {
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
  const offlineUpdate = useOfflineUpdateFarmSeason();

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
      return offlineUpdate.mutateAsync({ id, farmId, updates });
    },
    onSuccess: (updatedSeason) => {
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
    }): Promise<FarmSeason> => {
      const { data: rpcData, error: rpcError } = await supabase.rpc('start_farm_season', {
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
        const { data: latest, error: latestError } = await supabase
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

      const { data, error } = await supabase
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
    },
    onSuccess: (newSeason) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmSeasons.listByFarm(newSeason.farm_id),
      });
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
      const { data: rpcData, error: rpcError } = await supabase.rpc('end_farm_season', {
        p_farm_id: farmId,
        p_end_date: endDate,
      });

      if (!rpcError) {
        if (rpcData && typeof rpcData === 'object' && 'id' in rpcData) {
          return rpcData as FarmSeason;
        }
        const { data: latestEnded, error: latestEndedError } = await supabase
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

      const { data: activeSeason, error: activeSeasonError } = await supabase
        .from(TABLES.FARM_SEASONS)
        .select('*')
        .eq('farm_id', farmId)
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();
      if (activeSeasonError) throw activeSeasonError;

      const { data, error } = await supabase
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmSeasons.listByFarm(endedSeason.farm_id),
      });
    },
  });
}

export function useRecomputeFarmSeasonAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ farmId }: { farmId: number }): Promise<void> => {
      const { error } = await supabase.rpc('recompute_farm_season_assignments', {
        p_farm_id: farmId,
      });
      if (error) {
        if (error.code === '42883') {
          await recomputeSeasonAssignmentsClient(farmId);
          return;
        }
        throw error;
      }
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farmSeasons.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sprayRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.fertigationRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.harvestRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.soilTestRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.petioleTestRecords.listByFarm(farmId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.soilProfiles.listByFarm(farmId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.listByFarm(farmId),
      });
    },
  });
}

export function useFarmSeasonStatus(farmId: number | undefined) {
  const seasonsQuery = useFarmSeasons(farmId);
  const reviewQuery = useQuery({
    queryKey: [...queryKeys.farmSeasons.listByFarm(farmId ?? -1), 'reviewStatus'],
    queryFn: async (): Promise<boolean> => {
      if (!farmId) return false;
      const { data, error } = await supabase
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

  const seasons = seasonsQuery.data ?? [];
  const activeSeason = seasons.find((season) => season.end_date === null) ?? null;
  const ended = seasons.filter((season) => season.end_date !== null);
  const lastEndedSeason = ended.length > 0 ? ended[ended.length - 1] : null;

  return {
    activeSeason,
    hasActiveSeason: activeSeason !== null,
    lastEndedSeason,
    needsReview: reviewQuery.data ?? false,
    isLoading: seasonsQuery.isLoading || reviewQuery.isLoading,
    refetch: async () => {
      await Promise.all([seasonsQuery.refetch(), reviewQuery.refetch()]);
    },
  };
}
