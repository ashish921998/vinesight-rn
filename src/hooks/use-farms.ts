/**
 * Farms Hook
 * React Query hooks for farm CRUD operations
 * Mirrors iOS SupabaseDataService.swift farms methods
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDataAccess } from '@/data-access';
import { queryKeys } from './query-keys';
import type { Farm, FarmInsert, FarmSeason, FarmUpdate } from '../types';
import { TABLES, toSupabaseTimestampString } from '../types';
import { formatLocalDate } from '../utils/date';

// ============================================================
// MARK: - Helper to get current user ID
// ============================================================

async function getUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await getDataAccess().auth.getSession();
  if (error || !session) {
    throw new Error('Please sign in to continue');
  }
  return session.user.id;
}

function isRpcFunctionMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  return typeof error.message === 'string' && /function .* does not exist/i.test(error.message);
}

function isMissingDisplayOrderColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === '42703' ||
    /column ["']?display_order["']? does not exist/i.test(message) ||
    /could not find .*display_order.* schema cache/i.test(message)
  );
}

function isUniqueDisplayOrderViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === '23505' &&
    (/farms_user_display_order_unique/i.test(message) || /display_order/i.test(message))
  );
}

async function resolveNextFarmDisplayOrder(userId: string): Promise<{
  supportsDisplayOrder: boolean;
  displayOrder: number;
}> {
  const { data: firstFarm, error: firstFarmError } = await getDataAccess()
    .from(TABLES.FARMS)
    .select('display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (firstFarmError && !isMissingDisplayOrderColumn(firstFarmError)) {
    throw firstFarmError;
  }

  const supportsDisplayOrder = !isMissingDisplayOrderColumn(firstFarmError);
  const displayOrder =
    supportsDisplayOrder && typeof firstFarm?.display_order === 'number'
      ? firstFarm.display_order - 1
      : 0;

  return { supportsDisplayOrder, displayOrder };
}

/**
 * A newly created farm should only auto-start its first season when the farmer
 * supplied a pruning date to anchor it to. Without one, the create flow prompts
 * the farmer to pick a start date instead of silently defaulting to "today".
 */
export function shouldAutoStartInitialSeason(farm: Pick<Farm, 'date_of_pruning'>): boolean {
  return Boolean(farm.date_of_pruning);
}

export async function ensureInitialFarmSeason(
  farm: Farm,
  userId: string,
  seasonNameOverride?: string,
): Promise<void> {
  if (typeof farm.id !== 'number') return;

  // Only bootstrap a season for farms with no season history at all. A farm
  // that is *between* seasons (only ended seasons) must not get a new season
  // auto-started here: the start date below would come from the previous
  // cycle's pruning date and overlap the ended seasons, silently re-capturing
  // historical records. Between-seasons records stay unassigned instead.
  const { data: existingSeason, error: existingSeasonError } = await getDataAccess()
    .from(TABLES.FARM_SEASONS)
    .select('id')
    .eq('farm_id', farm.id)
    .limit(1)
    .maybeSingle();

  if (existingSeasonError) {
    if (existingSeasonError.code === '42P01') return;
    throw existingSeasonError;
  }
  if (existingSeason?.id) return;

  const startDate = farm.date_of_pruning ?? formatLocalDate(new Date());
  const seasonName = seasonNameOverride ?? `Season ${new Date().getFullYear()}`;

  const { error: rpcError } = await getDataAccess().rpc('start_farm_season', {
    p_farm_id: farm.id,
    p_start_date: startDate,
    p_template_key: null,
    p_config_json: null,
    p_season_name: seasonName,
  });

  if (!rpcError) return;
  if (!isRpcFunctionMissing(rpcError)) {
    throw rpcError;
  }

  const { error: insertError } = await getDataAccess()
    .from(TABLES.FARM_SEASONS)
    .insert({
      farm_id: farm.id,
      user_id: userId,
      start_date: startDate,
      end_date: null,
      season_name: seasonName,
      crop_type_snapshot: farm.crop,
    } satisfies Omit<FarmSeason, 'id' | 'created_at' | 'updated_at'>);

  if (insertError) {
    if (insertError.code === '42P01') return;
    // A concurrent create or DB trigger may have created the active season after our check.
    if (insertError.code === '23505') return;
    throw insertError;
  }
}

