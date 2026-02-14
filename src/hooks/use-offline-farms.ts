/**
 * Offline Farms Hooks
 *
 * PowerSync-backed reactive hooks for reading farm data from the local
 * SQLite database. Falls back to Supabase direct queries when PowerSync
 * is not available (e.g., web platform or missing configuration).
 *
 * Write operations remain in use-farms.ts and go through Supabase directly.
 * PowerSync's connector handles syncing writes back automatically.
 */

import { useCallback, useMemo } from 'react';
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isPowerSyncConfigured } from '../lib/powersync';
import { queryKeys } from './query-keys';
import type { Farm } from '../types';
import { TABLES } from '../types';

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
// MARK: - PowerSync row → Farm type mapper
// ============================================================

/**
 * Maps a PowerSync SQLite row to the Farm interface.
 * PowerSync stores all IDs as TEXT; numeric fields need parsing.
 */
function mapRowToFarm(row: Record<string, unknown>): Farm {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    user_id: row.user_id as string | undefined,
    name: (row.name as string) ?? '',
    region: (row.region as string) ?? '',
    area: Number(row.area) || 0,
    crop: (row.crop as string) ?? '',
    crop_variety: (row.crop_variety as string) ?? '',
    planting_date: (row.planting_date as string) ?? '',
    vine_spacing: row.vine_spacing != null ? Number(row.vine_spacing) : null,
    row_spacing: row.row_spacing != null ? Number(row.row_spacing) : null,
    total_tank_capacity: row.total_tank_capacity != null ? Number(row.total_tank_capacity) : null,
    system_discharge: row.system_discharge != null ? Number(row.system_discharge) : null,
    remaining_water: row.remaining_water != null ? Number(row.remaining_water) : null,
    water_calculation_updated_at: row.water_calculation_updated_at as string | null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    elevation: row.elevation != null ? Number(row.elevation) : null,
    timezone: row.timezone as string | null,
    location_name: row.location_name as string | null,
    location_source: row.location_source as string | null,
    location_updated_at: row.location_updated_at as string | null,
    bulk_density: row.bulk_density != null ? Number(row.bulk_density) : null,
    cation_exchange_capacity:
      row.cation_exchange_capacity != null ? Number(row.cation_exchange_capacity) : null,
    soil_water_retention:
      row.soil_water_retention != null ? Number(row.soil_water_retention) : null,
    soil_texture_class: row.soil_texture_class as string | null,
    sand_percentage: row.sand_percentage != null ? Number(row.sand_percentage) : null,
    silt_percentage: row.silt_percentage != null ? Number(row.silt_percentage) : null,
    clay_percentage: row.clay_percentage != null ? Number(row.clay_percentage) : null,
    date_of_pruning: row.date_of_pruning as string | null,
    first_season_start_date: row.first_season_start_date as string | null,
    created_at: row.created_at as string | null,
    updated_at: row.updated_at as string | null,
  };
}

// ============================================================
// MARK: - Offline Farms List Hook
// ============================================================

/**
 * Fetch all farms for the current user using PowerSync local reads.
 * Automatically falls back to Supabase when PowerSync is unavailable.
 *
 * Replaces direct Supabase `.from('farms').select('*')` reads with
 * PowerSync watched queries for offline-first reactivity.
 */
export function useOfflineFarms() {
  const powerSyncAvailable = isPowerSyncConfigured();

  // PowerSync local read — reactive, updates when local DB changes
  const psResult = usePowerSyncQuery<Record<string, unknown>>(
    powerSyncAvailable ? 'SELECT * FROM farms ORDER BY created_at DESC' : 'SELECT 1 WHERE 0',
    [],
  );

  // Supabase fallback — used when PowerSync is not configured
  const supabaseResult = useQuery({
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
    enabled: !powerSyncAvailable,
  });

  // Map PowerSync rows to Farm type
  const offlineFarms = useMemo(
    () => (powerSyncAvailable ? psResult.data.map(mapRowToFarm) : []),
    [powerSyncAvailable, psResult.data],
  );

  if (powerSyncAvailable) {
    return {
      data: offlineFarms,
      isLoading: psResult.isLoading,
      error: psResult.error ?? null,
      isFetching: psResult.isFetching,
      refetch: psResult.refresh
        ? async () => {
            await psResult.refresh?.();
          }
        : async () => {},
    };
  }

  // Supabase fallback
  return {
    data: supabaseResult.data ?? [],
    isLoading: supabaseResult.isLoading,
    error: supabaseResult.error ?? null,
    isFetching: supabaseResult.isFetching,
    refetch: async () => {
      await supabaseResult.refetch();
    },
  };
}

// ============================================================
// MARK: - Offline Single Farm Hook
// ============================================================

/**
 * Fetch a single farm by ID using PowerSync local reads.
 * Falls back to Supabase when PowerSync is unavailable.
 */
export function useOfflineFarm(id: number | undefined) {
  const powerSyncAvailable = isPowerSyncConfigured();
  const enabled = !!id && !isNaN(id);

  // PowerSync local read
  const psResult = usePowerSyncQuery<Record<string, unknown>>(
    powerSyncAvailable && enabled ? 'SELECT * FROM farms WHERE id = ?' : 'SELECT 1 WHERE 0',
    powerSyncAvailable && enabled ? [String(id)] : [],
  );

  // Supabase fallback
  const supabaseResult = useQuery({
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
    enabled: !powerSyncAvailable && enabled,
  });

  const offlineFarm = useMemo(() => {
    if (!powerSyncAvailable || psResult.data.length === 0) return undefined;
    return mapRowToFarm(psResult.data[0]);
  }, [powerSyncAvailable, psResult.data]);

  if (powerSyncAvailable) {
    return {
      data: offlineFarm,
      isLoading: psResult.isLoading,
      error: psResult.error ?? null,
      isFetching: psResult.isFetching,
    };
  }

  return {
    data: supabaseResult.data,
    isLoading: supabaseResult.isLoading,
    error: supabaseResult.error ?? null,
    isFetching: supabaseResult.isFetching,
  };
}
