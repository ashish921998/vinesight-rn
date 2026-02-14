/**
 * Task Hooks for Vinesight
 * React Query hooks for task reminders CRUD operations
 *
 * WRITE operations (Phase 3) now go through PowerSync local DB when
 * available, falling back to direct Supabase writes otherwise.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TaskReminder, TaskReminderInsert, TaskReminderUpdate } from '../types/task';
import { formatLocalDate } from '../utils/date';
import { resolveSeasonIdForDate } from '../lib/season-context';
import { encodeTaskPlanInDescription } from '../utils/task-plan';
import { telemetry } from '../services/telemetry';
import {
  useOfflineCreateTask,
  useOfflineUpdateTask,
  useOfflineCompleteTask,
  useOfflineDeleteTask,
} from './use-offline-task-mutations';

// Query keys for tasks
export const taskQueryKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskQueryKeys.all, 'list'] as const,
  listByFarm: (farmId: number) => [...taskQueryKeys.lists(), { farmId }] as const,
  listByStatus: (status: string) => [...taskQueryKeys.lists(), { status }] as const,
  detail: (id: number) => [...taskQueryKeys.all, 'detail', id] as const,
};

// Helper to get user ID
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

function isMissingPlannedInputsColumnError(
  error: { message?: string; details?: string } | null,
  hasPlannedInputs: boolean,
): boolean {
  if (!hasPlannedInputs || !error) return false;
  return (
    error.message?.includes('planned_inputs') === true ||
    error.details?.includes('planned_inputs') === true
  );
}

/**
 * Fetch all tasks for a farm
 */
export function useTasks(farmId?: number, seasonId?: number) {
  return useQuery({
    queryKey: farmId
      ? [...taskQueryKeys.listByFarm(farmId), { seasonId: seasonId ?? null }]
      : [...taskQueryKeys.lists(), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<TaskReminder[]> => {
      await getUserId(); // Ensure user is logged in

      let query = supabase
        .from('task_reminders')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (farmId) {
        query = query.eq('farm_id', farmId);
      }
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Fetch all tasks across all farms
 */
export function useAllTasks(seasonId?: number) {
  return useQuery({
    queryKey: [...taskQueryKeys.lists(), { seasonId: seasonId ?? null }],
    queryFn: async (): Promise<TaskReminder[]> => {
      await getUserId();

      let query = supabase
        .from('task_reminders')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const offlineCreate = useOfflineCreateTask();

  return useMutation({
    mutationFn: async (task: TaskReminderInsert): Promise<TaskReminder> => {
      const assignmentDate = task.due_date
        ? task.due_date.slice(0, 10)
        : formatLocalDate(new Date());
      const seasonId =
        task.season_id ??
        (await resolveSeasonIdForDate({
          farmId: task.farm_id,
          date: assignmentDate,
        }));

      return offlineCreate.mutateAsync({ ...task, season_id: seasonId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
}

/**
 * Update an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const offlineUpdate = useOfflineUpdateTask();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: TaskReminderUpdate;
    }): Promise<TaskReminder> => {
      return offlineUpdate.mutateAsync({ id, updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
}

/**
 * Complete a task
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const offlineComplete = useOfflineCompleteTask();

  return useMutation({
    mutationFn: async (id: number): Promise<TaskReminder> => {
      return offlineComplete.mutateAsync(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const offlineDelete = useOfflineDeleteTask();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      return offlineDelete.mutateAsync(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
}