export async function ensureInitialFarmSeasonForFarmId(
  farmId: number,
  seasonNameOverride?: string,
): Promise<void> {
  const userId = await getUserId();
  const { data: farm, error } = await getDataAccess()
    .from(TABLES.FARMS)
    .select('*')
    .eq('id', farmId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  await ensureInitialFarmSeason(farm, userId, seasonNameOverride);
}

// ============================================================
// MARK: - Fetch Farms Query
// ============================================================

/**
 * Fetch all farms for the current user
 */
export function useFarms() {
  return useQuery({
    queryKey: queryKeys.farms.lists(),
    queryFn: async (): Promise<Farm[]> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.FARMS)
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (isMissingDisplayOrderColumn(error)) {
        const { data: fallbackData, error: fallbackError } = await getDataAccess()
          .from(TABLES.FARMS)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        return fallbackData ?? [];
      }

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Fetch a single farm by ID
 */
export function useFarm(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.farms.detail(id!),
    queryFn: async (): Promise<Farm> => {
      const userId = await getUserId();
      const { data, error } = await getDataAccess()
        .from(TABLES.FARMS)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !isNaN(id),
  });
}

// ============================================================
// MARK: - Create Farm Mutation
// ============================================================

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (farm: FarmInsert): Promise<Farm> => {
      const userId = await getUserId();
      let data: Farm | null = null;
      let lastError: { code?: string; message?: string } | null = null;
      const { display_order: _ignoredDisplayOrder, ...farmPayload } = farm;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { supportsDisplayOrder, displayOrder } = await resolveNextFarmDisplayOrder(userId);
        const insertPayload = supportsDisplayOrder
          ? { ...farmPayload, user_id: userId, display_order: displayOrder }
          : { ...farmPayload, user_id: userId };

        const { data: insertedFarm, error } = await getDataAccess()
          .from(TABLES.FARMS)
          .insert(insertPayload)
          .select()
          .single();

        if (!error) {
          data = insertedFarm;
          break;
        }

        lastError = error;
        if (!isUniqueDisplayOrderViolation(error)) {
          throw error;
        }
      }

      if (!data) {
        throw lastError ?? new Error('Failed to create farm');
      }
      // Only auto-start the first season when the farmer supplied a pruning
      // date to anchor it to. Without one, silently defaulting to "today"
      // yields a meaningless start date that mis-buckets records — instead we
      // leave the farm season-less so the create flow can prompt the farmer to
      // pick a start date (see the startSeason redirect in use-farm-form). The
      // lazy resolver's legacy safety net is intentionally left untouched.
      if (shouldAutoStartInitialSeason(data)) {
        const seasonName = t('farms.defaultSeasonName', { year: new Date().getFullYear() });
        try {
          await ensureInitialFarmSeason(data, userId, seasonName);
        } catch (seasonError) {
          console.warn('[useCreateFarm] ensureInitialFarmSeason failed:', seasonError);
        }
      }
      return data;
    },
    onSuccess: (newFarm) => {
      // Add to cache
      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return [newFarm];
        return [newFarm, ...old];
      });
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
      if (typeof newFarm.id === 'number') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmSeasons.listByFarm(newFarm.id),
        });
      }
    },
  });
}

// ============================================================
// MARK: - Reorder Farms Mutation
// ============================================================

