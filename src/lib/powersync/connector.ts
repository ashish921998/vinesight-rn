/**
 * PowerSync Supabase Backend Connector
 *
 * Handles authentication token fetching and upload of local changes
 * back to Supabase. This connector bridges PowerSync's local SQLite
 * database with the remote Supabase backend.
 */

import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';
import { supabase } from '../supabase';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

/**
 * Tables that use auto-increment integer IDs in Supabase.
 * For PUT (insert) operations on these tables, we strip the client-generated
 * UUID and let Supabase assign the real integer ID.
 */
const INTEGER_ID_TABLES = new Set(['farms', 'farm_seasons']);

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
   * Processes CRUD operations from the PowerSync upload queue
   * and applies them to the remote Supabase database.
   *
   * Handles integer-ID tables (farms, farm_seasons) by stripping
   * the client-generated UUID on PUT and letting Supabase auto-generate
   * the real integer ID. PowerSync's sync will reconcile the IDs.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = op.table;
        const isIntegerIdTable = INTEGER_ID_TABLES.has(table);

        switch (op.op) {
          case 'PUT': {
            if (isIntegerIdTable) {
              // For integer-ID tables, insert without the client UUID.
              // Supabase will auto-generate the integer ID.
              const insertData = { ...op.opData };
              const { error } = await supabase.from(table).insert(insertData);
              if (error) throw error;
            } else {
              // For UUID-ID tables (e.g., profiles), upsert with the ID.
              const record = { ...op.opData, id: op.id };
              const { error } = await supabase.from(table).upsert(record);
              if (error) throw error;
            }
            break;
          }
          case 'PATCH': {
            if (isIntegerIdTable) {
              // For integer-ID tables, the local ID is a UUID string.
              // We need to find the record by a unique field combination.
              // PowerSync sync rules should have mapped the real ID by now,
              // but as a safety measure, try updating by ID first.
              const { error } = await supabase
                .from(table)
                .update(op.opData)
                .eq('id', op.id);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from(table)
                .update(op.opData)
                .eq('id', op.id);
              if (error) throw error;
            }
            break;
          }
          case 'DELETE': {
            const { error } = await supabase.from(table).delete().eq('id', op.id);
            if (error) throw error;
            break;
          }
        }
      }

      await transaction.complete();
    } catch (error) {
      if (__DEV__) {
        console.error('[PowerSync] Upload failed:', error);
      }
      throw error;
    }
  }
}
