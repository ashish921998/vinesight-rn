/**
 * PowerSync Tasks Hook
 *
 * Offline-first alternative to use-tasks.ts that reads from the local
 * PowerSync SQLite database instead of making network requests to Supabase.
 *
 * Benefits:
 * - Instant reads from local database (no network latency)
 * - Works fully offline - field workers can view tasks without connectivity
 * - Automatically syncs with Supabase when online
 *
 * Migration guide:
 * - Replace `useTasks(farmId)` with `usePowerSyncTasks(farmId)` for offline-first reads
 * - Replace `useAllTasks()` with `usePowerSyncAllTasks()` for offline-first reads
 * - Mutations still go through the existing Supabase hooks
 *
 * @see src/hooks/use-tasks.ts for the original Supabase-direct implementation
 */

import { useQuery } from '@tanstack/react-query';
import { powerSyncDb } from '@/lib/powersync';
import { taskQueryKeys } from './use-tasks';
import type { TaskReminder } from '@/types/task';

// ============================================================
// MARK: - PowerSync Task Queries
// ============================================================

/**
 * Fetch tasks for a specific farm from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useTasks(farmId, seasonId)`.
 */
export function usePowerSyncTasks(farmId?: number, seasonId?: number) {
  return useQuery({
    queryKey: farmId
      ? [...taskQueryKeys.listByFarm(farmId), { seasonId: seasonId ?? null }, 'powersync']
      : [...taskQueryKeys.lists(), { seasonId: seasonId ?? null }, 'powersync'],
    queryFn: async (): Promise<TaskReminder[]> => {
      let sql = 'SELECT * FROM task_reminders';
      const params: (string | number)[] = [];
      const conditions: string[] = [];

      if (farmId) {
        conditions.push('farm_id = ?');
        params.push(String(farmId));
      }

      if (seasonId !== undefined) {
        conditions.push('season_id = ?');
        params.push(String(seasonId));
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY due_date ASC';

      const results = await powerSyncDb.getAll<TaskReminder>(sql, params);

      // Parse JSON fields that are stored as text in SQLite
      return results.map((task) => ({
        ...task,
        completed: Boolean(task.completed),
        planned_inputs:
          typeof task.planned_inputs === 'string'
            ? JSON.parse(task.planned_inputs)
            : task.planned_inputs,
      }));
    },
  });
}

/**
 * Fetch all tasks across all farms from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useAllTasks(seasonId)`.
 */
export function usePowerSyncAllTasks(seasonId?: number) {
  return useQuery({
    queryKey: [...taskQueryKeys.lists(), { seasonId: seasonId ?? null }, 'powersync'],
    queryFn: async (): Promise<TaskReminder[]> => {
      let sql = 'SELECT * FROM task_reminders';
      const params: (string | number)[] = [];

      if (seasonId !== undefined) {
        sql += ' WHERE season_id = ?';
        params.push(String(seasonId));
      }

      sql += ' ORDER BY due_date ASC';

      const results = await powerSyncDb.getAll<TaskReminder>(sql, params);

      return results.map((task) => ({
        ...task,
        completed: Boolean(task.completed),
        planned_inputs:
          typeof task.planned_inputs === 'string'
            ? JSON.parse(task.planned_inputs)
            : task.planned_inputs,
      }));
    },
  });
}
