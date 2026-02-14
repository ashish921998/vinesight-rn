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
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = op.table;
        const record = { ...op.opData, id: op.id };

        switch (op.op) {
          case 'PUT': {
            const { error } = await supabase.from(table).upsert(record);
            if (error) throw error;
            break;
          }
          case 'PATCH': {
            const { error } = await supabase.from(table).update(op.opData).eq('id', op.id);
            if (error) throw error;
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
