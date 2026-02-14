/**
 * Profile & Misc Hooks
 * React Query hooks for Profile, Warehouse, Soil Tests, Calculation History
 *
 * Profile READ operations delegate to offline hooks (use-offline-profile.ts)
 * which use PowerSync local SQLite reads with Supabase fallback.
 *
 * Profile WRITE operations (Phase 3) now go through PowerSync local DB when
 * available, falling back to direct Supabase writes otherwise.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
import {
  TABLES,
  type Profile,
  type ProfileUpdate,
  type WarehouseItem,
  type WarehouseItemInsert,
  type WarehouseItemUpdate,
  type SoilTestRecord,
  type SoilTestRecordInsert,
  type PetioleTestRecord,
  type PetioleTestRecordInsert,
  type SoilProfile,
  type SoilProfileInsert,
  type CalculationHistory,
  type CalculationHistoryInsert,
} from '../types';
import { formatLocalDate } from '../utils/date';
import { resolveSeasonIdForDate } from '../lib/season-context';
import { useOfflineProfile } from './use-offline-profile';
import { useOfflineUpdateProfile } from './use-offline-mutations';

// ============================================================
// MARK: - Helper
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
// MARK: - PROFILE (Offline-First)
// ============================================================

/**
 * Fetch the current user's profile.
 * Now uses PowerSync local reads for offline-first support,
 * with automatic Supabase fallback when PowerSync is unavailable.
 */
export function useProfile() {
  return useOfflineProfile();
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const offlineUpdate = useOfflineUpdateProfile();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<Profile> => {
      return offlineUpdate.mutateAsync(updates);
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(queryKeys.profile.current(), updatedProfile);
    },
  });
}

// ============================================================
// MARK: - WAREHOUSE ITEMS
// ============================================================

export function useWarehouseItems(type?: string) {
  return useQuery({
    queryKey: queryKeys.warehouseItems.listByType(type),
    queryFn: async (): Promise<WarehouseItem[]> => {
      const userId = await getUserId();

      let query = supabase
        .from(TABLES.WAREHOUSE_ITEMS)
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateWarehouseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: WarehouseItemInsert): Promise<WarehouseItem> => {
      const userId = await getUserId();

      const { data, error } = await supabase
        .from(TABLES.WAREHOUSE_ITEMS)
        .insert({ ...item, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseItems.all });
    },
  });
}

export function useUpdateWarehouseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: WarehouseItemUpdate;
    }): Promise<WarehouseItem> => {
      const { data, error } = await supabase
        .from(TABLES.WAREHOUSE_ITEMS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseItems.all });
    },
  });
}

export function useDeleteWarehouseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const { error } = await supabase.from(TABLES.WAREHOUSE_ITEMS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseItems.all });
    },
  });
}

// ============================================================
// MARK: - SOIL TEST RECORDS
// ============================================================

export function useSoilTestRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.soilTestRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<SoilTestRecord[]> => {
      let query = supabase
        .from(TABLES.SOIL_TEST_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useCreateSoilTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: SoilTestRecordInsert): Promise<SoilTestRecord> => {
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.SOIL_TEST_RECORDS)
        .insert({ ...record, season_id: seasonId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilTestRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdateSoilTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<SoilTestRecord>;
    }): Promise<SoilTestRecord> => {
      const { data, error } = await supabase
        .from(TABLES.SOIL_TEST_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilTestRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteSoilTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.SOIL_TEST_RECORDS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilTestRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - PETIOLE TEST RECORDS
// ============================================================

export function usePetioleTestRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.petioleTestRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<PetioleTestRecord[]> => {
      let query = supabase
        .from(TABLES.PETIOLE_TEST_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useCreatePetioleTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: PetioleTestRecordInsert): Promise<PetioleTestRecord> => {
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.PETIOLE_TEST_RECORDS)
        .insert({ ...record, season_id: seasonId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.petioleTestRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdatePetioleTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<PetioleTestRecord>;
    }): Promise<PetioleTestRecord> => {
      const { data, error } = await supabase
        .from(TABLES.PETIOLE_TEST_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.petioleTestRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeletePetioleTestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.PETIOLE_TEST_RECORDS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.petioleTestRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - SOIL PROFILES
// ============================================================

export function useSoilProfiles(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.soilProfiles.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<SoilProfile[]> => {
      let query = supabase
        .from(TABLES.SOIL_PROFILES)
        .select('*')
        .eq('farm_id', farmId)
        .order('created_at', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useCreateSoilProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: SoilProfileInsert): Promise<SoilProfile> => {
      const createdAt = profile.created_at ?? new Date().toISOString();
      const seasonId =
        profile.season_id ??
        (await resolveSeasonIdForDate({
          farmId: profile.farm_id,
          date: formatLocalDate(new Date(createdAt)),
        }));
      const { data, error } = await supabase
        .from(TABLES.SOIL_PROFILES)
        .insert({ ...profile, season_id: seasonId, created_at: createdAt })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilProfiles.listByFarm(newProfile.farm_id),
      });
    },
  });
}

export function useUpdateSoilProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<SoilProfile>;
    }): Promise<SoilProfile> => {
      const { data, error } = await supabase
        .from(TABLES.SOIL_PROFILES)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilProfiles.listByFarm(updatedProfile.farm_id),
      });
    },
  });
}

export function useDeleteSoilProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.SOIL_PROFILES).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.soilProfiles.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - CALCULATION HISTORY
// ============================================================

export function useCalculationHistory(farmId: number | undefined, type?: string) {
  return useQuery({
    queryKey: queryKeys.calculationHistory.listByFarm(farmId!, type),
    queryFn: async (): Promise<CalculationHistory[]> => {
      let query = supabase
        .from(TABLES.CALCULATION_HISTORY)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (type) {
        query = query.eq('calculation_type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useCreateCalculationHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (history: CalculationHistoryInsert): Promise<CalculationHistory> => {
      const { data, error } = await supabase
        .from(TABLES.CALCULATION_HISTORY)
        .insert(history)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newHistory) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calculationHistory.listByFarm(newHistory.farm_id),
      });
    },
  });
}
