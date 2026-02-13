/**
 * PowerSync System - Database Instance & Initialization
 *
 * Creates and manages the PowerSync database instance.
 * This is the central module that:
 * - Creates the PowerSync database with the app schema
 * - Connects to the Supabase backend via the connector
 * - Provides the database instance for use throughout the app
 *
 * @see https://docs.powersync.com/usage/installation/react-native
 */

import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './schema';
import { supabaseConnector } from './connector';

// ============================================================
// MARK: - Database Instance
// ============================================================

/**
 * The PowerSync database instance.
 *
 * This is a local SQLite database that automatically syncs with Supabase
 * via the PowerSync service. All reads go to the local database (instant),
 * and writes are queued locally then uploaded to Supabase when online.
 */
export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'vinesight-powersync.db',
  },
});

// ============================================================
// MARK: - Initialization
// ============================================================

/** Track whether PowerSync has been initialized */
let isInitialized = false;

/**
 * Initialize PowerSync and connect to the Supabase backend.
 *
 * This should be called once after the user is authenticated.
 * It sets up the local database and starts the sync process.
 *
 * Safe to call multiple times - will only initialize once.
 */
export async function initializePowerSync(): Promise<void> {
  if (isInitialized) {
    if (__DEV__) {
      console.log('[PowerSync] Already initialized, skipping');
    }
    return;
  }

  try {
    // Initialize the local database
    await powerSyncDb.init();

    // Connect to the PowerSync service via the Supabase connector
    // This starts the bidirectional sync process
    await powerSyncDb.connect(supabaseConnector);

    isInitialized = true;

    if (__DEV__) {
      console.log('[PowerSync] Initialized and connected successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[PowerSync] Initialization failed:', error);
    }
    // Don't throw - the app should still work with Supabase directly
    // PowerSync will retry connection automatically
  }
}

/**
 * Disconnect PowerSync and clean up resources.
 *
 * Call this when the user logs out to stop syncing and clear local data.
 */
export async function disconnectPowerSync(): Promise<void> {
  try {
    await powerSyncDb.disconnectAndClear();
    isInitialized = false;

    if (__DEV__) {
      console.log('[PowerSync] Disconnected and cleared');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[PowerSync] Disconnect failed:', error);
    }
  }
}

/**
 * Check if PowerSync is currently initialized and connected.
 */
export function isPowerSyncInitialized(): boolean {
  return isInitialized;
}
