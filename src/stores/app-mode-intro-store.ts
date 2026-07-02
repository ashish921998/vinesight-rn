import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One-time "Simplified mode" intro prompt.
 *
 * Persisted flag tracking whether the user has already seen the explanatory
 * prompt that appears the first time they land on Simplified mode after the
 * toggle feature ships. Existing users have no prior key, so the flag defaults
 * to false and they see the prompt exactly once.
 */
interface AppModeIntroState {
  hasSeenSimplifiedModeIntro: boolean;
  hydrated: boolean;
}

interface AppModeIntroActions {
  markSeen: () => void;
}

const APP_MODE_INTRO_STORAGE_KEY = 'vinesight-app-mode-intro-v1';

export const useAppModeIntroStore = create<AppModeIntroState & AppModeIntroActions>()(
  persist(
    (set) => ({
      hasSeenSimplifiedModeIntro: false,
      hydrated: false,
      markSeen: () => set({ hasSeenSimplifiedModeIntro: true }),
    }),
    {
      name: APP_MODE_INTRO_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the "seen" flag, never transient state.
      partialize: (state) => ({ hasSeenSimplifiedModeIntro: state.hasSeenSimplifiedModeIntro }),
      // Hydration guard — stays false until AsyncStorage has delivered the
      // persisted value. Trigger logic MUST check this to avoid briefly showing
      // the prompt on the in-memory default (hasSeen = false) before the stored
      // "true" arrives for users who already dismissed it.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate app-mode-intro store:', error);
        }
        useAppModeIntroStore.setState({ hydrated: true });
      },
    },
  ),
);
