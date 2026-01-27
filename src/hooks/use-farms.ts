/**
 * Farms Hook
 * React Query hooks for farm CRUD operations
 * Mirrors iOS SupabaseDataService.swift farms methods
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
import type { Farm, FarmInsert, FarmUpdate } from '../types';
import { TABLES, toSupabaseTimestampString } from '../types';

// ============================================================
// MARK: - Helper to get current user ID
// ============================================================

async function getUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('Please sign in to continue');
  }
  return session.user.id;
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

      const { data, error } = await supabase
        .from(TABLES.FARMS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

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
      const { data, error } = await supabase
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

  return useMutation({
    mutationFn: async (farm: FarmInsert): Promise<Farm> => {
      const userId = await getUserId();

      const { data, error } = await supabase
        .from(TABLES.FARMS)
        .insert({ ...farm, user_id: userId })
        .select()
        .single();

      if (error) throw error;
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

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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

      const { error } = await supabase
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
            queryKey[0] === 'dashboard'
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
