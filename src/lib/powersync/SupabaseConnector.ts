/**
 * PowerSync ↔ Supabase Backend Connector
 *
 * Implements the PowerSyncBackendConnector interface to:
 * 1. Provide authentication credentials (JWT) from the existing Supabase session
 * 2. Upload local CRUD changes back to Supabase via the REST API
 *
 * This connector reuses the existing Supabase client from src/lib/supabase.ts.
 */

import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

/** PowerSync service URL — set in .env */
const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

/**
 * Connector that bridges PowerSync with the existing Supabase backend.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Fetch a fresh JWT from the current Supabase session.
   * Returns null when the user is not authenticated (PowerSync will pause sync).
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      return null;
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  /**
   * Upload local changes to Supabase.
   *
   * Processes each CRUD entry one-by-one so that a single failure
   * does not block the entire queue. Failed entries are retried
   * automatically by PowerSync after the configured back-off.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    try {
      for (const op of transaction.crud) {
        await this.applyOperation(op);
      }

      await transaction.complete();
    } catch (error) {
      if (__DEV__) {
        console.error('[PowerSync] Upload failed:', error);
      }
      throw error; // PowerSync will retry
    }
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Apply a single CRUD operation to Supabase.
   */
  private async applyOperation(op: CrudEntry): Promise<void> {
    const table = op.table;
    const data = { ...op.opData, id: op.id };

    switch (op.op) {
      case UpdateType.PUT: {
        const { error } = await supabase.from(table).upsert(data);
        if (error) throw error;
        break;
      }
      case UpdateType.PATCH: {
        const { error } = await supabase.from(table).update(op.opData).eq('id', op.id);
        if (error) throw error;
        break;
      }
      case UpdateType.DELETE: {
        const { error } = await supabase.from(table).delete().eq('id', op.id);
        if (error) throw error;
        break;
      }
      default:
        if (__DEV__) {
          console.warn(`[PowerSync] Unknown operation type: ${op.op}`);
        }
    }
  }
}
