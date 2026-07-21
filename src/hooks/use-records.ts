/**
 * Records Hooks
 * React Query hooks for farm record CRUD operations
 * Covers: Irrigation, Spray, Fertigation, Harvest, Expense, Daily Note records
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
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
import { makeRecordWriteHooks } from '../features/offline/record-hooks-factory';

// ============================================================
// MARK: - IRRIGATION RECORDS
// ============================================================

export function useIrrigationRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.irrigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<IrrigationRecord[]> => {
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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

const irrigationWriteHooks = makeRecordWriteHooks<IrrigationRecord, IrrigationRecordInsert>({
  table: TABLES.IRRIGATION_RECORDS,
  keys: queryKeys.irrigationRecords,
  invalidateListsOnCreate: true,
});
export const useCreateIrrigationRecord = irrigationWriteHooks.useCreate;
export const useUpdateIrrigationRecord = irrigationWriteHooks.useUpdate;
export const useDeleteIrrigationRecord = irrigationWriteHooks.useDelete;

// ============================================================
// MARK: - SPRAY RECORDS
// ============================================================

export function useSprayRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.sprayRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<SprayRecord[]> => {
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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

const sprayWriteHooks = makeRecordWriteHooks<SprayRecord, SprayRecordInsert>({
  table: TABLES.SPRAY_RECORDS,
  keys: queryKeys.sprayRecords,
});
export const useCreateSprayRecord = sprayWriteHooks.useCreate;
export const useUpdateSprayRecord = sprayWriteHooks.useUpdate;
export const useDeleteSprayRecord = sprayWriteHooks.useDelete;

// ============================================================
// MARK: - FERTIGATION RECORDS
// ============================================================

export function useFertigationRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.fertigationRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<FertigationRecord[]> => {
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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

const fertigationWriteHooks = makeRecordWriteHooks<FertigationRecord, FertigationRecordInsert>({
  table: TABLES.FERTIGATION_RECORDS,
  keys: queryKeys.fertigationRecords,
});
export const useCreateFertigationRecord = fertigationWriteHooks.useCreate;
export const useUpdateFertigationRecord = fertigationWriteHooks.useUpdate;
export const useDeleteFertigationRecord = fertigationWriteHooks.useDelete;

// ============================================================
// MARK: - HARVEST RECORDS
// ============================================================

export function useHarvestRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.harvestRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<HarvestRecord[]> => {
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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

const harvestWriteHooks = makeRecordWriteHooks<HarvestRecord, HarvestRecordInsert>({
  table: TABLES.HARVEST_RECORDS,
  keys: queryKeys.harvestRecords,
});
export const useCreateHarvestRecord = harvestWriteHooks.useCreate;
export const useUpdateHarvestRecord = harvestWriteHooks.useUpdate;
export const useDeleteHarvestRecord = harvestWriteHooks.useDelete;

// ============================================================
// MARK: - EXPENSE RECORDS
// ============================================================

export function useExpenseRecords(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [...queryKeys.expenseRecords.listByFarm(farmId!), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<ExpenseRecord[]> => {
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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

const expenseWriteHooks = makeRecordWriteHooks<ExpenseRecord, ExpenseRecordInsert>({
  table: TABLES.EXPENSE_RECORDS,
  keys: queryKeys.expenseRecords,
});
export const useCreateExpenseRecord = expenseWriteHooks.useCreate;
export const useUpdateExpenseRecord = expenseWriteHooks.useUpdate;
export const useDeleteExpenseRecord = expenseWriteHooks.useDelete;

// ============================================================
// MARK: - DAILY NOTES
// ============================================================

export async function fetchDailyNoteByDate(
  farmId: number,
  date: string,
): Promise<DailyNoteRecord | null> {
  const { data, error } = await getDataAccess()
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
      const { data, error } = await getDataAccess()
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
      let query = getDataAccess()
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

      const { data, error } = await getDataAccess()
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
      const { data, error } = await getDataAccess()
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
      let query = getDataAccess().from(TABLES.DAILY_NOTES).delete().eq('farm_id', farmId);
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
 * normalized name+unit dedupe. Cross-group suppression is NAME-ONLY (unit
 * ignored): identity dedupe itself ignores unit, so a legacy "Urea liter/acre"
 * must also collapse against an identity "Urea kg/acre" — an identity row and
 * a legacy row sharing a name never render twice, whatever their units.
 */
