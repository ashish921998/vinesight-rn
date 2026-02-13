/**
 * PowerSync Module - Barrel Export
 *
 * Central export point for all PowerSync-related modules.
 */

// Schema and types
export { AppSchema, type AppDatabase } from './schema';

// Supabase connector
export { SupabaseConnector, supabaseConnector } from './connector';

// Database instance and lifecycle
export {
  powerSyncDb,
  initializePowerSync,
  disconnectPowerSync,
  isPowerSyncInitialized,
} from './system';

// React provider
export { PowerSyncProvider } from './provider';
