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
  type FertilizerItem,
} from '../types';
import { resolveOptionalSeasonIdForDate } from '../lib/season-context';
import {
  listFarmRecords,
  listFarmRecordsByFarms,
  createFarmRecord,
  updateFarmRecord,
  deleteFarmRecord,
} from './record-crud';

// ============================================================
// MARK: - IRRIGATION RECORDS
// ============================================================

export function useIrrigationRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.irrigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: () => listFarmRecords<IrrigationRecord>(TABLES.IRRIGATION_RECORDS, farmId!, seasonId),
    enabled: !!farmId,
  });
}

export function useIrrigationRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.irrigationRecords.listByFarms(farmIds),
    queryFn: () => listFarmRecordsByFarms<IrrigationRecord>(TABLES.IRRIGATION_RECORDS, farmIds),
    enabled: farmIds.length > 0,
  });
}

export function useCreateIrrigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: IrrigationRecordInsert) =>
      createFarmRecord<IrrigationRecord, IrrigationRecordInsert>(TABLES.IRRIGATION_RECORDS, record),
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
    mutationFn: ({ id, updates }: { id: number; updates: Partial<IrrigationRecord> }) =>
      updateFarmRecord<IrrigationRecord>(TABLES.IRRIGATION_RECORDS, id, updates),
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
    mutationFn: ({ id }: { id: number; farmId: number }) =>
      deleteFarmRecord(TABLES.IRRIGATION_RECORDS, id),
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
    queryFn: () => listFarmRecords<SprayRecord>(TABLES.SPRAY_RECORDS, farmId!, seasonId),
    enabled: !!farmId,
  });
}

export function useSprayRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.sprayRecords.listByFarms(farmIds),
    queryFn: () => listFarmRecordsByFarms<SprayRecord>(TABLES.SPRAY_RECORDS, farmIds),
    enabled: farmIds.length > 0,
  });
}

export function useCreateSprayRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: SprayRecordInsert) =>
      createFarmRecord<SprayRecord, SprayRecordInsert>(TABLES.SPRAY_RECORDS, record),
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
    mutationFn: ({ id, updates }: { id: number; updates: Partial<SprayRecord> }) =>
      updateFarmRecord<SprayRecord>(TABLES.SPRAY_RECORDS, id, updates),
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
    mutationFn: ({ id }: { id: number; farmId: number }) =>
      deleteFarmRecord(TABLES.SPRAY_RECORDS, id),
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
    queryFn: () =>
      listFarmRecords<FertigationRecord>(TABLES.FERTIGATION_RECORDS, farmId!, seasonId),
    enabled: !!farmId,
  });
}

export function useFertigationRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.fertigationRecords.listByFarms(farmIds),
    queryFn: () => listFarmRecordsByFarms<FertigationRecord>(TABLES.FERTIGATION_RECORDS, farmIds),
    enabled: farmIds.length > 0,
  });
}

export function useCreateFertigationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: FertigationRecordInsert) =>
      createFarmRecord<FertigationRecord, FertigationRecordInsert>(
        TABLES.FERTIGATION_RECORDS,
        record,
      ),
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
    mutationFn: ({ id, updates }: { id: number; updates: Partial<FertigationRecord> }) =>
      updateFarmRecord<FertigationRecord>(TABLES.FERTIGATION_RECORDS, id, updates),
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
    mutationFn: ({ id }: { id: number; farmId: number }) =>
      deleteFarmRecord(TABLES.FERTIGATION_RECORDS, id),
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
    queryFn: () => listFarmRecords<HarvestRecord>(TABLES.HARVEST_RECORDS, farmId!, seasonId),
    enabled: !!farmId,
  });
}

export function useHarvestRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.harvestRecords.listByFarms(farmIds),
    queryFn: () => listFarmRecordsByFarms<HarvestRecord>(TABLES.HARVEST_RECORDS, farmIds),
    enabled: farmIds.length > 0,
  });
}

export function useCreateHarvestRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: HarvestRecordInsert) =>
      createFarmRecord<HarvestRecord, HarvestRecordInsert>(TABLES.HARVEST_RECORDS, record),
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
    mutationFn: ({ id, updates }: { id: number; updates: Partial<HarvestRecord> }) =>
      updateFarmRecord<HarvestRecord>(TABLES.HARVEST_RECORDS, id, updates),
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
    mutationFn: ({ id }: { id: number; farmId: number }) =>
      deleteFarmRecord(TABLES.HARVEST_RECORDS, id),
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
    queryFn: () => listFarmRecords<ExpenseRecord>(TABLES.EXPENSE_RECORDS, farmId!, seasonId),
    enabled: !!farmId,
  });
}

export function useExpenseRecordsByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.expenseRecords.listByFarms(farmIds),
    queryFn: () => listFarmRecordsByFarms<ExpenseRecord>(TABLES.EXPENSE_RECORDS, farmIds),
    enabled: farmIds.length > 0,
  });
}

export function useCreateExpenseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: ExpenseRecordInsert) =>
      createFarmRecord<ExpenseRecord, ExpenseRecordInsert>(TABLES.EXPENSE_RECORDS, record),
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
    mutationFn: ({ id, updates }: { id: number; updates: Partial<ExpenseRecord> }) =>
      updateFarmRecord<ExpenseRecord>(TABLES.EXPENSE_RECORDS, id, updates),
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
    mutationFn: ({ id }: { id: number; farmId: number }) =>
      deleteFarmRecord(TABLES.EXPENSE_RECORDS, id),
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

