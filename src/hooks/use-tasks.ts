/**
 * Task Hooks for Vinesight
 * React Query hooks for task reminders CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TaskReminder, TaskReminderInsert, TaskReminderUpdate } from '../types/task';

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

/**
 * Fetch all tasks for a farm
 */
export function useTasks(farmId?: number) {
  return useQuery({
    queryKey: farmId ? taskQueryKeys.listByFarm(farmId) : taskQueryKeys.lists(),
    queryFn: async (): Promise<TaskReminder[]> => {
      await getUserId(); // Ensure user is logged in

      let query = supabase
        .from('task_reminders')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (farmId) {
        query = query.eq('farm_id', farmId);
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
export function useAllTasks() {
  return useQuery({
    queryKey: taskQueryKeys.lists(),
    queryFn: async (): Promise<TaskReminder[]> => {
      await getUserId();

      const { data, error } = await supabase
        .from('task_reminders')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });

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

      const { data, error } = await supabase
        .from('task_reminders')
        .insert({
          ...task,
          created_by: userId,
        })
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
      const { data, error } = await supabase
        .from('task_reminders')
        .update(updates)
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
