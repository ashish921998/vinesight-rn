/**
 * Workers Hooks
 * React Query hooks for worker management
 * Covers: Workers, Attendance, Transactions, Settlements, Work Types
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
import { queryKeys } from './query-keys';
import {
  TABLES,
  type Worker,
  type WorkerInsert,
  type WorkerUpdate,
  type WorkerAttendance,
  type WorkerAttendanceInsert,
  type WorkerTransaction,
  type WorkerTransactionInsert,
  type WorkerSettlement,
  type WorkerSettlementInsert,
  type WorkerSettlementUpdate,
  type WorkType,
  type TemporaryWorkerEntry,
  type TemporaryWorkerEntryInsert,
} from '../types';
import { resolveSeasonIdForDate } from '../lib/season-context';
import { formatLocalDate } from '../utils/worker-analytics';

// ============================================================
// MARK: - Helper
// ============================================================

async function getUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await getDataAccess().auth.getSession();
  if (error || !session) {
    throw new Error('Please sign in to continue');
  }
  return session.user.id;
}

// ============================================================
// MARK: - WORKERS
// ============================================================

export function useWorkers() {
  return useQuery({
    queryKey: queryKeys.workers.lists(),
    queryFn: async (): Promise<Worker[]> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.WORKERS)
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorker(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.workers.detail(id!),
    queryFn: async (): Promise<Worker> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKERS)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (worker: WorkerInsert): Promise<Worker> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.WORKERS)
        .insert({ ...worker, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: WorkerUpdate }): Promise<Worker> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKERS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedWorker) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
      if (updatedWorker.id) {
        queryClient.setQueryData(queryKeys.workers.detail(updatedWorker.id), updatedWorker);
      }
    },
  });
}

export function useDeleteWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const { error } = await getDataAccess().from(TABLES.WORKERS).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
      queryClient.removeQueries({ queryKey: queryKeys.workers.detail(deletedId) });
    },
  });
}

// ============================================================
// MARK: - WORKER ATTENDANCE
// ============================================================

/**
 * Canonical date-range fetch for a single worker's attendance.
 * Used by both the calendar and mark attendance tabs so they share one
 * query/cache entry and stay in sync via cache invalidation.
 */
export async function fetchWorkerAttendanceByDateRange(
  workerId: number,
  startDate: string,
  endDate: string,
): Promise<WorkerAttendance[]> {
  const { data, error } = await getDataAccess()
    .from(TABLES.WORKER_ATTENDANCE)
    .select('*')
    .eq('worker_id', workerId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useWorkerAttendanceByDateRange(
  workerId: number | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: queryKeys.workerAttendance.listByWorkerDateRange(workerId!, startDate, endDate),
    queryFn: () => fetchWorkerAttendanceByDateRange(workerId!, startDate, endDate),
    enabled: !!workerId,
  });
}

export function useAllWorkerAttendance() {
  return useQuery({
    queryKey: queryKeys.workerAttendance.listAll(),
    queryFn: async (): Promise<WorkerAttendance[]> => {
      const userId = await getUserId();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const cutoff = formatLocalDate(thirtyDaysAgo);

      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_ATTENDANCE)
        .select('*, workers!inner(user_id)')
        .eq('workers.user_id', userId)
        .gte('date', cutoff)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkerAttendance(workerId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.workerAttendance.listByWorker(workerId!),
    queryFn: async (): Promise<WorkerAttendance[]> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_ATTENDANCE)
        .select('*')
        .eq('worker_id', workerId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workerId,
  });
}

export function useCreateWorkerAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendance: WorkerAttendanceInsert): Promise<WorkerAttendance> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_ATTENDANCE)
        .insert(attendance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerAttendance.lists(),
      });
    },
  });
}

export function useUpdateWorkerAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<WorkerAttendance>;
    }): Promise<WorkerAttendance> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_ATTENDANCE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerAttendance.lists(),
      });
    },
  });
}

export function useDeleteWorkerAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      workerId: _workerId,
    }: {
      id: number;
      workerId: number;
    }): Promise<void> => {
      const { error } = await getDataAccess().from(TABLES.WORKER_ATTENDANCE).delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerAttendance.lists(),
      });
    },
  });
}

// ============================================================
// MARK: - WORKER TRANSACTIONS
// ============================================================

export function useWorkerTransactions(workerId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.workerTransactions.listByWorker(workerId!),
    queryFn: async (): Promise<WorkerTransaction[]> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_TRANSACTIONS)
        .select('*')
        .eq('worker_id', workerId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workerId,
  });
}

