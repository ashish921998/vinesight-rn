import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ============================================================
// MARK: - Configuration
// ============================================================

// TODO: Move these to environment variables
// For development, you can set these directly
// For production, use EAS secrets or .env files
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// ============================================================
// MARK: - Secure Storage Adapter
// ============================================================

/**
 * Custom storage adapter that uses SecureStore on native platforms
 * and AsyncStorage on web (SecureStore is not available on web)
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(key);
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
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
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
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
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
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Required for mobile apps
  },
});

// ============================================================
// MARK: - Configuration Helpers
// ============================================================

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY.length > 0
  );
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
    hasUrl: SUPABASE_URL !== 'YOUR_SUPABASE_URL',
    hasKey: SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY',
  };
}

// ============================================================
// MARK: - Export Default
// ============================================================

export default supabase;
