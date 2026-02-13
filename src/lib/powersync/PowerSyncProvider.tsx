/**
 * PowerSync Provider
 *
 * Initialises the PowerSync database and wraps the app tree with the
 * PowerSyncContext so that any component can access the local database
 * via the `usePowerSync()` hook.
 *
 * The provider:
 * - Creates a singleton PowerSyncDatabase instance
 * - Connects to the Supabase backend when the user is authenticated
 * - Disconnects when the user signs out
 * - Is safe to render on web (no-ops gracefully)
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { PowerSyncContext, PowerSyncDatabase } from '@powersync/react-native';

import { supabase } from '@/lib/supabase';
import { AppSchema } from './schema';
import { SupabaseConnector } from './SupabaseConnector';

/** Environment flag — PowerSync requires a service URL to sync */
const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

/**
 * Check whether PowerSync can be initialised in this environment.
 * On web we skip initialisation because the native SQLite driver is unavailable.
 */
function canInitPowerSync(): boolean {
  if (Platform.OS === 'web') return false;
  return true; // PowerSync URL is only needed for remote sync, not local DB
}

interface PowerSyncAppProviderProps {
  children: React.ReactNode;
}

/**
 * Provides the PowerSync database context to the component tree.
 *
 * Usage (in app/_layout.tsx):
 * ```tsx
 * <PowerSyncAppProvider>
 *   {children}
 * </PowerSyncAppProvider>
 * ```
 */
export function PowerSyncAppProvider({ children }: PowerSyncAppProviderProps) {
  const connectorRef = useRef<SupabaseConnector | null>(null);

  // Create the database instance once
  const db = useMemo(() => {
    if (!canInitPowerSync()) return null;

    return new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: 'vinesight.db',
      },
    });
  }, []);

  useEffect(() => {
    if (!db) return;

    let cancelled = false;

    const init = async () => {
      try {
        // Initialise the local database (creates tables, runs migrations)
        await db.init();

        if (cancelled) return;

        // Only attempt remote sync if the PowerSync URL is configured
        if (POWERSYNC_URL) {
          const connector = new SupabaseConnector();
          connectorRef.current = connector;

          // Check if user is already authenticated
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session && !cancelled) {
            await db.connect(connector);
          }
        }

        if (__DEV__ && !cancelled) {
          console.log('[PowerSync] Initialised successfully');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[PowerSync] Initialisation failed:', error);
        }
      }
    };

    void init();

    // Listen for auth state changes to connect/disconnect sync
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (cancelled) return;

      if (event === 'SIGNED_IN' && POWERSYNC_URL) {
        try {
          if (!connectorRef.current) {
            connectorRef.current = new SupabaseConnector();
          }
          await db.connect(connectorRef.current);
        } catch (error) {
          if (__DEV__) {
            console.error('[PowerSync] Connect on sign-in failed:', error);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          await db.disconnect();
          // Clear local data on sign-out for security
          await db.disconnectAndClear();
        } catch (error) {
          if (__DEV__) {
            console.error('[PowerSync] Disconnect on sign-out failed:', error);
          }
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      db.disconnect().catch(() => null);
    };
  }, [db]);

  // On web or when PowerSync can't initialise, render children without the provider
  if (!db) {
    return <>{children}</>;
  }

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
