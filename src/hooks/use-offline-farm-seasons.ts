/**
 * Offline Farm Seasons Hooks
 *
 * PowerSync-backed reactive hooks for reading farm season data from the
 * local SQLite database. Falls back to Supabase direct queries when
 * PowerSync is not available.
 *
 * Write operations remain in use-farm-seasons.ts and go through Supabase.
 */

import { useMemo } from 'react';
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isPowerSyncConfigured } from '../lib/powersync';
import { queryKeys } from './query-keys';
import type { FarmSeason } from '../types';
import { TABLES } from '../types';
import { parseDbDateToLocalDate } from '../utils/date';

// ============================================================
// MARK: - PowerSync row → FarmSeason type mapper
// ============================================================

/**
 * Maps a PowerSync SQLite row to the FarmSeason interface.
 * PowerSync stores IDs as TEXT; numeric fields need parsing.
 */
function mapRowToFarmSeason(row: Record<string, unknown>): FarmSeason {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    farm_id: Number(row.farm_id) || 0,
    user_id: row.user_id as string | undefined,
    start_date: (row.start_date as string) ?? '',
    end_date: (row.end_date as string) || null,
    season_name: (row.season_name as string) || null,
    crop_type_snapshot: (row.crop_type_snapshot as string) || null,
    template_key: (row.template_key as string) || null,
    template_version: row.template_version != null ? Number(row.template_version) : null,
    config_json: row.config_json ? (JSON.parse(row.config_json as string) as Record<string, unknown>) : null,
    created_at: row.created_at as string | null,
    updated_at: row.updated_at as string | null,
  };
}

/**
 * Sort farm seasons by end_date ascending (matching use-farm-seasons.ts behavior).
 */
function sortFarmSeasonsByEndDate(items: FarmSeason[]): FarmSeason[] {
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

// ============================================================
// MARK: - Offline Farm Seasons Hook
// ============================================================

/**
 * Fetch all seasons for a given farm using PowerSync local reads.
 * Automatically falls back to Supabase when PowerSync is unavailable.
 *
 * Replaces direct Supabase `.from('farm_seasons').select('*')` reads
 * with PowerSync watched queries for offline-first reactivity.
 */
export function useOfflineFarmSeasons(farmId: number | undefined) {
  const powerSyncAvailable = isPowerSyncConfigured();
  const enabled = !!farmId && !Number.isNaN(farmId);

  // PowerSync local read — reactive, updates when local DB changes
  const psResult = usePowerSyncQuery<Record<string, unknown>>(
    powerSyncAvailable && enabled
      ? 'SELECT * FROM farm_seasons WHERE farm_id = ?'
      : 'SELECT 1 WHERE 0',
    powerSyncAvailable && enabled ? [String(farmId)] : [],
  );

  // Supabase fallback — used when PowerSync is not configured
  const supabaseResult = useQuery({
    queryKey: queryKeys.farmSeasons.listByFarm(farmId ?? -1),
    queryFn: async (): Promise<FarmSeason[]> => {
      if (!farmId) return [];
      const { data, error } = await supabase
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
    enabled: !powerSyncAvailable && enabled,
  });

  // Map and sort PowerSync rows
  const offlineSeasons = useMemo(
    () =>
      powerSyncAvailable
        ? sortFarmSeasonsByEndDate(psResult.data.map(mapRowToFarmSeason))
        : [],
    [powerSyncAvailable, psResult.data],
  );

  if (powerSyncAvailable) {
    return {
      data: offlineSeasons,
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
