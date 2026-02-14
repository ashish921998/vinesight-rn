/**
 * Offline Worker Mutation Hooks
 *
 * PowerSync-backed write hooks for workers, attendance, transactions,
 * and settlements. Writes go directly to the local PowerSync SQLite
 * database, which then syncs to Supabase via the connector.
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
  Worker,
  WorkerInsert,
  WorkerUpdate,
  WorkerAttendance,
  WorkerAttendanceInsert,
  WorkerTransaction,
  WorkerTransactionInsert,
  TemporaryWorkerEntry,
  TemporaryWorkerEntryInsert,
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

function toJsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

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
// MARK: - Worker Mutations
// ============================================================

export function useOfflineCreateWorker() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (worker: WorkerInsert): Promise<Worker> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO workers (id, user_id, name, daily_rate, advance_balance, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            userId,
            worker.name,
            worker.daily_rate,
            worker.advance_balance,
            worker.is_active ? 1 : 0,
            now,
            now,
          ],
        );
        return {
          ...worker,
          id: Number(id),
          user_id: userId,
          created_at: now,
          updated_at: now,
        } as Worker;
      }

      const { data, error } = await supabase
        .from(TABLES.WORKERS)
        .insert({ ...worker, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineUpdateWorker() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id, updates }: { id: number; updates: WorkerUpdate }): Promise<Worker> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const fields: Record<string, unknown> = { ...updates, updated_at: now };
        if ('is_active' in fields) {
          fields.is_active = fields.is_active ? 1 : 0;
        }

        const setClauses = Object.keys(fields)
          .map((key) => `${key} = ?`)
          .join(', ');
        const values = [...Object.values(fields), String(id)];

        await db.execute(`UPDATE workers SET ${setClauses} WHERE id = ?`, values);
        return { id, ...updates, updated_at: now } as unknown as Worker;
      }

      const { data, error } = await supabase
        .from(TABLES.WORKERS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteWorker() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (id: number): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM workers WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.WORKERS).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Worker Attendance Mutations
// ============================================================

export function useOfflineCreateWorkerAttendance() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (attendance: WorkerAttendanceInsert): Promise<WorkerAttendance> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO worker_attendance (id, worker_id, farm_ids, date, work_status, work_type, daily_rate_override, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(attendance.worker_id),
            toJsonText(attendance.farm_ids),
            attendance.date,
            attendance.work_status,
            attendance.work_type,
            attendance.daily_rate_override ?? null,
            attendance.notes ?? null,
            now,
            now,
          ],
        );
        return {
          ...attendance,
          id: Number(id),
          created_at: now,
          updated_at: now,
        } as WorkerAttendance;
      }

      const { data, error } = await supabase
        .from(TABLES.WORKER_ATTENDANCE)
        .insert(attendance)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteWorkerAttendance() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id }: { id: number; workerId: number }): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM worker_attendance WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from(TABLES.WORKER_ATTENDANCE).delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Worker Transaction Mutations
// ============================================================

export function useOfflineCreateWorkerTransaction() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (transaction: WorkerTransactionInsert): Promise<WorkerTransaction> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO worker_transactions (id, worker_id, farm_id, date, type, amount, settlement_id, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(transaction.worker_id),
            transaction.farm_id != null ? String(transaction.farm_id) : null,
            transaction.date,
            transaction.type,
            transaction.amount,
            transaction.settlement_id != null ? String(transaction.settlement_id) : null,
            transaction.notes ?? null,
            now,
          ],
        );
        return {
          ...transaction,
          id: Number(id),
          created_at: now,
        } as WorkerTransaction;
      }

      const { data, error } = await supabase
        .from(TABLES.WORKER_TRANSACTIONS)
        .insert(transaction)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

// ============================================================
// MARK: - Temporary Worker Entry Mutations
// ============================================================

export function useOfflineCreateTemporaryWorkerEntry() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (entry: TemporaryWorkerEntryInsert): Promise<TemporaryWorkerEntry> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO temporary_worker_entries (id, farm_id, season_id, user_id, date, name, hours_worked, amount_paid, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(entry.farm_id),
            entry.season_id != null ? String(entry.season_id) : null,
            userId,
            entry.date,
            entry.name,
            entry.hours_worked,
            entry.amount_paid,
            entry.notes ?? null,
            now,
            now,
          ],
        );
        return {
          ...entry,
          id: Number(id),
          user_id: userId,
          created_at: now,
          updated_at: now,
        } as TemporaryWorkerEntry;
      }

      const { data, error } = await supabase
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .insert({ ...entry, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineDeleteTemporaryWorkerEntry() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (id: number): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM temporary_worker_entries WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}
