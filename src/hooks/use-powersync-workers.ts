/**
 * PowerSync Workers Hook
 *
 * Offline-first alternative to use-workers.ts that reads from the local
 * PowerSync SQLite database instead of making network requests to Supabase.
 *
 * Benefits:
 * - Instant reads from local database (no network latency)
 * - Works fully offline - attendance can be viewed without connectivity
 * - Automatically syncs with Supabase when online
 *
 * Migration guide:
 * - Replace `useWorkers()` with `usePowerSyncWorkers()` for offline-first reads
 * - Mutations still go through the existing Supabase hooks (queued by PowerSync)
 *
 * @see src/hooks/use-workers.ts for the original Supabase-direct implementation
 */

import { useQuery } from '@tanstack/react-query';
import { powerSyncDb } from '@/lib/powersync';
import { useAuthStore } from '@/stores';
import { queryKeys } from './query-keys';
import type { Worker, WorkerAttendance } from '@/types';

// ============================================================
// MARK: - PowerSync Worker Queries
// ============================================================

/**
 * Fetch all workers for the current user from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useWorkers()`.
 */
export function usePowerSyncWorkers() {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: [...queryKeys.workers.lists(), 'powersync'],
    queryFn: async (): Promise<Worker[]> => {
      if (!userId) {
        throw new Error('Please sign in to continue');
      }

      const results = await powerSyncDb.getAll<Worker>(
        'SELECT * FROM workers WHERE user_id = ? ORDER BY name ASC',
        [userId],
      );

      // Convert SQLite integer booleans back to JS booleans
      return results.map((worker) => ({
        ...worker,
        is_active: Boolean(worker.is_active),
      }));
    },
    enabled: !!userId,
  });
}

/**
 * Fetch a single worker by ID from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useWorker(id)`.
 */
export function usePowerSyncWorker(id: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.workers.detail(id!), 'powersync'],
    queryFn: async (): Promise<Worker> => {
      const result = await powerSyncDb.get<Worker>(
        'SELECT * FROM workers WHERE id = ?',
        [String(id)],
      );

      if (!result) {
        throw new Error('Worker not found');
      }

      return {
        ...result,
        is_active: Boolean(result.is_active),
      };
    },
    enabled: !!id,
  });
}

/**
 * Fetch worker attendance records from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useWorkerAttendance(workerId)`.
 */
export function usePowerSyncWorkerAttendance(workerId: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.workerAttendance.listByWorker(workerId!), 'powersync'],
    queryFn: async (): Promise<WorkerAttendance[]> => {
      const results = await powerSyncDb.getAll<WorkerAttendance>(
        'SELECT * FROM worker_attendance WHERE worker_id = ? ORDER BY date DESC',
        [String(workerId)],
      );

      // Parse JSON array fields stored as text
      return results.map((attendance) => ({
        ...attendance,
        farm_ids:
          typeof attendance.farm_ids === 'string'
            ? JSON.parse(attendance.farm_ids)
            : attendance.farm_ids,
      }));
    },
    enabled: !!workerId,
  });
}
