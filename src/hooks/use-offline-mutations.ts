/**
 * Offline Mutation Hooks
 *
 * PowerSync-backed mutation hooks for offline-first write operations.
 * Writes go to the local SQLite database first (instant UI update),
 * then PowerSync's upload queue syncs them to Supabase automatically.
 *
 * Falls back to direct Supabase writes when PowerSync is unavailable.
 */

import { usePowerSync } from '@powersync/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isPowerSyncConfigured } from '../lib/powersync';
import { queryKeys } from './query-keys';
import type {
  Farm,
  FarmInsert,
  FarmUpdate,
  FarmSeason,
  FarmSeasonInsert,
  FarmSeasonUpdate,
  Profile,
  ProfileUpdate,
} from '../types';
import { TABLES, toSupabaseTimestampString } from '../types';

// ============================================================
// MARK: - Helpers
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

/**
 * Generate a client-side UUID for new records.
 * Uses crypto.randomUUID when available, falls back to a manual implementation.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build column names and placeholders for an INSERT statement.
 */
function buildInsertSQL(
  table: string,
  record: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const entries = Object.entries(record).filter(([, v]) => v !== undefined);
  const columns = entries.map(([k]) => k);
  const placeholders = entries.map(() => '?');
  const params = entries.map(([, v]) => (v === null ? null : v));

  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    params,
  };
}

/**
 * Build SET clause for an UPDATE statement.
 */
function buildUpdateSQL(
  table: string,
  id: string,
  updates: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  const setClauses = entries.map(([k]) => `${k} = ?`);
  const params = [...entries.map(([, v]) => (v === null ? null : v)), id];

  return {
    sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  };
}

// ============================================================
// MARK: - Farm Mutations
// ============================================================

/**
 * Create a farm using PowerSync local write (offline-capable).
 * Falls back to direct Supabase insert when PowerSync is unavailable.
 */
export function useOfflineCreateFarm() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async (farm: FarmInsert): Promise<Farm> => {
      const userId = await getUserId();
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        const record: Record<string, unknown> = {
          id,
          user_id: userId,
          name: farm.name,
          region: farm.region,
          area: farm.area,
          crop: farm.crop,
          crop_variety: farm.crop_variety,
          planting_date: farm.planting_date,
          vine_spacing: farm.vine_spacing ?? null,
          row_spacing: farm.row_spacing ?? null,
          total_tank_capacity: farm.total_tank_capacity ?? null,
          system_discharge: farm.system_discharge ?? null,
          remaining_water: farm.remaining_water ?? null,
          water_calculation_updated_at: farm.water_calculation_updated_at ?? null,
          latitude: farm.latitude ?? null,
          longitude: farm.longitude ?? null,
          elevation: farm.elevation ?? null,
          timezone: farm.timezone ?? null,
          location_name: farm.location_name ?? null,
          location_source: farm.location_source ?? null,
          location_updated_at: farm.location_updated_at ?? null,
          bulk_density: farm.bulk_density ?? null,
          cation_exchange_capacity: farm.cation_exchange_capacity ?? null,
          soil_water_retention: farm.soil_water_retention ?? null,
          soil_texture_class: farm.soil_texture_class ?? null,
          sand_percentage: farm.sand_percentage ?? null,
          silt_percentage: farm.silt_percentage ?? null,
          clay_percentage: farm.clay_percentage ?? null,
          date_of_pruning: farm.date_of_pruning ?? null,
          first_season_start_date: farm.first_season_start_date ?? null,
          created_at: now,
          updated_at: now,
        };

        const { sql, params } = buildInsertSQL('farms', record);
        await db.execute(sql, params);

        return { ...farm, id: undefined, user_id: userId, created_at: now, updated_at: now };
      }

      // Supabase fallback
      const { data, error } = await supabase
        .from(TABLES.FARMS)
        .insert({ ...farm, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
    },
  });
}

/**
 * Update a farm using PowerSync local write (offline-capable).
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useOfflineUpdateFarm() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: FarmUpdate }): Promise<Farm> => {
      const userId = await getUserId();
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        const updateRecord: Record<string, unknown> = {
          ...updates,
          updated_at: now,
        };

        const { sql, params } = buildUpdateSQL('farms', String(id), updateRecord);
        await db.execute(sql, params);

        return { id, user_id: userId, updated_at: now, ...updates } as Farm;
      }

      // Supabase fallback
      const { data, error } = await supabase
        .from(TABLES.FARMS)
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedFarm) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
      if (updatedFarm.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farms.detail(updatedFarm.id) });
      }
    },
  });
}

/**
 * Update farm water level using PowerSync local write (offline-capable).
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useOfflineUpdateFarmWaterLevel() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async ({
      farmId,
      remainingWater,
    }: {
      farmId: number;
      remainingWater: number;
    }): Promise<Farm> => {
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        await db.execute(
          'UPDATE farms SET remaining_water = ?, water_calculation_updated_at = ?, updated_at = ? WHERE id = ?',
          [remainingWater, now, now, String(farmId)],
        );

        return { id: farmId, remaining_water: remainingWater, water_calculation_updated_at: now } as Farm;
      }

      // Supabase fallback
      const { data, error } = await supabase
        .from(TABLES.FARMS)
        .update({
          remaining_water: remainingWater,
          water_calculation_updated_at: now,
        })
        .eq('id', farmId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedFarm) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
      if (updatedFarm.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.farms.detail(updatedFarm.id) });
      }
    },
  });
}

/**
 * Delete a farm using PowerSync local write (offline-capable).
 * Falls back to direct Supabase delete when PowerSync is unavailable.
 */
