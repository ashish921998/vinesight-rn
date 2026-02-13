/**
 * PowerSync Supabase Connector
 *
 * Bridges PowerSync's local SQLite database with the remote Supabase backend.
 * Handles:
 * - Authentication: Provides Supabase JWT tokens to PowerSync for sync auth
 * - Upload queue: Processes locally-queued writes and pushes them to Supabase
 * - Conflict resolution: Uses last-write-wins (LWW) strategy for v1
 *
 * @see https://docs.powersync.com/usage/installation/react-native
 */

import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';
import { supabase } from '../supabase';

// ============================================================
// MARK: - PowerSync Instance URL
// ============================================================

/**
 * PowerSync service URL - required for cloud sync.
 * Set this in your .env file as EXPO_PUBLIC_POWERSYNC_URL.
 * If not set, PowerSync will operate in local-only mode (no cloud sync).
 */
const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

// ============================================================
// MARK: - Supabase Connector Implementation
// ============================================================

/**
 * SupabaseConnector implements PowerSyncBackendConnector to integrate
 * PowerSync with the existing Supabase backend.
 *
 * Key responsibilities:
 * 1. fetchCredentials() - Returns a valid Supabase JWT for PowerSync auth
 * 2. uploadData() - Processes the local write queue and applies changes to Supabase
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Provides authentication credentials to PowerSync.
   * PowerSync uses these to authenticate with the PowerSync cloud service.
   *
   * @returns Object with endpoint URL and JWT token
   */
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to get Supabase session: ${error.message}`);
    }

    if (!session) {
      throw new Error('No active Supabase session. User must be authenticated.');
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      // Token expiry so PowerSync knows when to refresh
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  /**
   * Processes the local upload queue.
   * Called by PowerSync when there are local changes to push to Supabase.
   *
   * Strategy: Last-Write-Wins (LWW)
   * - Each queued operation is applied to Supabase in order
   * - If a conflict occurs, the latest write wins
   * - Failed operations are retried automatically by PowerSync
   *
   * @param database - The PowerSync database instance
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // Get the next batch of changes from the upload queue
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      // No pending changes to upload
      return;
    }

    try {
      // Process each CRUD entry in the transaction
      for (const entry of transaction.crud) {
        await this.applyChange(entry);
      }

      // Mark the transaction as successfully uploaded
      await transaction.complete();

      if (__DEV__) {
        console.log(
          `[PowerSync] Uploaded ${transaction.crud.length} change(s) successfully`,
        );
      }
    } catch (error) {
      // Log the error in development
      if (__DEV__) {
        console.error('[PowerSync] Upload failed:', error);
      }

      // Re-throw to let PowerSync handle retry logic
      throw error;
    }
  }

  // ============================================================
  // MARK: - Private Helpers
  // ============================================================

  /**
   * Applies a single CRUD entry to Supabase.
   * Handles PUT (insert/update), PATCH (update), and DELETE operations.
   *
   * @param entry - The CRUD entry from PowerSync's upload queue
   */
  private async applyChange(entry: CrudEntry): Promise<void> {
    const table = entry.table;
    const data = entry.opData; // The row data for the operation

    switch (entry.op) {
      case UpdateType.PUT: {
        // PUT = upsert (insert or update)
        // PowerSync uses PUT for both new records and updates
        const { error } = await supabase
          .from(table)
          .upsert({
            ...data,
            id: entry.id, // PowerSync ID maps to Supabase row ID
          });

        if (error) {
          throw new Error(
            `[PowerSync] Failed to upsert ${table} (id=${entry.id}): ${error.message}`,
          );
        }
        break;
      }

      case UpdateType.PATCH: {
        // PATCH = partial update
        if (!data) {
          if (__DEV__) {
            console.warn(`[PowerSync] PATCH with no data for ${table} (id=${entry.id})`);
          }
          return;
        }

        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', entry.id);

        if (error) {
          throw new Error(
            `[PowerSync] Failed to update ${table} (id=${entry.id}): ${error.message}`,
          );
        }
        break;
      }

      case UpdateType.DELETE: {
        // DELETE = remove the record
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', entry.id);

        if (error) {
          throw new Error(
            `[PowerSync] Failed to delete ${table} (id=${entry.id}): ${error.message}`,
          );
        }
        break;
      }

      default: {
        if (__DEV__) {
          console.warn(`[PowerSync] Unknown operation type: ${entry.op} for ${table}`);
        }
      }
    }
  }
}

/**
 * Singleton connector instance.
 * Reused across the app to avoid creating multiple connector instances.
 */
export const supabaseConnector = new SupabaseConnector();
