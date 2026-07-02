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
  setDetailedMode: (value: boolean) => void;
}

const APP_MODE_STORAGE_KEY = 'vinesight-app-mode';

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      detailedMode: false,
      setDetailedMode: (value) => set({ detailedMode: value }),
    }),
    {
      name: APP_MODE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
