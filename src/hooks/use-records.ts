/**
 * Records Hooks
 * React Query hooks for farm record CRUD operations
 * Covers: Irrigation, Spray, Fertigation, Harvest, Expense, Daily Note records
 *
 * Phase 2: Read queries use PowerSync local SQLite DB for instant offline reads.
 * Write mutations still go through Supabase REST API (Phase 3).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePowerSyncDb } from '../lib/powersync/db';
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
import { resolveSeasonIdForDate } from '../lib/season-context';

// ============================================================
// MARK: - IRRIGATION RECORDS
// ============================================================

/**
 * Fetch irrigation records for a farm.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useIrrigationRecords(farmId: number | undefined, seasonId?: number) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.irrigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<IrrigationRecord[]> => {
      if (db) {
        const sql =
          seasonId !== undefined
            ? `SELECT * FROM irrigation_records WHERE farm_id = ? AND season_id = ? ORDER BY date DESC`
            : `SELECT * FROM irrigation_records WHERE farm_id = ? ORDER BY date DESC`;
        const params = seasonId !== undefined ? [farmId, seasonId] : [farmId];
        return db.getAll<IrrigationRecord>(sql, params);
      }

      // Fallback: Supabase REST
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

/**
 * Fetch irrigation records across multiple farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useIrrigationRecordsByFarms(farmIds: number[]) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.irrigationRecords.listByFarms(farmIds),
    queryFn: async (): Promise<IrrigationRecord[]> => {
      if (farmIds.length === 0) return [];

      if (db) {
        const placeholders = farmIds.map(() => '?').join(',');
        return db.getAll<IrrigationRecord>(
          `SELECT * FROM irrigation_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC`,
          farmIds,
        );
      }

      // Fallback: Supabase REST
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

/**
 * Fetch spray records for a farm.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useSprayRecords(farmId: number | undefined, seasonId?: number) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.sprayRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<SprayRecord[]> => {
      if (db) {
        const sql =
          seasonId !== undefined
            ? `SELECT * FROM spray_records WHERE farm_id = ? AND season_id = ? ORDER BY date DESC`
            : `SELECT * FROM spray_records WHERE farm_id = ? ORDER BY date DESC`;
        const params = seasonId !== undefined ? [farmId, seasonId] : [farmId];
        return db.getAll<SprayRecord>(sql, params);
      }

      // Fallback: Supabase REST
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

/**
 * Fetch spray records across multiple farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useSprayRecordsByFarms(farmIds: number[]) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.sprayRecords.listByFarms(farmIds),
    queryFn: async (): Promise<SprayRecord[]> => {
      if (farmIds.length === 0) return [];

      if (db) {
        const placeholders = farmIds.map(() => '?').join(',');
        return db.getAll<SprayRecord>(
          `SELECT * FROM spray_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC`,
          farmIds,
        );
      }

      // Fallback: Supabase REST
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

/**
 * Fetch fertigation records for a farm.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useFertigationRecords(farmId: number | undefined, seasonId?: number) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.fertigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<FertigationRecord[]> => {
      if (db) {
        const sql =
          seasonId !== undefined
            ? `SELECT * FROM fertigation_records WHERE farm_id = ? AND season_id = ? ORDER BY date DESC`
            : `SELECT * FROM fertigation_records WHERE farm_id = ? ORDER BY date DESC`;
        const params = seasonId !== undefined ? [farmId, seasonId] : [farmId];
        return db.getAll<FertigationRecord>(sql, params);
      }

      // Fallback: Supabase REST
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

/**
 * Fetch fertigation records across multiple farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useFertigationRecordsByFarms(farmIds: number[]) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.fertigationRecords.listByFarms(farmIds),
    queryFn: async (): Promise<FertigationRecord[]> => {
      if (farmIds.length === 0) return [];

      if (db) {
        const placeholders = farmIds.map(() => '?').join(',');
        return db.getAll<FertigationRecord>(
          `SELECT * FROM fertigation_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC`,
          farmIds,
        );
      }

      // Fallback: Supabase REST
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

/**
 * Fetch harvest records for a farm.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useHarvestRecords(farmId: number | undefined, seasonId?: number) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.harvestRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<HarvestRecord[]> => {
      if (db) {
        const sql =
          seasonId !== undefined
            ? `SELECT * FROM harvest_records WHERE farm_id = ? AND season_id = ? ORDER BY date DESC`
            : `SELECT * FROM harvest_records WHERE farm_id = ? ORDER BY date DESC`;
        const params = seasonId !== undefined ? [farmId, seasonId] : [farmId];
        return db.getAll<HarvestRecord>(sql, params);
      }

      // Fallback: Supabase REST
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

/**
 * Fetch harvest records across multiple farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useHarvestRecordsByFarms(farmIds: number[]) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.harvestRecords.listByFarms(farmIds),
    queryFn: async (): Promise<HarvestRecord[]> => {
      if (farmIds.length === 0) return [];

      if (db) {
        const placeholders = farmIds.map(() => '?').join(',');
        return db.getAll<HarvestRecord>(
          `SELECT * FROM harvest_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC`,
          farmIds,
        );
      }

      // Fallback: Supabase REST
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

/**
 * Fetch expense records for a farm.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useExpenseRecords(farmId: number | undefined, seasonId?: number) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.expenseRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<ExpenseRecord[]> => {
      if (db) {
        const sql =
          seasonId !== undefined
            ? `SELECT * FROM expense_records WHERE farm_id = ? AND season_id = ? ORDER BY date DESC`
            : `SELECT * FROM expense_records WHERE farm_id = ? ORDER BY date DESC`;
        const params = seasonId !== undefined ? [farmId, seasonId] : [farmId];
        return db.getAll<ExpenseRecord>(sql, params);
      }

      // Fallback: Supabase REST
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

/**
 * Fetch expense records across multiple farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useExpenseRecordsByFarms(farmIds: number[]) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.expenseRecords.listByFarms(farmIds),
    queryFn: async (): Promise<ExpenseRecord[]> => {
      if (farmIds.length === 0) return [];

      if (db) {
        const placeholders = farmIds.map(() => '?').join(',');
        return db.getAll<ExpenseRecord>(
          `SELECT * FROM expense_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC`,
          farmIds,
        );
      }

      // Fallback: Supabase REST
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

/**
 * Fetch a daily note for a specific farm and date.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useDailyNoteByDate(farmId: number | undefined, date: string | undefined) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.dailyNotes.byDate(farmId!, date!),
    queryFn: async (): Promise<DailyNoteRecord | null> => {
      if (db) {
        const row = await db.getOptional<DailyNoteRecord>(
          `SELECT * FROM daily_notes WHERE farm_id = ? AND date = ?`,
          [farmId, date],
        );
        return row ?? null;
      }

      // Fallback: Supabase REST
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

/**
 * Fetch recent spray chemicals for autocomplete.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useRecentSprayChemicals(farmId?: number, limit = 12) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.sprayRecords.lists(), 'recent_chemicals', { farmId: farmId ?? null }],
    queryFn: async (): Promise<RecentInputItem[]> => {
      if (db) {
        const sql =
          farmId !== undefined
            ? `SELECT chemical, date, chemical_items FROM spray_records WHERE farm_id = ? ORDER BY date DESC LIMIT 80`
            : `SELECT chemical, date, chemical_items FROM spray_records ORDER BY date DESC LIMIT 80`;
        const params = farmId !== undefined ? [farmId] : [];
        const rows = await db.getAll<{
          chemical: string | null;
          date: string;
          chemical_items: string | null;
        }>(sql, params);

        const parsed = rows.flatMap((row) => {
          // chemical_items is stored as JSON TEXT in PowerSync
          let chemicalItems: Array<{
            name?: string;
            unit?: string;
            quantity?: number | null;
          }> | null = null;
          if (row.chemical_items) {
            try {
              chemicalItems = JSON.parse(row.chemical_items);
            } catch {
              // ignore parse errors
            }
          }
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
      }

      // Fallback: Supabase REST
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

/**
 * Fetch recent fertigation items for autocomplete.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useRecentFertigationItems(farmId?: number, limit = 12) {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [
      ...queryKeys.fertigationRecords.lists(),
      'recent_fertilizers',
      { farmId: farmId ?? null },
    ],
    queryFn: async (): Promise<RecentInputItem[]> => {
      if (db) {
        const sql =
          farmId !== undefined
            ? `SELECT fertilizers, date FROM fertigation_records WHERE farm_id = ? ORDER BY date DESC LIMIT 80`
            : `SELECT fertilizers, date FROM fertigation_records ORDER BY date DESC LIMIT 80`;
        const params = farmId !== undefined ? [farmId] : [];
        const rows = await db.getAll<{ fertilizers: string | null; date: string }>(sql, params);

        const parsed: RecentInputItem[] = [];
        for (const row of rows) {
          // fertilizers is stored as JSON TEXT in PowerSync
          let fertilizers: FertilizerItem[] | null = null;
          if (row.fertilizers) {
            try {
              fertilizers = JSON.parse(row.fertilizers);
            } catch {
              // ignore parse errors
            }
          }
          for (const fertilizer of fertilizers ?? []) {
            parsed.push({
              name: fertilizer.name.trim(),
              unit: fertilizer.unit.trim(),
              quantity: fertilizer.quantity ?? null,
            });
          }
        }
        return dedupeRecentItems(parsed, limit);
      }

      // Fallback: Supabase REST
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
