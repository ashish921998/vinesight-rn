/**
 * Pending Sync Hook
 *
 * Watches the PowerSync upload queue and returns the count of
 * unsynced local changes. Used by PendingSyncBadge to show
 * users how many offline writes are waiting to be uploaded.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import { useMemo } from 'react';
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { isPowerSyncConfigured } from '../lib/powersync';

/**
 * Returns the number of pending (unsynced) CRUD operations in the
 * PowerSync upload queue. Returns 0 when PowerSync is not available.
 *
 * Uses PowerSync's reactive watched query on the internal `ps_crud`
 * table so the count updates automatically when local writes occur
 * or when the upload queue drains after sync.
 */
export function usePendingSyncCount(): number {
  const powerSyncAvailable = isPowerSyncConfigured();

  const result = usePowerSyncQuery<{ total: number }>(
    powerSyncAvailable ? 'SELECT count(*) as total FROM ps_crud' : 'SELECT 0 as total WHERE 0',
    [],
  );

  return useMemo(() => {
    if (!powerSyncAvailable || !result.data || result.data.length === 0) return 0;
    return result.data[0].total ?? 0;
  }, [powerSyncAvailable, result.data]);
}