export async function fetchDailyNoteByDate(
  farmId: number,
  date: string,
): Promise<DailyNoteRecord | null> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_NOTES)
    .select('*')
    .eq('farm_id', farmId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

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

export function useDailyNotes(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.dailyNotes.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<DailyNoteRecord[]> => {
      let query = supabase
        .from(TABLES.DAILY_NOTES)
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

export function useDailyNotesByFarms(farmIds: number[]) {
  const sortedFarmIds = [...farmIds].sort((a, b) => a - b);

  return useQuery({
    queryKey: [...queryKeys.dailyNotes.lists(), { farmIds: sortedFarmIds }],
    queryFn: async (): Promise<DailyNoteRecord[]> => {
      if (sortedFarmIds.length === 0) return [];

      const { data, error } = await supabase
        .from(TABLES.DAILY_NOTES)
        .select('*')
        .in('farm_id', sortedFarmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: sortedFarmIds.length > 0,
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
      notes: string | null;
    }): Promise<DailyNoteRecord> => {
      const seasonId = await resolveOptionalSeasonIdForDate({ farmId: farm_id, date });
      const { data, error } = await supabase
        .from(TABLES.DAILY_NOTES)
        .upsert(
          {
            farm_id,
            season_id: seasonId,
            date,
            notes: notes === null ? null : notes.trim(),
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
        queryKey: queryKeys.dailyNotes.lists(),
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

export function useDeleteDailyNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      farmId,
      date,
    }: {
      id: number;
      farmId: number;
      date: string;
    }): Promise<void> => {
      // Notes are uniquely keyed by farm_id+date; when the caller has no real id
      // (id === 0 for notes saved via the receipt screen) fall back to that key.
      let query = supabase.from(TABLES.DAILY_NOTES).delete().eq('farm_id', farmId);
      if (id > 0) {
        query = query.eq('id', id);
      } else {
        query = query.eq('date', date);
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_, { farmId, date }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.listByFarm(farmId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.byDate(farmId, date),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dailyNotes.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}

export interface RecentInputItem {
  name: string;
  unit: string;
  quantity?: number | null;
}

function dedupeRecentItems(items: RecentInputItem[], limit = 12): RecentInputItem[] {
  const seen = new Set<string>();
  const result: RecentInputItem[] = [];
  for (const item of items) {
    const key = `${item.name.trim().toLowerCase()}::${item.unit.trim().toLowerCase()}`;
    if (!item.name.trim() || !item.unit.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function parseSprayChemicalString(value: string | null | undefined): RecentInputItem[] {
  if (!value) return [];
  const matches = [
    ...value.matchAll(/(?:^|,\s*)(.+?)\s+\((\d+(?:\.\d+)?)\s+([^)]+)\)(?=\s*(?:,|$))/g),
  ];
  if (matches.length > 0) {
    return matches.map((match) => {
      const parsedQuantity = Number.parseFloat(match[2] ?? '');
      return {
        name: match[1]?.trim() ?? '',
        quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : null,
        unit: match[3]?.trim() ?? '',
      };
    });
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ name, unit: 'gm/L', quantity: null }));
}

export function useRecentSprayChemicals(farmId?: number, limit = 12) {
  return useQuery({
    queryKey: [...queryKeys.sprayRecords.lists(), 'recent_chemicals', { farmId: farmId ?? null }],
    queryFn: async (): Promise<RecentInputItem[]> => {
      let query = supabase
        .from(TABLES.SPRAY_RECORDS)
        .select('chemical,date,chemical_items')
        .order('date', { ascending: false })
        .limit(80);

      if (farmId !== undefined) {
        query = query.eq('farm_id', farmId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const parsed = (data ?? []).flatMap((row) => {
        const chemicalItems = row.chemical_items as
          | Array<{ name?: string; unit?: string; quantity?: number | null }>
          | null
          | undefined;
        if (chemicalItems && chemicalItems.length > 0) {
          return chemicalItems.map((item) => ({
            name: item.name?.trim() ?? '',
            unit: item.unit?.trim() ?? '',
            quantity:
              typeof item.quantity === 'number' && Number.isFinite(item.quantity)
                ? item.quantity
                : null,
          }));
        }
        return parseSprayChemicalString(row.chemical);
      });
      return dedupeRecentItems(parsed, limit);
    },
  });
}

export function useRecentFertigationItems(farmId?: number, limit = 12) {
  return useQuery({
    queryKey: [
      ...queryKeys.fertigationRecords.lists(),
      'recent_fertilizers',
      { farmId: farmId ?? null },
    ],
    queryFn: async (): Promise<RecentInputItem[]> => {
      let query = supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .select('fertilizers,date')
        .order('date', { ascending: false })
        .limit(80);

      if (farmId !== undefined) {
        query = query.eq('farm_id', farmId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const parsed: RecentInputItem[] = [];
      for (const row of data ?? []) {
        const fertilizers = row.fertilizers as FertilizerItem[] | null;
        for (const fertilizer of fertilizers ?? []) {
          parsed.push({
            name: fertilizer.name.trim(),
            unit: fertilizer.unit.trim(),
            quantity: fertilizer.quantity ?? null,
          });
        }
      }
      return dedupeRecentItems(parsed, limit);
    },
  });
}
