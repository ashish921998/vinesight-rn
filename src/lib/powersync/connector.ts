/**
 * PowerSync Supabase Backend Connector
 *
 * Handles authentication token fetching and upload of local changes
 * back to Supabase. This connector bridges PowerSync's local SQLite
 * database with the remote Supabase backend.
 *
 * ## Conflict Resolution Strategy: Last-Write-Wins (LWW)
 *
 * Every PUT/PATCH operation stamps `updated_at = now()` before sending
 * to Supabase. This means the most recent offline write always overwrites
 * the server value. This is a simple, predictable strategy that works well
 * for single-user apps where the same user edits from one device at a time.
 *
 * ## Error Handling
 *
 * - **Fatal errors** (constraint violations, missing tables) are logged and
 *   skipped so the upload queue doesn't get permanently stuck.
 * - **Transient errors** (network failures, 5xx) re-throw so PowerSync
 *   retries the transaction automatically when connectivity returns.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';
import { supabase } from '../supabase';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

/**
 * Postgres error codes that indicate a permanent failure — retrying won't help.
 * These operations should be discarded from the queue to prevent it from stalling.
 */
const FATAL_POSTGRES_CODES = new Set([
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '42P01', // undefined_table
  '42703', // undefined_column
]);

/**
 * Check whether a Supabase/Postgres error is non-retryable.
 */
function isFatalError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return FATAL_POSTGRES_CODES.has((error as { code: string }).code);
  }
  return false;
}

/**
 * Apply a single CRUD operation to Supabase with last-write-wins semantics.
 *
 * - PUT  → upsert (insert or overwrite) with `updated_at` set to now
 * - PATCH → update with `updated_at` set to now
 * - DELETE → delete by id (idempotent — ignores "not found")
 */
async function applyCrudOperation(op: CrudEntry): Promise<void> {
  const table = op.table;
  const now = new Date().toISOString();

  switch (op.op) {
    case 'PUT': {
      // Last-write-wins: upsert with current timestamp so this write
      // always takes precedence over any earlier server value.
      const record = {
        ...op.opData,
        id: op.id,
        updated_at: now,
      };
      const { error } = await supabase.from(table).upsert(record, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      break;
    }
    case 'PATCH': {
      // Last-write-wins: update with current timestamp
      const updates = {
        ...op.opData,
        updated_at: now,
      };
      const { error } = await supabase.from(table).update(updates).eq('id', op.id);
      if (error) throw error;
      break;
    }
    case 'DELETE': {
      const { error } = await supabase.from(table).delete().eq('id', op.id);
      // Ignore "not found" — the row may already be deleted on the server
      if (error && error.code !== 'PGRST116') throw error;
      break;
    }
  }
}

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  /**
   * Fetch credentials for PowerSync authentication.
   * Returns null if the user is not signed in.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
    };
  }

  /**
   * Upload local changes to Supabase.
   *
   * Processes CRUD operations from the PowerSync upload queue one
   * transaction at a time. Each operation is applied individually:
   *
   * - **Last-write-wins**: Every PUT/PATCH stamps `updated_at = now()`
   *   so the most recent offline write always overwrites the server.
   * - **Fatal errors** (constraint violations, missing tables) cause
   *   the operation to be skipped and the transaction completed so the
   *   queue doesn't get stuck.
   * - **Transient errors** (network, 5xx) re-throw so PowerSync retries
   *   the transaction later.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        try {
          await applyCrudOperation(op);
        } catch (error) {
          if (isFatalError(error)) {
            // Non-retryable — log and skip this operation
            if (__DEV__) {
              console.warn(
                `[PowerSync] Skipping non-retryable operation ${op.op} on ${op.table}/${op.id}:`,
                error,
              );
            }
            // Continue processing remaining operations in the transaction
            continue;
          }
          // Transient error — re-throw to retry the whole transaction later
          throw error;
        }
      }

      await transaction.complete();
    } catch (error) {
      if (__DEV__) {
        console.error('[PowerSync] Upload failed (will retry):', error);
      }
      throw error;
    }
  }
}
