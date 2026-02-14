/**
 * PowerSync Database Access
 *
 * Provides a hook to access the PowerSync database instance from context,
 * and a helper to get the database for use in TanStack Query queryFn callbacks.
 *
 * On web (where PowerSync is not available), returns null so callers can
 * fall back to Supabase REST queries.
 */

import { useContext } from 'react';
import { Platform } from 'react-native';
import { PowerSyncContext } from '@powersync/react-native';
import type { AbstractPowerSyncDatabase } from '@powersync/react-native';

/**
 * React hook to access the PowerSync database from context.
 * Returns null on web or when the provider is not mounted.
 */
export function usePowerSyncDb(): AbstractPowerSyncDatabase | null {
  const db = useContext(PowerSyncContext);
  return db ?? null;
}

/**
 * Check whether PowerSync local reads are available in this environment.
 * Returns false on web where the native SQLite driver is unavailable.
 */
export function isPowerSyncAvailable(): boolean {
  return Platform.OS !== 'web';
}
