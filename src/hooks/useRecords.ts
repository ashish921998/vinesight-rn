/**
 * Records Hooks
 * React Query hooks for farm record CRUD operations
 * Covers: Irrigation, Spray, Fertigation, Harvest, Expense records
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './queryKeys';
import {
  TABLES,
  type IrrigationRecord,
  type IrrigationRecordInsert,
  type SprayRecord,
  type SprayRecordInsert,
  type FertigationRecord,
  type FertigationRecordInsert,
  type HarvestRecord,
  type HarvestRecordInsert,
  type ExpenseRecord,
  type ExpenseRecordInsert,
} from '../types';

// ============================================================
// MARK: - IRRIGATION RECORDS
// ============================================================

export function useIrrigationRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.irrigationRecords.listByFarm(farmId!),
    queryFn: async (): Promise<IrrigationRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useIrrigationRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.irrigationRecords.listByFarms(farmIds),
    queryFn: async (): Promise<IrrigationRecord[]> => {
      if (farmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useCreateIrrigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: IrrigationRecordInsert): Promise<IrrigationRecord> => {
      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.irrigationRecords.listByFarm(newRecord.farm_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.irrigationRecords.lists(),
      });
    },
  });
}

export function useUpdateIrrigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<IrrigationRecord>;
    }): Promise<IrrigationRecord> => {
      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.irrigationRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteIrrigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.irrigationRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - SPRAY RECORDS
// ============================================================

export function useSprayRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.sprayRecords.listByFarm(farmId!),
    queryFn: async (): Promise<SprayRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useSprayRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.sprayRecords.listByFarms(farmIds),
    queryFn: async (): Promise<SprayRecord[]> => {
      if (farmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useCreateSprayRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: SprayRecordInsert): Promise<SprayRecord> => {
      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sprayRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdateSprayRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<SprayRecord>;
    }): Promise<SprayRecord> => {
      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sprayRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteSprayRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sprayRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - FERTIGATION RECORDS
// ============================================================

export function useFertigationRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.fertigationRecords.listByFarm(farmId!),
    queryFn: async (): Promise<FertigationRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useFertigationRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.fertigationRecords.listByFarms(farmIds),
    queryFn: async (): Promise<FertigationRecord[]> => {
      if (farmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useCreateFertigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: FertigationRecordInsert): Promise<FertigationRecord> => {
      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.fertigationRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdateFertigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<FertigationRecord>;
    }): Promise<FertigationRecord> => {
      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.fertigationRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteFertigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.fertigationRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - HARVEST RECORDS
// ============================================================

export function useHarvestRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.harvestRecords.listByFarm(farmId!),
    queryFn: async (): Promise<HarvestRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useHarvestRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.harvestRecords.listByFarms(farmIds),
    queryFn: async (): Promise<HarvestRecord[]> => {
      if (farmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useCreateHarvestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: HarvestRecordInsert): Promise<HarvestRecord> => {
      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.harvestRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdateHarvestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<HarvestRecord>;
    }): Promise<HarvestRecord> => {
      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.harvestRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteHarvestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.harvestRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - EXPENSE RECORDS
// ============================================================

export function useExpenseRecords(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.expenseRecords.listByFarm(farmId!),
    queryFn: async (): Promise<ExpenseRecord[]> => {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!farmId,
  });
}

export function useExpenseRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.expenseRecords.listByFarms(farmIds),
    queryFn: async (): Promise<ExpenseRecord[]> => {
      if (farmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useCreateExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: ExpenseRecordInsert): Promise<ExpenseRecord> => {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenseRecords.listByFarm(newRecord.farm_id),
      });
    },
  });
}

export function useUpdateExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<ExpenseRecord>;
    }): Promise<ExpenseRecord> => {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedRecord) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenseRecords.listByFarm(updatedRecord.farm_id),
      });
    },
  });
}

export function useDeleteExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenseRecords.listByFarm(farmId),
      });
    },
  });
}
