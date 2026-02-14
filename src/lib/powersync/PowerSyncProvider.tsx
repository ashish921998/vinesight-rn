/**
 * PowerSync Provider
 *
 * Wraps the app with PowerSync context, initializing the local SQLite
 * database and connecting to the PowerSync service for sync.
 * Gracefully handles cases where PowerSync is not configured.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { PowerSyncContext } from '@powersync/react';
import { PowerSyncDatabase } from '@powersync/react-native';
import { useAuthStore } from '@/stores';
import { powersyncSchema } from './schema';
import { SupabasePowerSyncConnector } from './connector';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';

/**
 * Check if PowerSync is properly configured with a valid URL.
 */
export function isPowerSyncConfigured(): boolean {
  if (!POWERSYNC_URL) return false;
  try {
    const parsed = new URL(POWERSYNC_URL);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface PowerSyncProviderProps {
  children: React.ReactNode;
}

/**
 * PowerSync provider component.
 * Initializes the PowerSync database and connects when the user is authenticated.
 * If PowerSync is not configured, children render without PowerSync context.
 */
export function PowerSyncProviderWrapper({ children }: PowerSyncProviderProps) {
  const isAuthenticated = useAuthStore((state) => !state.isLoading && !!state.session);
  const [isReady, setIsReady] = useState(false);
  const connectorRef = useRef<SupabasePowerSyncConnector | null>(null);

  // Create the PowerSync database instance once
  const powerSync = useMemo(() => {
    if (!isPowerSyncConfigured()) return null;
    // PowerSync is not supported on web yet
    if (Platform.OS === 'web') return null;

    try {
      return new PowerSyncDatabase({
        schema: powersyncSchema,
        database: { dbFilename: 'vinesight-powersync.db' },
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[PowerSync] Failed to create database:', error);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!powerSync) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        await powerSync.init();
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[PowerSync] Initialization failed:', error);
        }
        if (!cancelled) {
          setIsReady(true); // Still render children even if PowerSync fails
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [powerSync]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!powerSync || !isReady) return;

    if (isAuthenticated) {
      const connector = new SupabasePowerSyncConnector();
      connectorRef.current = connector;

      void powerSync.connect(connector).catch((error) => {
        if (__DEV__) {
          console.error('[PowerSync] Connection failed:', error);
        }
      });
    } else {
      void powerSync.disconnect().catch((error) => {
        if (__DEV__) {
          console.error('[PowerSync] Disconnect failed:', error);
        }
      });
      connectorRef.current = null;
    }
  }, [powerSync, isAuthenticated, isReady]);

  // If PowerSync is not available, render children without context
  if (!powerSync) {
    return <>{children}</>;
  }

  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
}
