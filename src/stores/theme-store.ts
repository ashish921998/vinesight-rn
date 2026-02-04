import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';

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
      name: 'vinesight-theme',
      storage: createJSONStorage(() => ExpoSecureStoreAdapter),
      onRehydrateStorage: () => () => {
        useThemeStore.setState({ hasHydrated: true });
      },
    },
  ),
);
