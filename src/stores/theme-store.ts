import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  hasHydrated: boolean;
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  _setHasHydrated: (value: boolean) => void;
}

const THEME_STORAGE_KEY = 'vinesight-theme';

const themeStorage = {
  getItem: async (key: string) => {
    try {
      const fromAsync = await AsyncStorage.getItem(key);
      if (fromAsync !== null) return fromAsync;

      // One-time migration: if preference exists in legacy SecureStore, move it to AsyncStorage.
      const fromSecure = await SecureStore.getItemAsync(key);
      if (fromSecure !== null) {
        await AsyncStorage.setItem(key, fromSecure);
        await SecureStore.deleteItemAsync(key);
        return fromSecure;
      }
    } catch (error) {
      if (__DEV__) console.error('[theme-store] migration failed', error);
    }

    return null;
  },
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set, get) => ({
      mode: 'system',
      hasHydrated: false,
      setMode: (mode) => set({ mode }),
      toggle: () => {
        const { mode } = get();
        const nextMode: ThemeMode =
          mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
        set({ mode: nextMode });
      },
      _setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => themeStorage),
      onRehydrateStorage: () => () => {
        useThemeStore.setState({ hasHydrated: true });
      },
    },
  ),
);
