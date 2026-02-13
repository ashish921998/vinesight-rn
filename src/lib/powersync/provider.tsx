/**
 * PowerSync Provider Component
 *
 * Wraps the app with PowerSync's React context provider, making the
 * PowerSync database instance available to all child components via hooks.
 *
 * This provider:
 * - Initializes PowerSync when the user is authenticated
 * - Disconnects PowerSync when the user logs out
 * - Provides the database instance via React context
 *
 * @see https://docs.powersync.com/usage/installation/react-native
 */

import React, { useEffect, useRef } from 'react';
import { PowerSyncContext } from '@powersync/react-native';
import { powerSyncDb, initializePowerSync, disconnectPowerSync } from './system';
import { useAuthStore } from '@/stores';

// ============================================================
// MARK: - Provider Component
// ============================================================

interface PowerSyncProviderProps {
  children: React.ReactNode;
}

/**
 * PowerSyncProvider wraps the app and manages the PowerSync lifecycle.
 *
 * It listens to the auth store and:
 * - Initializes PowerSync when a user session is available
 * - Disconnects and clears local data when the user logs out
 *
 * Usage in app/_layout.tsx:
 * ```tsx
 * <PowerSyncProvider>
 *   <QueryClientProvider client={queryClient}>
 *     {children}
 *   </QueryClientProvider>
 * </PowerSyncProvider>
 * ```
 */
export function PowerSyncProvider({ children }: PowerSyncProviderProps) {
  const session = useAuthStore((state) => state.session);
  const isInitializing = useRef(false);

  useEffect(() => {
    if (session?.user && !isInitializing.current) {
      // User is authenticated - initialize PowerSync
      isInitializing.current = true;
      initializePowerSync()
        .catch((error) => {
          if (__DEV__) {
            console.error('[PowerSyncProvider] Init failed:', error);
          }
        })
        .finally(() => {
          isInitializing.current = false;
        });
    } else if (!session?.user) {
      // User logged out - disconnect and clear local data
      disconnectPowerSync().catch((error) => {
        if (__DEV__) {
          console.error('[PowerSyncProvider] Disconnect failed:', error);
        }
      });
    }
  }, [session?.user]);

  return (
    <PowerSyncContext.Provider value={powerSyncDb}>
      {children}
    </PowerSyncContext.Provider>
  );
}
