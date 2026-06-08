import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remembers the last farm the user chatted about in the AI assistant so the
 * assistant opens straight into a useful context instead of nagging the user
 * to pick a farm every visit. Assistant-scoped on purpose — it does not change
 * the active farm anywhere else in the app.
 */
interface AssistantFarmState {
  lastFarmId: number | null;
  setLastFarmId: (farmId: number | null) => void;
}

const STORAGE_KEY = 'vinesight-assistant-farm';

export const useAssistantFarmStore = create<AssistantFarmState>()(
  persist(
    (set) => ({
      lastFarmId: null,
      setLastFarmId: (lastFarmId) => set({ lastFarmId }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
