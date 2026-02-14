/**
 * Offline Mutation Hooks
 *
 * PowerSync-backed write hooks for farms, farm_seasons (vineyards/seasons),
 * and profiles. Writes go directly to the local PowerSync SQLite database,
 * which then syncs to Supabase via the connector's uploadData method.
 *
 * When PowerSync is not available (web, missing config), falls back to
 * direct Supabase writes via the existing service layer.
 *
 * ## Conflict Resolution
 *
 * All writes stamp `updated_at = now()` locally. The upload handler also
 * stamps `updated_at = now()` on the server side, implementing a
 * last-write-wins (LWW) strategy. See connector.ts for details.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import { useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import { isPowerSyncConfigured } from '../lib/powersync';
import { supabase } from '../lib/supabase';
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

// ============================================================
// MARK: - Helpers
// ============================================================

/**
 * Get the current authenticated user ID from Supabase.
 * Throws if not signed in.
 */
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
 * Generate a UUID v4 for new records.
 * PowerSync uses text-based UUIDs for IDs.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// MARK: - Offline Farm Mutations
// ============================================================

/**
 * Hook for creating a farm offline.
 * Writes directly to the local PowerSync DB; the connector syncs to Supabase.
 * Falls back to direct Supabase insert when PowerSync is unavailable.
 */
export function useOfflineCreateFarm() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async (farm: FarmInsert): Promise<Farm> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

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

        await db.execute(
          `INSERT INTO farms (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map(() => '?').join(', ')})`,
          Object.values(record),
        );

        return { ...farm, id: undefined, user_id: userId, created_at: now, updated_at: now } as Farm;
      }

      // Fallback: direct Supabase insert
      const { data, error } = await supabase
        .from('farms')
        .insert({ ...farm, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

/**
 * Hook for updating a farm offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useOfflineUpdateFarm() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async ({ id, updates }: { id: number; updates: FarmUpdate }): Promise<Farm> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const fields = { ...updates, updated_at: now };
        const setClauses = Object.keys(fields)
          .map((key) => `${key} = ?`)
          .join(', ');
        const values = [...Object.values(fields), String(id)];

        await db.execute(`UPDATE farms SET ${setClauses} WHERE id = ?`, values);

        return { id, user_id: userId, ...updates, updated_at: now } as unknown as Farm;
      }

      // Fallback: direct Supabase update
      const { data, error } = await supabase
        .from('farms')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

/**
 * Hook for deleting a farm offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase delete when PowerSync is unavailable.
 */
export function useOfflineDeleteFarm() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async (id: number): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM farms WHERE id = ?', [String(id)]);
        return;
      }

      // Fallback: direct Supabase delete
      const userId = await getUserId();
      const { error } = await supabase.from('farms').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Offline Farm Season Mutations
// ============================================================

/**
 * Hook for creating a farm season offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase insert when PowerSync is unavailable.
 */
export function useOfflineCreateFarmSeason() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async (season: FarmSeasonInsert): Promise<FarmSeason> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

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

        await db.execute(
          `INSERT INTO farm_seasons (${Object.keys(record).join(', ')}) VALUES (${Object.keys(record).map(() => '?').join(', ')})`,
          Object.values(record),
        );

        return {
          ...season,
          id: undefined,
          user_id: userId,
          created_at: now,
          updated_at: now,
        } as FarmSeason;
      }

      // Fallback: direct Supabase insert
      const { data, error } = await supabase
        .from('farm_seasons')
        .insert(season)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

/**
 * Hook for updating a farm season offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase update when PowerSync is unavailable.
 */
export function useOfflineUpdateFarmSeason() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async ({
      id,
      farmId,
      updates,
    }: {
      id: number;
      farmId: number;
      updates: FarmSeasonUpdate;
    }): Promise<FarmSeason> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        // Serialize config_json if present
        const serialized: Record<string, unknown> = { ...updates, updated_at: now };
        if (serialized.config_json && typeof serialized.config_json === 'object') {
          serialized.config_json = JSON.stringify(serialized.config_json);
        }

        const setClauses = Object.keys(serialized)
          .map((key) => `${key} = ?`)
          .join(', ');
        const values = [...Object.values(serialized), String(id)];

        await db.execute(`UPDATE farm_seasons SET ${setClauses} WHERE id = ?`, values);

        return { id, farm_id: farmId, ...updates, updated_at: now } as unknown as FarmSeason;
      }

      // Fallback: direct Supabase update
      const { data, error } = await supabase
        .from('farm_seasons')
        .update(updates)
        .eq('id', id)
        .eq('farm_id', farmId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

/**
 * Hook for deleting a farm season offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase delete when PowerSync is unavailable.
 */
export function useOfflineDeleteFarmSeason() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM farm_seasons WHERE id = ?', [String(id)]);
        return;
      }

      // Fallback: direct Supabase delete
      const { error } = await supabase
        .from('farm_seasons')
        .delete()
        .eq('id', id)
        .eq('farm_id', farmId);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Offline Profile Mutations
// ============================================================

/**
 * Hook for updating the user's profile offline.
 * Writes directly to the local PowerSync DB.
 * Falls back to direct Supabase upsert when PowerSync is unavailable.
 */
export function useOfflineUpdateProfile() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  const mutateAsync = useCallback(
    async (updates: ProfileUpdate): Promise<Profile> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const fields: Record<string, unknown> = { ...updates, updated_at: now };
        const setClauses = Object.keys(fields)
          .map((key) => `${key} = ?`)
          .join(', ');
        const values = [...Object.values(fields), userId];

        await db.execute(`UPDATE profiles SET ${setClauses} WHERE id = ?`, values);

        return { id: userId, ...updates, updated_at: now } as unknown as Profile;
      }

      // Fallback: direct Supabase upsert
      const payload: ProfileUpdate & { id: string } = { ...updates, id: userId };
      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}
