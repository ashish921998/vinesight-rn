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
  type QuantityBasis,
} from '../types';
import { resolveOrCreateSeasonIdForDate } from '../lib/season-context';

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
        (await resolveOrCreateSeasonIdForDate({
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
        (await resolveOrCreateSeasonIdForDate({
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
        (await resolveOrCreateSeasonIdForDate({
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
        (await resolveOrCreateSeasonIdForDate({
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
        (await resolveOrCreateSeasonIdForDate({
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
      const seasonId = await resolveOrCreateSeasonIdForDate({ farmId: farm_id, date });
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
  quantityBasis?: QuantityBasis;
  catalogProductId?: number | null;
  warehouseItemId?: number | null;
  /** Spray rows only: record-level mix this item was logged as part of. */
  catalogMixId?: number | null;
}

/**
 * Dedupes most-recent-first. Rows carrying an identity id (catalog product,
 * else warehouse item) collapse by that id — two logs of the same product stay
 * one row even if the display name drifted. Rows without one keep the legacy
 * normalized name+unit dedupe, and a shared name still collapses across the
 * two groups so an identity row and a legacy row never show up twice.
 */
export function dedupeRecentItems(items: RecentInputItem[], limit = 12): RecentInputItem[] {
  const seenIdentityKeys = new Set<string>();
  const seenNameKeys = new Set<string>();
  const seenIdentitylessNameKeys = new Set<string>();
  const result: RecentInputItem[] = [];
  for (const item of items) {
    if (!item.name.trim() || !item.unit.trim()) continue;
    const nameKey = `${item.name.trim().toLowerCase()}::${item.unit.trim().toLowerCase()}`;
    const identityKey =
      item.catalogProductId != null
        ? `catalog:${item.catalogProductId}`
        : item.warehouseItemId != null
          ? `warehouse:${item.warehouseItemId}`
          : null;
    if (identityKey) {
      if (seenIdentityKeys.has(identityKey) || seenIdentitylessNameKeys.has(nameKey)) continue;
      seenIdentityKeys.add(identityKey);
    } else {
      if (seenNameKeys.has(nameKey)) continue;
      seenIdentitylessNameKeys.add(nameKey);
    }
    seenNameKeys.add(nameKey);
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

/**
 * Defensive view of one stored `chemical_items` JSON row: legacy records may
 * miss any field, so nothing beyond the shape itself is assumed.
 */
interface StoredSprayChemicalItem {
  name?: string;
  unit?: string;
  quantity?: number | null;
  quantity_basis?: QuantityBasis;
  catalog_product_id?: number | null;
  warehouse_item_id?: number | null;
}

/** Subset of a spray record row fetched by the recents query. */
export interface RecentSprayRecordRow {
  chemical?: string | null;
  chemical_items?: StoredSprayChemicalItem[] | null;
  catalog_mix_id?: number | null;
}

export function parseRecentSprayRecords(rows: RecentSprayRecordRow[]): RecentInputItem[] {
  return rows.flatMap((row) => {
    // Mix identity lives on the record, not on item rows: stamp it onto every
    // parsed row so a history tap can later prefill the whole mix.
    const catalogMixId = row.catalog_mix_id;
    const chemicalItems = row.chemical_items;
    if (chemicalItems && chemicalItems.length > 0) {
      return chemicalItems.map((item) => ({
        name: item.name?.trim() ?? '',
        unit: item.unit?.trim() ?? '',
        quantity:
          typeof item.quantity === 'number' && Number.isFinite(item.quantity)
            ? item.quantity
            : null,
        quantityBasis: item.quantity_basis,
        catalogProductId: item.catalog_product_id,
        warehouseItemId: item.warehouse_item_id,
        catalogMixId,
      }));
    }
    return parseSprayChemicalString(row.chemical).map((item) => ({ ...item, catalogMixId }));
  });
}

export function useRecentSprayChemicals(farmId?: number, limit = 12) {
  return useQuery({
    queryKey: [...queryKeys.sprayRecords.lists(), 'recent_chemicals', { farmId: farmId ?? null }],
    queryFn: async (): Promise<RecentInputItem[]> => {
      let query = supabase
        .from(TABLES.SPRAY_RECORDS)
        .select('chemical,date,chemical_items,catalog_mix_id')
        .order('date', { ascending: false })
        .limit(80);

      if (farmId !== undefined) {
        query = query.eq('farm_id', farmId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return dedupeRecentItems(
        parseRecentSprayRecords((data ?? []) as RecentSprayRecordRow[]),
        limit,
      );
    },
  });
}

/** Subset of a fertigation record row fetched by the recents query. */
export interface RecentFertigationRecordRow {
  fertilizers?: FertilizerItem[] | null;
}

export function parseRecentFertigationRecords(
  rows: RecentFertigationRecordRow[],
): RecentInputItem[] {
  const parsed: RecentInputItem[] = [];
  for (const row of rows) {
    for (const fertilizer of row.fertilizers ?? []) {
      parsed.push({
        name: fertilizer.name.trim(),
        unit: fertilizer.unit.trim(),
        quantity: fertilizer.quantity ?? null,
        quantityBasis: fertilizer.quantity_basis,
        catalogProductId: fertilizer.catalog_product_id,
        warehouseItemId: fertilizer.warehouse_item_id,
      });
    }
  }
  return parsed;
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

      return dedupeRecentItems(
        parseRecentFertigationRecords((data ?? []) as RecentFertigationRecordRow[]),
        limit,
      );
    },
  });
}
