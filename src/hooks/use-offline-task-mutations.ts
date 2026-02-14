/**
 * Offline Task Mutation Hooks
 *
 * PowerSync-backed write hooks for task reminders. Writes go directly to
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
import type { TaskReminder, TaskReminderInsert, TaskReminderUpdate } from '../types/task';

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
// MARK: - Task Mutations
// ============================================================

export function useOfflineCreateTask() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (task: TaskReminderInsert): Promise<TaskReminder> => {
      const userId = await getUserId();
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const id = generateUUID();
        await db.execute(
          `INSERT INTO task_reminders (id, farm_id, season_id, title, description, type, status, priority, due_date, estimated_duration_minutes, location, completed, completed_at, assigned_to_user_id, created_by, linked_record_type, linked_record_id, planned_inputs, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            String(task.farm_id),
            task.season_id != null ? String(task.season_id) : null,
            task.title,
            task.description ?? null,
            task.type,
            task.status,
            task.priority,
            task.due_date ?? null,
            task.estimated_duration_minutes ?? null,
            task.location ?? null,
            task.completed ? 1 : 0,
            task.completed_at ?? null,
            task.assigned_to_user_id ?? null,
            userId,
            task.linked_record_type ?? null,
            task.linked_record_id != null ? String(task.linked_record_id) : null,
            toJsonText(task.planned_inputs),
            now,
            now,
          ],
        );
        return {
          ...task,
          id: Number(id),
          created_by: userId,
          created_at: now,
          updated_at: now,
        } as TaskReminder;
      }

      // Fallback: direct Supabase insert
      const { data, error } = await supabase
        .from('task_reminders')
        .insert({ ...task, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}

export function useOfflineUpdateTask() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async ({ id, updates }: { id: number; updates: TaskReminderUpdate }): Promise<TaskReminder> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        const fields: Record<string, unknown> = { ...updates, updated_at: now };

        // Convert special fields
        if ('completed' in fields) {
          fields.completed = fields.completed ? 1 : 0;
        }
        if ('planned_inputs' in fields) {
          fields.planned_inputs = toJsonText(fields.planned_inputs);
        }
        if ('linked_record_id' in fields && fields.linked_record_id != null) {
          fields.linked_record_id = String(fields.linked_record_id);
        }
        if ('season_id' in fields && fields.season_id != null) {
          fields.season_id = String(fields.season_id);
        }

        const setClauses = Object.keys(fields)
          .map((key) => `${key} = ?`)
          .join(', ');
        const values = [...Object.values(fields), String(id)];

        await db.execute(`UPDATE task_reminders SET ${setClauses} WHERE id = ?`, values);

        return { id, ...updates, updated_at: now } as unknown as TaskReminder;
      }

      // Fallback: direct Supabase update
      const { data, error } = await supabase
        .from('task_reminders')
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

export function useOfflineCompleteTask() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (id: number): Promise<TaskReminder> => {
      const now = new Date().toISOString();

      if (db && powerSyncAvailable) {
        await db.execute(
          'UPDATE task_reminders SET status = ?, completed = ?, completed_at = ?, updated_at = ? WHERE id = ?',
          ['completed', 1, now, now, String(id)],
        );
        return {
          id,
          status: 'completed',
          completed: true,
          completed_at: now,
          updated_at: now,
        } as unknown as TaskReminder;
      }

      // Fallback: direct Supabase update
      const { data, error } = await supabase
        .from('task_reminders')
        .update({
          status: 'completed',
          completed: true,
          completed_at: now,
        })
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

export function useOfflineDeleteTask() {
  const { db, powerSyncAvailable } = usePowerSyncDb();

  const mutateAsync = useCallback(
    async (id: number): Promise<void> => {
      if (db && powerSyncAvailable) {
        await db.execute('DELETE FROM task_reminders WHERE id = ?', [String(id)]);
        return;
      }

      const { error } = await supabase.from('task_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    [db, powerSyncAvailable],
  );

  return { mutateAsync };
}
