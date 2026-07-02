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
  hasHydrated: boolean;
}

interface AppModeActions {
  setDetailedMode: (value: boolean) => void;
  toggleDetailedMode: () => void;
  _setHasHydrated: (value: boolean) => void;
}

const APP_MODE_STORAGE_KEY = 'vinesight-app-mode';

export const useAppModeStore = create<AppModeState & AppModeActions>()(
  persist(
    (set, get) => ({
      detailedMode: false,
      hasHydrated: false,
      setDetailedMode: (value) => set({ detailedMode: value }),
      toggleDetailedMode: () => set({ detailedMode: !get().detailedMode }),
      _setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: APP_MODE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => {
        useAppModeStore.setState({ hasHydrated: true });
      },
    },
  ),
);