export function useAllWorkerTransactions() {
  return useQuery({
    queryKey: queryKeys.workerTransactions.listAll(),
    queryFn: async (): Promise<WorkerTransaction[]> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_TRANSACTIONS)
        .select('*, workers!inner(user_id)')
        .eq('workers.user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateWorkerTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: WorkerTransactionInsert): Promise<WorkerTransaction> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_TRANSACTIONS)
        .insert(transaction)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newTransaction) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerTransactions.listByWorker(newTransaction.worker_id),
      });
      // Also invalidate worker to update advance balance
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
    },
  });
}

export function useDeleteWorkerTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      workerId: _workerId,
    }: {
      id: number;
      workerId: number;
    }): Promise<void> => {
      const { error } = await getDataAccess()
        .from(TABLES.WORKER_TRANSACTIONS)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { workerId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerTransactions.listByWorker(workerId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
    },
  });
}

// ============================================================
// MARK: - WORKER SETTLEMENTS
// ============================================================

export function useWorkerSettlements(workerId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.workerSettlements.listByWorker(workerId!),
    queryFn: async (): Promise<WorkerSettlement[]> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_SETTLEMENTS)
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workerId,
  });
}

export function useCreateWorkerSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settlement: WorkerSettlementInsert): Promise<WorkerSettlement> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_SETTLEMENTS)
        .insert(settlement)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newSettlement) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerSettlements.listByWorker(newSettlement.worker_id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
    },
  });
}

export function useUpdateWorkerSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: WorkerSettlementUpdate;
    }): Promise<WorkerSettlement> => {
      const { data, error } = await getDataAccess()
        .from(TABLES.WORKER_SETTLEMENTS)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedSettlement) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerSettlements.listByWorker(updatedSettlement.worker_id),
      });
    },
  });
}

// ============================================================
// MARK: - WORK TYPES
// ============================================================

export function useWorkTypes() {
  return useQuery({
    queryKey: queryKeys.workTypes.lists(),
    queryFn: async (): Promise<WorkType[]> => {
      const userId = await getUserId();

      // Fetch both user-specific and default work types
      const { data, error } = await getDataAccess()
        .from(TABLES.WORK_TYPES)
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateWorkType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<WorkType> => {
      const userId = await getUserId();

      const { data, error } = await getDataAccess()
        .from(TABLES.WORK_TYPES)
        .insert({ name, user_id: userId, is_default: false })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all });
    },
  });
}

// ============================================================
// MARK: - TEMPORARY WORKER ENTRIES
// ============================================================

export function useTemporaryWorkerEntries(farmId: number | undefined, seasonId?: number) {
  return useQuery({
    queryKey: [
      ...queryKeys.temporaryWorkerEntries.listByFarm(farmId!),
      { seasonId: seasonId ?? null },
    ],
    queryFn: async (): Promise<TemporaryWorkerEntry[]> => {
      let query = getDataAccess()
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
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

export function useTemporaryWorkerEntriesByFarms(farmIds: number[]) {
  return useQuery({
    queryKey: queryKeys.temporaryWorkerEntries.listByFarms(farmIds),
    queryFn: async (): Promise<TemporaryWorkerEntry[]> => {
      if (farmIds.length === 0) return [];
      const { data, error } = await getDataAccess()
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .select('*')
        .in('farm_id', farmIds)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: farmIds.length > 0,
  });
}

export function useAllTemporaryWorkerEntries() {
  return useQuery({
    queryKey: queryKeys.temporaryWorkerEntries.listAll(),
    queryFn: async (): Promise<TemporaryWorkerEntry[]> => {
      const userId = await getUserId();

      // Join through farms table to get entries for user's farms
      const { data, error } = await getDataAccess()
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .select('*, farms!inner(user_id)')
        .eq('farms.user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTemporaryWorkerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: TemporaryWorkerEntryInsert): Promise<TemporaryWorkerEntry> => {
      const userId = await getUserId();
      const seasonId =
        entry.season_id ??
        (await resolveSeasonIdForDate({
          farmId: entry.farm_id,
          date: entry.date,
        }));

      const { data, error } = await getDataAccess()
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .insert({ ...entry, season_id: seasonId, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newEntry) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.listByFarm(newEntry.farm_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.listAll(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.lists(),
      });
    },
  });
}

export function useDeleteTemporaryWorkerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId: _farmId }: { id: number; farmId: number }): Promise<void> => {
      const { error } = await getDataAccess()
        .from(TABLES.TEMPORARY_WORKER_ENTRIES)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.listByFarm(farmId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.listAll(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.temporaryWorkerEntries.lists(),
      });
    },
  });
}
