/**
 * Offline Record Mutation Hooks
 *
 * PowerSync-backed write hooks for farm records (irrigation, spray,
 * fertigation, harvest, expense, daily notes). Writes go directly to
 * the local PowerSync SQLite database, which then syncs to Supabase
 * via the connector's uploadData method.
 *
 * When PowerSync is not available (web, missing config), falls back to
 * direct Supabase writes.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import { useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import { isPowerSyncConfigured } from '../lib/powersync';
import { supabase } from '../lib/supabase';
import { TABLES } from '../types';
import type {
  IrrigationRecord,
  IrrigationRecordInsert,
  SprayRecord,
  SprayRecordInsert,
  FertigationRecord,
  FertigationRecordInsert,
  HarvestRecord,
  HarvestRecordInsert,
  ExpenseRecord,
  ExpenseRecordInsert,
  DailyNoteRecord,
} from '../types';

// ============================================================
// MARK: - Helpers
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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Safely serialize a value to JSON text for SQLite storage.
 * Returns null for null/undefined values.
 */
function toJsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Helper to get a PowerSync DB instance, returning null if unavailable.
 */
function usePowerSyncDb() {
  const powerSyncAvailable = isPowerSyncConfigured();
  let db: ReturnType<typeof usePowerSync> | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    db = powerSyncAvailable ? usePowerSync() : null;
  } catch {
    db = null;
  }

  return { db, powerSyncAvailable };
}

// ============================================================
// MARK: - Irrigation Record Mutations
// ============================================================

export function useOfflineCreateIrrigationRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (record: IrrigationRecordInsert): Promise<IrrigationRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO irrigation_records (id, farm_id, season_id, date, duration, area, growth_stage, moisture_status, system_discharge, date_of_pruning, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(record.farm_id),
            record.season_id != null ? String(record.season_id) : null,
            record.date,
            record.duration,
            record.area,
            record.growth_stage,
            record.moisture_status,
            record.system_discharge,
            record.date_of_pruning ?? null,
            record.notes ?? null,
            now,
          ],
        );
        return { ...record, id: Number(id), created_at: now } as IrrigationRecord;
      }

      // Fallback: direct Supabase insert
      const { data, error } = await supabase
        .from(TABLES.IRRIGATION_RECORDS)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteIrrigationRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM irrigation_records WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.IRRIGATION_RECORDS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Spray Record Mutations
// ============================================================

export function useOfflineCreateSprayRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (record: SprayRecordInsert): Promise<SprayRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO spray_records (id, farm_id, season_id, date, chemical, chemical_items, dose, nutrient_totals_elemental, nutrient_totals_elemental_per_acre, nutrient_calc_coverage, area, weather, operator, date_of_pruning, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(record.farm_id),
            record.season_id != null ? String(record.season_id) : null,
            record.date,
            record.chemical,
            toJsonText(record.chemical_items),
            record.dose,
            toJsonText(record.nutrient_totals_elemental),
            toJsonText(record.nutrient_totals_elemental_per_acre),
            record.nutrient_calc_coverage ?? null,
            record.area,
            record.weather,
            record.operator,
            record.date_of_pruning ?? null,
            record.notes ?? null,
            now,
          ],
        );
        return { ...record, id: Number(id), created_at: now } as SprayRecord;
      }

      const { data, error } = await supabase
        .from(TABLES.SPRAY_RECORDS)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteSprayRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM spray_records WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.SPRAY_RECORDS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Fertigation Record Mutations
// ============================================================

export function useOfflineCreateFertigationRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (record: FertigationRecordInsert): Promise<FertigationRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO fertigation_records (id, farm_id, season_id, date, fertilizers, water_volume, nutrient_totals_elemental, nutrient_totals_elemental_per_acre, nutrient_calc_coverage, area, date_of_pruning, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(record.farm_id),
            record.season_id != null ? String(record.season_id) : null,
            record.date,
            toJsonText(record.fertilizers),
            record.water_volume ?? null,
            toJsonText(record.nutrient_totals_elemental),
            toJsonText(record.nutrient_totals_elemental_per_acre),
            record.nutrient_calc_coverage ?? null,
            record.area,
            record.date_of_pruning ?? null,
            record.notes ?? null,
            now,
          ],
        );
        return { ...record, id: Number(id), created_at: now } as FertigationRecord;
      }

      const { data, error } = await supabase
        .from(TABLES.FERTIGATION_RECORDS)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteFertigationRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM fertigation_records WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.FERTIGATION_RECORDS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Harvest Record Mutations
