/**
 * Profile & Misc Hooks
 * React Query hooks for Profile, Warehouse, Soil Tests, Calculation History
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
// MARK: - PROFILE
// ============================================================

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async (): Promise<Profile | null> => {
      const userId = await getUserId();

      const { data, error } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile might not exist yet
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<Profile> => {
      const userId = await getUserId();
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

export function useSoilTestRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.soilTestRecords.listByFarm(farmId!),
    queryFn: async (): Promise<SoilTestRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.SOIL_TEST_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

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
      const { data, error } = await supabase
        .from(TABLES.SOIL_TEST_RECORDS)
        .insert(record)
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

export function usePetioleTestRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.petioleTestRecords.listByFarm(farmId!),
    queryFn: async (): Promise<PetioleTestRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.PETIOLE_TEST_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

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
      const { data, error } = await supabase
        .from(TABLES.PETIOLE_TEST_RECORDS)
        .insert(record)
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

export function useSoilProfiles(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.soilProfiles.listByFarm(farmId!),
    queryFn: async (): Promise<SoilProfile[]> => {
      const { data, error } = await supabase
        .from(TABLES.SOIL_PROFILES)
        .select('*')
        .eq('farm_id', farmId)
        .order('created_at', { ascending: false });

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
      const { data, error } = await supabase
        .from(TABLES.SOIL_PROFILES)
        .insert(profile)
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
