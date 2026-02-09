/**
 * Records Hooks
 * React Query hooks for farm record CRUD operations
 * Covers: Irrigation, Spray, Fertigation, Harvest, Expense, Daily Note records
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './query-keys';
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
  type DailyNoteRecord,
} from '../types';
import { resolveSeasonIdForDate } from '../lib/season-context';

// ============================================================
// MARK: - IRRIGATION RECORDS
// ============================================================

export function useIrrigationRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.irrigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<IrrigationRecord[]> => {
      let query = supabase
        .from(TABLES.IRRIGATION_RECORDS)
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .insert({ ...record, season_id: seasonId })
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
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.IRRIGATION_RECORDS).delete().eq('id', id);

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

export function useSprayRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.sprayRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<SprayRecord[]> => {
      let query = supabase
        .from(TABLES.SPRAY_RECORDS)
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .insert({ ...record, season_id: seasonId })
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
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.SPRAY_RECORDS).delete().eq('id', id);

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

export function useFertigationRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.fertigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<FertigationRecord[]> => {
      let query = supabase
        .from(TABLES.FERTIGATION_RECORDS)
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .insert({ ...record, season_id: seasonId })
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
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.FERTIGATION_RECORDS).delete().eq('id', id);

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

export function useHarvestRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.harvestRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<HarvestRecord[]> => {
      let query = supabase
        .from(TABLES.HARVEST_RECORDS)
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .insert({ ...record, season_id: seasonId })
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
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.HARVEST_RECORDS).delete().eq('id', id);

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

export function useExpenseRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.expenseRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<ExpenseRecord[]> => {
      let query = supabase
        .from(TABLES.EXPENSE_RECORDS)
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .insert({ ...record, season_id: seasonId })
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
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await supabase.from(TABLES.EXPENSE_RECORDS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenseRecords.listByFarm(farmId),
      });
    },
  });
}

// ============================================================
// MARK: - DAILY NOTES
// ============================================================

export function useDailyNoteByDate(farmId: number | undefined, date: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dailyNotes.byDate(farmId!, date!),
    queryFn: async (): Promise<DailyNoteRecord | null> => {
      const { data, error } = await supabase
        .from(TABLES.DAILY_NOTES)
        .select('*')
        .eq('farm_id', farmId)
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!farmId && !!date,
  });
}

export function useUpsertDailyNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      farm_id,
      date,
      notes,
    }: {
      farm_id: number;
      date: string;
      notes: string;
    }): Promise<DailyNoteRecord> => {
      const seasonId = await resolveSeasonIdForDate({ farmId: farm_id, date });
      const { data, error } = await supabase
        .from(TABLES.DAILY_NOTES)
        .upsert(
          {
            farm_id,
            season_id: seasonId,
            date,
            notes: notes.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'farm_id,date' },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (savedNote) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.listByFarm(savedNote.farm_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.byDate(savedNote.farm_id, savedNote.date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}