// ============================================================

export function useOfflineCreateHarvestRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (record: HarvestRecordInsert): Promise<HarvestRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO harvest_records (id, farm_id, season_id, date, quantity, grade, price, buyer, date_of_pruning, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(record.farm_id),
            record.season_id != null ? String(record.season_id) : null,
            record.date,
            record.quantity,
            record.grade,
            record.price ?? null,
            record.buyer ?? null,
            record.date_of_pruning ?? null,
            record.notes ?? null,
            now,
          ],
        );
        return { ...record, id: Number(id), created_at: now } as HarvestRecord;
      }

      const { data, error } = await supabase
        .from(TABLES.HARVEST_RECORDS)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteHarvestRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM harvest_records WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.HARVEST_RECORDS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Expense Record Mutations
// ============================================================

export function useOfflineCreateExpenseRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (record: ExpenseRecordInsert): Promise<ExpenseRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO expense_records (id, farm_id, season_id, date, type, cost, date_of_pruning, remarks, num_workers, hours_worked, work_type, rate_per_unit, worker_names, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(record.farm_id),
            record.season_id != null ? String(record.season_id) : null,
            record.date,
            record.type,
            record.cost,
            record.date_of_pruning ?? null,
            record.remarks ?? null,
            record.num_workers ?? null,
            record.hours_worked ?? null,
            record.work_type ?? null,
            record.rate_per_unit ?? null,
            record.worker_names ?? null,
            now,
          ],
        );
        return { ...record, id: Number(id), created_at: now } as ExpenseRecord;
      }

      const { data, error } = await supabase
        .from(TABLES.EXPENSE_RECORDS)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteExpenseRecord() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; farmId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM expense_records WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.EXPENSE_RECORDS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Daily Note Mutations
// ============================================================

export function useOfflineUpsertDailyNote() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({
      farm_id,
      date,
      notes,
      season_id,
    }: {
      farm_id: number;
      date: string;
      notes: string;
      season_id?: number | null;
    }): Promise<DailyNoteRecord> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        // Check if a note already exists for this farm+date
        const existing = await db.execute(
          'SELECT id FROM daily_notes WHERE farm_id = ? AND date = ? LIMIT 1',
          [String(farm_id), date],
        );

        if (existing.rows && existing.rows.length > 0) {
          const existingId = existing.rows.item(0).id as string;
          await db.execute(
            'UPDATE daily_notes SET notes = ?, season_id = ?, updated_at = ? WHERE id = ?',
            [notes.trim(), season_id != null ? String(season_id) : null, now, existingId],
          );
          return {
            id: Number(existingId),
            farm_id,
            season_id: season_id ?? null,
            date,
            notes: notes.trim(),
            updated_at: now,
          } as DailyNoteRecord;
        }

        const id = generateUUID();
        await db.execute(
          `INSERT INTO daily_notes (id, farm_id, season_id, date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(farm_id),
            season_id != null ? String(season_id) : null,
            date,
            notes.trim(),
            now,
            now,
          ],
        );
        return {
          id: Number(id),
          farm_id,
          season_id: season_id ?? null,
          date,
          notes: notes.trim(),
          created_at: now,
          updated_at: now,
        } as DailyNoteRecord;
      }

      // Fallback: direct Supabase upsert
      const { data, error } = await supabase
        .from(TABLES.DAILY_NOTES)
        .upsert(
          {
            farm_id,
            season_id: season_id ?? null,
            date,
            notes: notes.trim(),
            updated_at: now,
          },
          { onConflict: 'farm_id,date' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}
