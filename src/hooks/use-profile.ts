/**
 * Profile & Misc Hooks
 * React Query hooks for Profile, Warehouse, Calculation History
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
import { queryKeys } from './query-keys';
import {
  TABLES,
  type Profile,
  type ProfileUpdate,
  type WarehouseItem,
  type WarehouseItemInsert,
  type WarehouseItemUpdate,
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
  } = await getDataAccess().auth.getSession();
  if (error || !session) {
    throw new Error('Please sign in to continue');
  }
  return session.user.id;
}

// ============================================================
// MARK: - PROFILE
// ============================================================

export function useProfile(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async (): Promise<Profile | null> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
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
    enabled,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<Profile> => {
      const userId = await getUserId();
      const payload: ProfileUpdate & { id: string } = { ...updates, id: userId };

      const { data, error } = await getDataAccess()
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

      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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
      const { data, error } = await getDataAccess()
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
      const { error } = await getDataAccess().from(TABLES.WAREHOUSE_ITEMS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouseItems.all });
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
      let query = getDataAccess()
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
      const { data, error } = await getDataAccess()
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
