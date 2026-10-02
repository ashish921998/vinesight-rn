/**
 * Farms Hook
 * React Query hooks for farm CRUD operations
 * Mirrors iOS SupabaseDataService.swift farms methods
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDataAccess, isMissingDisplayOrderColumnError } from '@/data-access';
import { queryKeys } from './query-keys';
import type { Farm, FarmInsert, FarmSeason, FarmUpdate } from '../types';
import { toSupabaseTimestampString } from '../types';
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
  return (await getDataAccess().farms.getNextDisplayOrder(userId)) as {
    supportsDisplayOrder: boolean;
    displayOrder: number;
  };
}

/**
 * Season start-date anchor for a newly created farm: the most recent February
 * 1st. January rolls back to last year's Feb 1 (the current agronomic year
 * started the previous February); every other month uses this year's Feb 1.
 * A deterministic anchor means a first-time farmer's farm is immediately
 * loggable — they don't hit a "start season" wall before their first record.
 */
export function getInitialSeasonStartDate(now: Date = new Date()): Date {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return new Date(year, 1, 1); // month 1 = February
}

/**
 * A newly created farm always auto-starts its first season, anchored to the
 * most recent February 1st (see getInitialSeasonStartDate) — or to a supplied
 * pruning date when the farmer provided one. This keeps the farm immediately
 * loggable so the one-tap first log after creation isn't blocked by a missing
 * season.
 */
export function shouldAutoStartInitialSeason(_farm: Pick<Farm, 'date_of_pruning'>): boolean {
  return true;
}

export async function ensureInitialFarmSeason(
  farm: Farm,
  userId: string,
  seasonNameOverride?: string,
): Promise<boolean> {
  if (typeof farm.id !== 'number') return false;

  // Only bootstrap a season for farms with no season history at all. A farm
  // that is *between* seasons (only ended seasons) must not get a new season
  // auto-started here: the start date below would come from the previous
  // cycle's pruning date and overlap the ended seasons, silently re-capturing
  // historical records. Between-seasons records stay unassigned instead.
  let existingSeason: { id?: number } | null;
  try {
    existingSeason = (await getDataAccess().farms.getExistingSeason(farm.id)) as {
      id?: number;
    } | null;
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return false;
    throw error;
  }
  if (existingSeason?.id) return true;

  const startDate = farm.date_of_pruning ?? formatLocalDate(getInitialSeasonStartDate());
  const seasonName = seasonNameOverride ?? `Season ${new Date().getFullYear()}`;

  try {
    await getDataAccess().farms.startSeason({
      p_farm_id: farm.id,
      p_start_date: startDate,
      p_template_key: null,
      p_config_json: null,
      p_season_name: seasonName,
    });
    return true;
  } catch (rpcError) {
    if (!isRpcFunctionMissing(rpcError as { code?: string; message?: string })) throw rpcError;
  }

  try {
    await getDataAccess().farms.createSeason({
      farm_id: farm.id,
      user_id: userId,
      start_date: startDate,
      end_date: null,
      season_name: seasonName,
      crop_type_snapshot: farm.crop,
    } satisfies Omit<FarmSeason, 'id' | 'created_at' | 'updated_at'>);
  } catch (insertError) {
    if ((insertError as { code?: string }).code === '42P01') return false;
    // A concurrent create or DB trigger may have created the active season after our check.
    if ((insertError as { code?: string }).code === '23505') return true;
    throw insertError;
  }
  return true;
}

export async function ensureInitialFarmSeasonForFarmId(
  farmId: number,
  seasonNameOverride?: string,
): Promise<boolean> {
  const userId = await getUserId();
  const farm = await getDataAccess().farms.getById(farmId, userId);
  return ensureInitialFarmSeason(farm, userId, seasonNameOverride);
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

      return getDataAccess().farms.listForUser(userId);
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
      return getDataAccess().farms.getById(id!, userId);
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

        try {
          data = await getDataAccess().farms.create(insertPayload);
          break;
        } catch (error) {
          const typedError = error as { code?: string; message?: string };
          lastError = typedError;
          if (!isUniqueDisplayOrderViolation(typedError)) throw error;
        }
      }

      if (!data) {
        throw lastError ?? new Error('Failed to create farm');
      }
      // Always auto-start the first season so the farm is immediately
      // loggable — the one-tap first log after creation must not hit a missing-
      // season wall. The season is anchored to the most recent February 1st
      // (or the farmer's pruning date when supplied). The "don't re-capture an
      // existing/between-seasons farm" guard lives inside
      // ensureInitialFarmSeason and stays intact.
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
      try {
        await getDataAccess().farms.reorder(orderedFarmIds);
      } catch (error) {
        if (
          isRpcFunctionMissing(error as { code?: string; message?: string }) ||
          isMissingDisplayOrderColumnError(error as { code?: string; message?: string })
        ) {
          throw new Error(
            'Farm ordering is not available until the latest database migration runs.',
          );
        }
        throw error;
      }

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

      return getDataAccess().farms.update(id, userId, updates);
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
      return getDataAccess().farms.updateWaterLevel(farmId, {
        remaining_water: remainingWater,
        water_calculation_updated_at: toSupabaseTimestampString(new Date()),
      });
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

      await getDataAccess().farms.remove(id, userId);
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
        return getDataAccess().farms.getById(id, await getUserId());
      },
    });
  };
}
