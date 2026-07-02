import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * App mode toggle.
 *
 * `detailedMode === false` (default) → Simplified experience:
 * farms, farm logging, warehouse, reports only.
 *
 * `detailedMode === true` → also unlocks workers, tools/calculators,
 * AI assistant, and tasks.
 */
interface AppModeState {
  detailedMode: boolean;
  /** False until AsyncStorage has delivered the persisted value. */
  hydrated: boolean;
  setDetailedMode: (value: boolean) => void;
}

const APP_MODE_STORAGE_KEY = 'vinesight-app-mode';

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      detailedMode: false,
      hydrated: false,
      setDetailedMode: (value) => set({ detailedMode: value }),
    }),
    {
      name: APP_MODE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the user's choice, never transient state.
      partialize: (state) => ({ detailedMode: state.detailedMode }),
      // Hydration guard — stays false until AsyncStorage has delivered the
      // persisted value. Cold-start paths (notification deep-linking, the
      // Simplified-mode intro) MUST check this to avoid acting on the in-memory
      // default (Simplified) before the stored mode arrives.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate app-mode store:', error);
        }
        useAppModeStore.setState({ hydrated: true });
      },
    },
  ),
);
