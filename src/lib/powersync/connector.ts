/**
 * PowerSync Supabase Backend Connector
 *
 * Handles authentication token fetching and upload of local changes
 * back to Supabase. This connector bridges PowerSync's local SQLite
 * database with the remote Supabase backend.
 *
 * ## Conflict Resolution (Phase 4)
 *
 * Before applying PUT/PATCH operations, the connector now checks for
 * conflicts by comparing the local record's `updated_at` with the
 * server's current version. If a conflict is detected, it delegates
 * to the conflict resolution service which applies the configured
 * strategy (last-write-wins, merge, or prompt-user).
 *
 * ## Error Handling
 *
 * - **Fatal errors** (constraint violations, missing tables) are logged and
 *   skipped so the upload queue doesn't get permanently stuck.
 * - **Transient errors** (network failures, 5xx) re-throw so PowerSync
 *   retries the transaction automatically when connectivity returns.
 * - **Pending conflicts** (user needs to resolve) skip the operation so
 *   the queue can continue; the conflict is resolved asynchronously.
 *
 * Phase 3 + Phase 4: Offline Writes & Conflict Resolution
 */

import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';
import { supabase } from '../supabase';
import { handleConflict } from '@/services/conflict-resolution-service';

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
 * Apply a single CRUD operation to Supabase with conflict detection.
 *
 * For PUT and PATCH operations, the conflict resolution service is
 * consulted first. If a conflict is detected and can be auto-resolved,
 * the resolved record is written. If the conflict requires user input,
 * the operation is skipped (the conflict queue handles it later).
 *
 * - PUT  → upsert with conflict check
 * - PATCH → update with conflict check
 * - DELETE → delete by id (idempotent — ignores "not found")
 */
async function applyCrudOperation(op: CrudEntry): Promise<void> {
  const table = op.table;
  const now = new Date().toISOString();

  switch (op.op) {
    case 'PUT': {
      // Build the local record from the operation data
      const localRecord = {
        ...op.opData,
        id: op.id,
        updated_at: op.opData?.updated_at ?? now,
      };

      // ── Phase 4: Conflict detection before write ──
      try {
        const result = await handleConflict(
          table,
          op.id,
          localRecord,
          'PUT',
        );

        switch (result.outcome) {
          case 'no-conflict': {
            // No conflict — proceed with the original upsert
            const record = { ...localRecord, updated_at: now };
            const { error } = await supabase.from(table).upsert(record, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });
            if (error) throw error;
            break;
          }
          case 'resolved': {
            // Conflict was auto-resolved — write the resolved record
            const { error } = await supabase.from(table).upsert(result.record, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });
            if (error) throw error;
            break;
          }
          case 'pending-user': {
            // Conflict requires user input — skip this operation.
            // The conflict is stored in the queue and will be resolved
            // asynchronously via the ConflictResolutionModal.
            if (__DEV__) {
              console.info(
                `[PowerSync] Conflict on ${table}/${op.id} — awaiting user resolution`,
              );
            }
            break;
          }
          case 'server-deleted': {
            // Server record was deleted — proceed with upsert to recreate
            const record = { ...localRecord, updated_at: now };
            const { error } = await supabase.from(table).upsert(record, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });
            if (error) throw error;
            break;
          }
        }
      } catch (conflictError) {
        // If conflict detection itself fails (e.g., network error during
        // server fetch), fall back to the original last-write-wins behavior
        if (__DEV__) {
          console.warn(
            `[PowerSync] Conflict detection failed for ${table}/${op.id}, falling back to LWW:`,
            conflictError,
          );
        }
        const record = { ...localRecord, updated_at: now };
        const { error } = await supabase.from(table).upsert(record, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
        if (error) throw error;
      }
      break;
    }

    case 'PATCH': {
      // Build the local record from the operation data
      const localUpdates = {
        ...op.opData,
        updated_at: op.opData?.updated_at ?? now,
      };

      // ── Phase 4: Conflict detection before write ──
      try {
        const result = await handleConflict(
          table,
          op.id,
          localUpdates,
          'PATCH',
        );

        switch (result.outcome) {
          case 'no-conflict': {
            // No conflict — proceed with the original update
            const updates = { ...localUpdates, updated_at: now };
            const { error } = await supabase.from(table).update(updates).eq('id', op.id);
            if (error) throw error;
            break;
          }
          case 'resolved': {
            // Conflict was auto-resolved — write the resolved record
            const { error } = await supabase
              .from(table)
              .upsert({ ...result.record, id: op.id }, {
                onConflict: 'id',
                ignoreDuplicates: false,
              });
            if (error) throw error;
            break;
          }
          case 'pending-user': {
            // Conflict requires user input — skip this operation
            if (__DEV__) {
              console.info(
                `[PowerSync] Conflict on ${table}/${op.id} — awaiting user resolution`,
              );
            }
            break;
          }
          case 'server-deleted': {
            // Can't patch a deleted record — skip
            if (__DEV__) {
              console.warn(
                `[PowerSync] Skipping PATCH on deleted ${table}/${op.id}`,
              );
            }
            break;
          }
        }
      } catch (conflictError) {
        // Fall back to original LWW behavior if conflict detection fails
        if (__DEV__) {
          console.warn(
            `[PowerSync] Conflict detection failed for ${table}/${op.id}, falling back to LWW:`,
            conflictError,
          );
        }
        const updates = { ...localUpdates, updated_at: now };
        const { error } = await supabase.from(table).update(updates).eq('id', op.id);
        if (error) throw error;
      }
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
   * Upload local changes to Supabase with conflict detection.
   *
   * Processes CRUD operations from the PowerSync upload queue one
   * transaction at a time. Each operation is applied individually:
   *
   * - **Conflict detection** (Phase 4): PUT/PATCH operations check the
   *   server version before writing. If a conflict is detected, the
   *   configured strategy is applied (LWW, merge, or prompt user).
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
