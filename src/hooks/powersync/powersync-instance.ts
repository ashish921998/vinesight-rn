/**
 * PowerSync Instance Accessor
 *
 * Provides access to the PowerSync database instance outside of React components.
 * The instance is set by the PowerSyncAppProvider during initialization.
 *
 * This module allows hooks to access the PowerSync database for local reads
 * without requiring the usePowerSync() context hook (which only works inside
 * the PowerSyncContext.Provider tree).
 */

import type { AbstractPowerSyncDatabase } from '@powersync/react-native';

let _instance: AbstractPowerSyncDatabase | null = null;

/**
 * Set the PowerSync database instance.
 * Called by PowerSyncAppProvider after initialization.
 */
export function setInstance(db: AbstractPowerSyncDatabase | null): void {
  _instance = db;
}

/**
 * Get the current PowerSync database instance.
 * Returns null if PowerSync is not initialized (e.g., on web).
 */
export function getInstance(): AbstractPowerSyncDatabase | null {
  return _instance;
}
