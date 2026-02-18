import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ============================================================
// MARK: - Configuration
// ============================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const SUPABASE_CONFIG_ERROR_MESSAGE =
  'Supabase is not configured for this build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

// ============================================================
// MARK: - Secure Storage Adapter
// ============================================================

const isWeb = process.env.EXPO_OS === 'web';

const WebStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  },
};

/**
 * Custom storage adapter that uses SecureStore on native platforms
 * and localStorage on web (SecureStore is not available on web)
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWeb) {
        return WebStorageAdapter.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      if (__DEV__) {
        console.error('SecureStore getItem error:', error);
      }
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isWeb) {
        await WebStorageAdapter.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      if (__DEV__) {
        console.error('SecureStore setItem error:', error);
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (isWeb) {
        await WebStorageAdapter.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (__DEV__) {
        console.error('SecureStore removeItem error:', error);
      }
    }
  },
};

// ============================================================
// MARK: - Supabase Client
// ============================================================

/**
 * Supabase client instance
 * Configured with secure storage for session persistence
 */
function createUnconfiguredSupabaseClient(): SupabaseClient {
  return new Proxy(
    {},
    {
      get: () => {
        throw new Error(SUPABASE_CONFIG_ERROR_MESSAGE);
      },
    },
  ) as unknown as SupabaseClient;
}

function shouldCreateSupabaseClient(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (!/^https?:\/\//i.test(SUPABASE_URL)) return false;

  try {
    const parsed = new URL(SUPABASE_URL);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getSupabaseAuthStorageKey(): string | null {
  try {
    const url = new URL(SUPABASE_URL);
    const hostname = url.hostname;
    const projectRef = hostname.split('.')[0];
    if (!projectRef) return null;
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient = (() => {
  if (!shouldCreateSupabaseClient()) {
    return createUnconfiguredSupabaseClient();
  }

  try {
    const authStorageKey = getSupabaseAuthStorageKey();
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        ...(authStorageKey ? { storageKey: authStorageKey } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Required for mobile apps
      },
    });

    client.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT' && authStorageKey) {
        try {
          await ExpoSecureStoreAdapter.removeItem(authStorageKey);
        } catch {
          // Defensive catch: removeItem already handles errors internally.
        }
      }
    });

    return client;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Supabase client initialization failed:', error);
    }
    return createUnconfiguredSupabaseClient();
  }
})();

// ============================================================
// MARK: - Configuration Helpers
// ============================================================

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return shouldCreateSupabaseClient();
}

/**
 * Get configuration status for debugging
 */
export function getConfigurationStatus(): {
  isConfigured: boolean;
  hasUrl: boolean;
  hasKey: boolean;
} {
  return {
    isConfigured: isSupabaseConfigured(),
    hasUrl: SUPABASE_URL.length > 0,
    hasKey: SUPABASE_ANON_KEY.length > 0,
  };
}

// ============================================================
// MARK: - Export Default
// ============================================================

export default supabase;
