import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { SupportedLanguageCode } from '@/i18n/languages';

interface LanguageState {
  language: SupportedLanguageCode | null;
  hasHydrated: boolean;
}

interface LanguageActions {
  setLanguage: (language: SupportedLanguageCode) => void;
  clearLanguage: () => void;
  _setHasHydrated: (value: boolean) => void;
}

const LANGUAGE_STORAGE_KEY = 'vinesight-language';

const languageStorage = {
  getItem: async (key: string) => {
    const fromAsync = await AsyncStorage.getItem(key);
    if (fromAsync !== null) return fromAsync;

    // One-time migration: if preference exists in legacy SecureStore, move it to AsyncStorage.
    const fromSecure = await SecureStore.getItemAsync(key);
    if (fromSecure !== null) {
      await AsyncStorage.setItem(key, fromSecure);
      await SecureStore.deleteItemAsync(key);
      return fromSecure;
    }

    return null;
  },
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const useLanguageStore = create<LanguageState & LanguageActions>()(
  persist(
    (set) => ({
      language: null,
      hasHydrated: false,

      setLanguage: (language) => set({ language }),
      clearLanguage: () => set({ language: null }),
      _setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => languageStorage),
      onRehydrateStorage: () => () => {
        useLanguageStore.setState({ hasHydrated: true });
      },
    },
  ),
);
