import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

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
      name: 'vinesight-language',
      storage: createJSONStorage(() => ExpoSecureStoreAdapter),
      onRehydrateStorage: () => () => {
        useLanguageStore.setState({ hasHydrated: true });
      },
    },
  ),
);
