/**
 * PowerSync Farms Hook
 *
 * Offline-first alternative to use-farms.ts that reads from the local
 * PowerSync SQLite database instead of making network requests to Supabase.
 *
 * Benefits:
 * - Instant reads from local database (no network latency)
 * - Works fully offline
 * - Automatically syncs with Supabase when online
 *
 * Migration guide:
 * - Replace `useFarms()` with `usePowerSyncFarms()` for offline-first reads
 * - Mutations still go through the existing Supabase hooks (they'll be queued by PowerSync)
 *
 * @see src/hooks/use-farms.ts for the original Supabase-direct implementation
 */

import { useQuery } from '@tanstack/react-query';
import { powerSyncDb } from '@/lib/powersync';
import { useAuthStore } from '@/stores';
import { queryKeys } from './query-keys';
import type { Farm } from '@/types';

// ============================================================
// MARK: - PowerSync Farm Queries
// ============================================================

/**
 * Fetch all farms for the current user from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useFarms()`.
 * Data is read from the local SQLite database, which is kept in sync
 * with Supabase by PowerSync's background sync process.
 */
export function usePowerSyncFarms() {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: [...queryKeys.farms.lists(), 'powersync'],
    queryFn: async (): Promise<Farm[]> => {
      if (!userId) {
        throw new Error('Please sign in to continue');
      }

      // Query the local PowerSync SQLite database
      const results = await powerSyncDb.getAll<Farm>(
        'SELECT * FROM farms WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
      );

      return results;
    },
    enabled: !!userId,
  });
}

/**
 * Fetch a single farm by ID from the local PowerSync database.
 *
 * This is the offline-first equivalent of `useFarm(id)`.
 */
export function usePowerSyncFarm(id: number | undefined) {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: [...queryKeys.farms.detail(id!), 'powersync'],
    queryFn: async (): Promise<Farm> => {
      if (!userId) {
        throw new Error('Please sign in to continue');
      }

      const result = await powerSyncDb.get<Farm>(
        'SELECT * FROM farms WHERE id = ? AND user_id = ?',
        [String(id), userId],
      );

      if (!result) {
        throw new Error('Farm not found');
      }

      return result;
    },
    enabled: !!id && !isNaN(id) && !!userId,
  });
}
