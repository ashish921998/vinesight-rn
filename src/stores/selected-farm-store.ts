import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The farm the user is currently "logging to" on the Simplified Home.
 *
 * Surfaces as a context bar ("Logging to: <farm>") so quick actions log
 * directly to this farm without a per-action picker step. Persisted across
 * sessions. A stale id (deleted farm) is tolerated — consumers resolve it
 * against the live farms list and fall back to the first farm.
 */
interface SelectedFarmState {
  farmId: number | null;
  /** False until AsyncStorage has delivered the persisted value. */
  hydrated: boolean;
  setFarmId: (id: number | null) => void;
}

const SELECTED_FARM_STORAGE_KEY = 'vinesight-selected-farm';

export const useSelectedFarmStore = create<SelectedFarmState>()(
  persist(
    (set) => ({
      farmId: null,
      hydrated: false,
      setFarmId: (id) => set({ farmId: id }),
    }),
    {
      name: SELECTED_FARM_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the user's choice, never transient state.
      partialize: (state) => ({ farmId: state.farmId }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate selected-farm store:', error);
        }
        useSelectedFarmStore.setState({ hydrated: true });
      },
    },
  ),
);
