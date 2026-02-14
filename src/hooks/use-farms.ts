/**
 * Farms Hook
 * React Query hooks for farm CRUD operations
 * Mirrors iOS SupabaseDataService.swift farms methods
 *
 * READ operations delegate to offline hooks (use-offline-farms.ts)
 * which use PowerSync local SQLite reads with Supabase fallback.
 * WRITE operations delegate to offline mutation hooks (use-offline-mutations.ts)
 * which write to PowerSync local SQLite first, then sync to Supabase.
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
import { TABLES } from '../types';
import { useOfflineFarms, useOfflineFarm } from './use-offline-farms';
import {
  useOfflineCreateFarm,
  useOfflineUpdateFarm,
  useOfflineUpdateFarmWaterLevel,
  useOfflineDeleteFarm,
} from './use-offline-mutations';

// ============================================================
// MARK: - Fetch Farms Query (Offline-First)
// ============================================================

/**
 * Fetch all farms for the current user.
 * Uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useFarms() {
  return useOfflineFarms();
}

/**
 * Fetch a single farm by ID.
 * Uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useFarm(id: number | undefined) {
  return useOfflineFarm(id);
}

// ============================================================
// MARK: - Create Farm Mutation (Offline-First)
// ============================================================

/**
 * Create a farm. Writes to PowerSync local SQLite first for
 * instant UI update, then syncs to Supabase automatically.
 * Falls back to direct Supabase insert when PowerSync is unavailable.
 */
export function useCreateFarm() {
  return useOfflineCreateFarm();
}

// ============================================================
// MARK: - Update Farm Mutation (Offline-First)
// ============================================================

/**
 * Update a farm. Writes to PowerSync local SQLite first for
 * instant UI update, then syncs to Supabase automatically.
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useUpdateFarm() {
  return useOfflineUpdateFarm();
}

// ============================================================
// MARK: - Update Farm Water Level Mutation (Offline-First)
// ============================================================

/**
 * Update farm water level. Writes to PowerSync local SQLite first for
 * instant UI update, then syncs to Supabase automatically.
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useUpdateFarmWaterLevel() {
  return useOfflineUpdateFarmWaterLevel();
}

// ============================================================
// MARK: - Delete Farm Mutation (Offline-First)
// ============================================================

/**
 * Delete a farm. Writes to PowerSync local SQLite first for
 * instant UI update, then syncs to Supabase automatically.
 * Falls back to direct Supabase delete when PowerSync is unavailable.
 */
export function useDeleteFarm() {
  return useOfflineDeleteFarm();
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
