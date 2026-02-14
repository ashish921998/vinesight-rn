/**
 * Farms Hook
 * React Query hooks for farm CRUD operations
 * Mirrors iOS SupabaseDataService.swift farms methods
 *
 * READ operations delegate to offline hooks (use-offline-farms.ts)
 * which use PowerSync local SQLite reads with Supabase fallback.
 *
 * WRITE operations (Phase 3) now go through PowerSync local DB when
 * available, falling back to direct Supabase writes otherwise.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
import type { Farm, FarmInsert, FarmUpdate } from '../types';
import { TABLES } from '../types';
import { useOfflineFarms, useOfflineFarm } from './use-offline-farms';
import {
  useOfflineCreateFarm,
  useOfflineUpdateFarm,
  useOfflineDeleteFarm,
} from './use-offline-mutations';

// ============================================================
// MARK: - Fetch Farms Query (Offline-First)
// ============================================================

/**
 * Fetch all farms for the current user.
 * Now uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useFarms() {
  return useOfflineFarms();
}

/**
 * Fetch a single farm by ID.
 * Now uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useFarm(id: number | undefined) {
  return useOfflineFarm(id);
}

// ============================================================
// MARK: - Create Farm Mutation (Offline-First)
// ============================================================

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const offlineCreate = useOfflineCreateFarm();

  return useMutation({
    mutationFn: async (farm: FarmInsert): Promise<Farm> => {
      return offlineCreate.mutateAsync(farm);
    },
    onSuccess: (newFarm) => {
      // Add to cache
      queryClient.setQueryData<Farm[]>(queryKeys.farms.lists(), (old) => {
        if (!old) return [newFarm];
        return [newFarm, ...old];
      });
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
    },
  });
}

// ============================================================
// MARK: - Update Farm Mutation (Offline-First)
// ============================================================

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  const offlineUpdate = useOfflineUpdateFarm();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: FarmUpdate }): Promise<Farm> => {
      return offlineUpdate.mutateAsync({ id, updates });
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
  const offlineUpdate = useOfflineUpdateFarm();

  return useMutation({
    mutationFn: async ({
      farmId,
      remainingWater,
    }: {
      farmId: number;
      remainingWater: number;
    }): Promise<Farm> => {
      return offlineUpdate.mutateAsync({
        id: farmId,
        updates: {
          remaining_water: remainingWater,
        },
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
// MARK: - Delete Farm Mutation (Offline-First)
// ============================================================

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  const offlineDelete = useOfflineDeleteFarm();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      return offlineDelete.mutateAsync(id);
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
        const { data, error } = await supabase.from(TABLES.FARMS).select('*').eq('id', id).single();

        if (error) throw error;
        return data;
      },
    });
  };
}