export function useReorderFarms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedFarmIds: number[]): Promise<number[]> => {
      const { error } = await getDataAccess().rpc('reorder_farms', {
        p_ordered_farm_ids: orderedFarmIds,
      });

      if (isRpcFunctionMissing(error) || isMissingDisplayOrderColumn(error)) {
        throw new Error('Farm ordering is not available until the latest database migration runs.');
      }
      if (error) throw error;

      return orderedFarmIds;
    },
    onMutate: async (orderedFarmIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.farms.lists() });
      const previousFarms = queryClient.getQueryData<Farm[]>(queryKeys.farms.lists());

      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return old;
        const orderById = new Map(orderedFarmIds.map((id, index) => [id, index]));
        return old
          .map((farm) => ({
            ...farm,
            display_order:
              typeof farm.id === 'number' && orderById.has(farm.id)
                ? orderById.get(farm.id)
                : farm.display_order,
          }))
          .sort((a, b) => {
            const aOrder =
              typeof a.display_order === 'number' ? a.display_order : Number.MAX_SAFE_INTEGER;
            const bOrder =
              typeof b.display_order === 'number' ? b.display_order : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
          });
      });

      return { previousFarms };
    },
    onError: (_error, _orderedFarmIds, context) => {
      if (context?.previousFarms) {
        queryClient.setQueryData(queryKeys.farms.lists(), context.previousFarms);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.lists() });
    },
  });
}

// ============================================================
// MARK: - Update Farm Mutation
// ============================================================

export function useUpdateFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: FarmUpdate }): Promise<Farm> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.FARMS)
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId) // Verify ownership
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedFarm) => {
      // Update in cache
      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return [updatedFarm];
        return old.map((f) => (f.id === updatedFarm.id ? updatedFarm : f));
      });
      // Update detail cache
      if (updatedFarm.id) {
        queryClient.setQueryData(queryKeys.farms.detail(updatedFarm.id), updatedFarm);
      }
    },
  });
}

// ============================================================
// MARK: - Update Farm Water Level Mutation
// ============================================================

export function useUpdateFarmWaterLevel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      farmId,
      remainingWater,
    }: {
      farmId: number;
      remainingWater: number;
    }): Promise<Farm> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.FARMS)
        .update({
          remaining_water: remainingWater,
          water_calculation_updated_at: toSupabaseTimestampString(new Date()),
        })
        .eq('id', farmId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedFarm) => {
      // Update in cache
      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return [updatedFarm];
        return old.map((f) => (f.id === updatedFarm.id ? updatedFarm : f));
      });
      if (updatedFarm.id) {
        queryClient.setQueryData(queryKeys.farms.detail(updatedFarm.id), updatedFarm);
      }
    },
  });
}

// ============================================================
// MARK: - Delete Farm Mutation
// ============================================================

export function useDeleteFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const userId = await getUserId();

      const { error } = await getDataAccess()
        .from(TABLES.FARMS)
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Verify ownership

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return [];
        return old.filter((f) => f.id !== deletedId);
      });
      // Remove detail cache
      queryClient.removeQueries({ queryKey: queryKeys.farms.detail(deletedId) });

      // Invalidate all related queries for the deleted farm
      // Note: Database should have CASCADE DELETE constraints set up
      // to automatically delete associated records (irrigation_records,
      // spray_records, harvest_records, expense_records, etc.)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey[0] === 'irrigationRecords' ||
            queryKey[0] === 'sprayRecords' ||
            queryKey[0] === 'fertigationRecords' ||
            queryKey[0] === 'harvestRecords' ||
            queryKey[0] === 'expenseRecords' ||
            queryKey[0] === 'soilTestRecords' ||
            queryKey[0] === 'petioleTestRecords' ||
            queryKey[0] === 'soilProfiles' ||
            queryKey[0] === 'calculationHistory' ||
            queryKey[0] === 'temporaryWorkerEntries' ||
            queryKey[0] === 'workerAttendance' ||
            queryKey[0] === 'dashboard' ||
            queryKey[0] === 'farmSeasons' ||
            queryKey[0] === 'dailyNotes'
          );
        },
      });
    },
  });
}

// ============================================================
// MARK: - Prefetch Helper
// ============================================================

export function usePrefetchFarm() {
  const queryClient = useQueryClient();

  return (id: number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.farms.detail(id),
      queryFn: async () => {
        const { data, error } = await getDataAccess()
          .from(TABLES.FARMS)
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        return data;
      },
    });
  };
}