export function useOfflineDeleteFarm() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const userId = await getUserId();

      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM farms WHERE id = ?', [String(id)]);
        return;
      }

      // Supabase fallback
      const { error } = await supabase
        .from(TABLES.FARMS)
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.farms.all });
      queryClient.removeQueries({ queryKey: queryKeys.farms.detail(deletedId) });

      // Invalidate related queries for the deleted farm
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
// MARK: - Farm Season Mutations
// ============================================================

/**
 * Create a farm season using PowerSync local write (offline-capable).
 * Falls back to direct Supabase insert when PowerSync is unavailable.
 */
export function useOfflineCreateFarmSeason() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async (season: FarmSeasonInsert): Promise<FarmSeason> => {
      const userId = await getUserId();
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        const record: Record<string, unknown> = {
          id,
          farm_id: String(season.farm_id),
          user_id: userId,
          start_date: season.start_date,
          end_date: season.end_date ?? null,
          season_name: season.season_name ?? null,
          crop_type_snapshot: season.crop_type_snapshot ?? null,
          template_key: season.template_key ?? null,
          template_version: season.template_version ?? null,
          config_json: season.config_json ? JSON.stringify(season.config_json) : null,
          created_at: now,
          updated_at: now,
        };

        const { sql, params } = buildInsertSQL('farm_seasons', record);
        await db.execute(sql, params);

        return {
          ...season,
          id: undefined,
          user_id: userId,
          created_at: now,
          updated_at: now,
        };
      }

      // Supabase fallback
      const { data, error } = await supabase
        .from(TABLES.FARM_SEASONS)
        .insert(season)
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

/**
 * Update a farm season using PowerSync local write (offline-capable).
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useOfflineUpdateFarmSeason() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

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
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        const updateRecord: Record<string, unknown> = {
          ...updates,
          updated_at: now,
        };

        // Serialize config_json if present
        if (updateRecord.config_json && typeof updateRecord.config_json === 'object') {
          updateRecord.config_json = JSON.stringify(updateRecord.config_json);
        }

        const { sql, params } = buildUpdateSQL('farm_seasons', String(id), updateRecord);
        await db.execute(sql, params);

        return { id, farm_id: farmId, updated_at: now, ...updates } as FarmSeason;
      }

      // Supabase fallback
      const { data, error } = await supabase
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmSeasons.listByFarm(updatedSeason.farm_id),
      });
    },
  });
}

/**
 * Delete a farm season using PowerSync local write (offline-capable).
 * Falls back to direct Supabase delete when PowerSync is unavailable.
 */
export function useOfflineDeleteFarmSeason() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM farm_seasons WHERE id = ?', [String(id)]);
        return;
      }

      // Supabase fallback
      const { error } = await supabase
        .from(TABLES.FARM_SEASONS)
        .delete()
        .eq('id', id)
        .eq('farm_id', farmId);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.farmSeasons.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - Profile Mutations
// ============================================================

/**
 * Update the current user's profile using PowerSync local write (offline-capable).
 * Falls back to direct Supabase upsert when PowerSync is unavailable.
 */
export function useOfflineUpdateProfile() {
  const queryClient = useQueryClient();
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    if (powerSyncAvailable) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      db = usePowerSync();
    }
  } catch {
    // PowerSync context not available
  }

  return useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<Profile> => {
      const userId = await getUserId();
      const now = toSupabaseTimestampString(new Date());

      if (db && powerSyncAvailable) {
        // Check if profile exists locally
        const existing = await db.execute('SELECT id FROM profiles WHERE id = ?', [userId]);

        if (existing.rows?.length) {
          // Update existing profile
          const updateRecord: Record<string, unknown> = {
            ...updates,
            updated_at: now,
          };
          const { sql, params } = buildUpdateSQL('profiles', userId, updateRecord);
          await db.execute(sql, params);
        } else {
          // Insert new profile (upsert behavior)
          const record: Record<string, unknown> = {
            id: userId,
            ...updates,
            created_at: now,
            updated_at: now,
          };
          const { sql, params } = buildInsertSQL('profiles', record);
          await db.execute(sql, params);
        }

        return { id: userId, ...updates, updated_at: now } as Profile;
      }

      // Supabase fallback
      const payload: ProfileUpdate & { id: string } = { ...updates, id: userId };
      const { data, error } = await supabase
        .from(TABLES.PROFILES)
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(queryKeys.profile.current(), updatedProfile);
    },
  });
}
