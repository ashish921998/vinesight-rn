/**
 * Task Hooks for Vinesight
 * React Query hooks for task reminders CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TaskReminder, TaskReminderInsert, TaskReminderUpdate } from '../types/task';
import { formatLocalDate } from '../utils/date';
import { resolveOrCreateSeasonIdForDate } from '../lib/season-context';
import { encodeTaskPlanInDescription } from '../utils/task-plan';
import { telemetry } from '../services/telemetry';

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

  return useMutation({
    mutationFn: async (task: TaskReminderInsert): Promise<TaskReminder> => {
      const userId = await getUserId();
      const assignmentDate = task.due_date
        ? task.due_date.slice(0, 10)
        : formatLocalDate(new Date());
      const seasonId =
        task.season_id ??
        (await resolveOrCreateSeasonIdForDate({
          farmId: task.farm_id,
          date: assignmentDate,
        }));

      const payload = {
        ...task,
        season_id: seasonId,
        created_by: userId,
      };

      const firstAttempt = await supabase.from('task_reminders').insert(payload).select().single();
      if (!firstAttempt.error) return firstAttempt.data;

      if (!isMissingPlannedInputsColumnError(firstAttempt.error, 'planned_inputs' in payload)) {
        throw firstAttempt.error;
      }
      telemetry.capture('task_planned_inputs_column_missing', {
        operation: 'insert',
      });

      const { planned_inputs: _plannedInputs, ...fallbackPayload } = payload;
      const encodedDescription = encodeTaskPlanInDescription(
        fallbackPayload.description,
        payload.planned_inputs,
      );
      const fallbackAttempt = await supabase
        .from('task_reminders')
        .insert({
          ...fallbackPayload,
          description: encodedDescription,
        })
        .select()
        .single();

      if (fallbackAttempt.error) throw fallbackAttempt.error;
      return fallbackAttempt.data;
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

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: TaskReminderUpdate;
    }): Promise<TaskReminder> => {
      const firstAttempt = await supabase
        .from('task_reminders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!firstAttempt.error) return firstAttempt.data;

      if (!isMissingPlannedInputsColumnError(firstAttempt.error, 'planned_inputs' in updates)) {
        throw firstAttempt.error;
      }
      telemetry.capture('task_planned_inputs_column_missing', {
        operation: 'update',
      });

      const { planned_inputs: _plannedInputs, ...fallbackUpdates } = updates;
      const encodedDescription =
        'description' in updates
          ? encodeTaskPlanInDescription(fallbackUpdates.description, updates.planned_inputs)
          : fallbackUpdates.description;
      const fallbackAttempt = await supabase
        .from('task_reminders')
        .update({
          ...fallbackUpdates,
          ...(encodedDescription !== undefined ? { description: encodedDescription } : {}),
        })
        .eq('id', id)
        .select()
        .single();

      if (fallbackAttempt.error) throw fallbackAttempt.error;
      return fallbackAttempt.data;
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

  return useMutation({
    mutationFn: async (id: number): Promise<TaskReminder> => {
      const { data, error } = await supabase
        .from('task_reminders')
        .update({
          status: 'completed',
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const { error } = await supabase.from('task_reminders').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
  });
}