export function dedupeRecentItems(items: RecentInputItem[], limit = 12): RecentInputItem[] {
  const seenIdentityKeys = new Set<string>();
  const seenLegacyPairKeys = new Set<string>();
  const seenIdentityNames = new Set<string>();
  const seenLegacyNames = new Set<string>();
  const result: RecentInputItem[] = [];
  for (const item of items) {
    if (!item.name.trim() || !item.unit.trim()) continue;
    const nameOnlyKey = item.name.trim().toLowerCase();
    const pairKey = `${nameOnlyKey}::${item.unit.trim().toLowerCase()}`;
    const identityKey =
      item.catalogProductId != null
        ? `catalog:${item.catalogProductId}`
        : item.warehouseItemId != null
          ? `warehouse:${item.warehouseItemId}`
          : null;
    if (identityKey) {
      if (seenIdentityKeys.has(identityKey) || seenLegacyNames.has(nameOnlyKey)) continue;
      seenIdentityKeys.add(identityKey);
      seenIdentityNames.add(nameOnlyKey);
    } else {
      if (seenLegacyPairKeys.has(pairKey) || seenIdentityNames.has(nameOnlyKey)) continue;
      seenLegacyPairKeys.add(pairKey);
      seenLegacyNames.add(nameOnlyKey);
    }
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

/**
 * Legacy rows must keep their exact `{ name, unit, quantity }` shape — no
 * enumerable `undefined` identity keys. An explicit `undefined` would clobber
 * defaults in any `{ ...defaults, ...recentItem }` consumer, so identity/mix
 * fields are only attached when the source actually carries them (stored
 * `null` still passes through as `null`).
 */
function attachIdentity(base: RecentInputItem, source: StoredSprayChemicalItem): RecentInputItem {
  if (source.quantity_basis !== undefined) base.quantityBasis = source.quantity_basis;
  if (source.catalog_product_id !== undefined) base.catalogProductId = source.catalog_product_id;
  if (source.warehouse_item_id !== undefined) base.warehouseItemId = source.warehouse_item_id;
  return base;
}

export function parseRecentSprayRecords(rows: RecentSprayRecordRow[]): RecentInputItem[] {
  return rows.flatMap((row) => {
    // Mix identity lives on the record, not on item rows: stamp it onto every
    // parsed row so a history tap can later prefill the whole mix. The select
    // always returns the column, so only a real (non-null) mix id is attached.
    const catalogMixId = row.catalog_mix_id;
    const stampMix = (item: RecentInputItem): RecentInputItem => {
      if (catalogMixId != null) item.catalogMixId = catalogMixId;
      return item;
    };
    const chemicalItems = row.chemical_items;
    if (chemicalItems && chemicalItems.length > 0) {
      return chemicalItems.map((item) =>
        stampMix(
          attachIdentity(
            {
              name: item.name?.trim() ?? '',
              unit: item.unit?.trim() ?? '',
              quantity:
                typeof item.quantity === 'number' && Number.isFinite(item.quantity)
                  ? item.quantity
                  : null,
            },
            item,
          ),
        ),
      );
    }
    return parseSprayChemicalString(row.chemical).map((item) => stampMix(item));
  });
}

export function useRecentSprayChemicals(farmId?: number, limit = 12) {
  return useQuery({
    queryKey: [...queryKeys.sprayRecords.lists(), 'recent_chemicals', { farmId: farmId ?? null }],
    queryFn: async (): Promise<RecentInputItem[]> => {
      let query = getDataAccess()
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
      const base: RecentInputItem = {
        name: fertilizer.name.trim(),
        unit: fertilizer.unit.trim(),
        quantity: fertilizer.quantity ?? null,
      };
      // Same legacy-shape rule as spray rows: identity keys only when present.
      if (fertilizer.quantity_basis !== undefined) base.quantityBasis = fertilizer.quantity_basis;
      if (fertilizer.catalog_product_id !== undefined)
        base.catalogProductId = fertilizer.catalog_product_id;
      if (fertilizer.warehouse_item_id !== undefined)
        base.warehouseItemId = fertilizer.warehouse_item_id;
      parsed.push(base);
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
      let query = getDataAccess()
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
