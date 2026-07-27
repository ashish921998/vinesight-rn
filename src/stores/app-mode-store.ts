import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLAG_KEYS, isFeatureEnabled, posthogClient, telemetry } from '@/services/telemetry';

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

/**
 * Stamps the current mode onto every subsequent event (super property) and onto
 * the person, so "who is on Simplified?" is answerable from any event breakdown
 * instead of being guessed from which tabs someone happened to visit.
 */
function reportAppMode(detailedMode: boolean) {
  const mode = detailedMode ? 'detailed' : 'simplified';
  void posthogClient?.register({ app_mode: mode });
  telemetry.capture('app_mode_set', { app_mode: mode, $set: { app_mode: mode } });
}

/**
 * Remote ramp-down: when FORCE_SIMPLE_MODE is on, anyone still in Detailed mode
 * is pulled back to Simplified. Applied at hydration (from PostHog's persisted
 * flag cache) and again whenever flags refresh, so it lands without a release.
 * Deliberately sticky — it writes through the store, so the user stays on
 * Simplified even after the flag is turned off again.
 */
function enforceSimpleMode() {
  if (!isFeatureEnabled(FLAG_KEYS.FORCE_SIMPLE_MODE)) return;
  if (!useAppModeStore.getState().detailedMode) return;
  useAppModeStore.getState().setDetailedMode(false);
}

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      detailedMode: false,
      hydrated: false,
      setDetailedMode: (value) => {
        // Kill-switch: when FORCE_SIMPLE_MODE is active, refuse to enter
        // Detailed mode so the Settings toggle can't bypass enforcement
        // before the next flag refresh runs enforceSimpleMode().
        if (value && isFeatureEnabled(FLAG_KEYS.FORCE_SIMPLE_MODE)) return;
        set({ detailedMode: value });
        reportAppMode(value);
      },
    }),
    {
      name: APP_MODE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the user's choice, never transient state.
      partialize: (state) => ({ detailedMode: state.detailedMode }),
      // Hydration guard — stays false until AsyncStorage has delivered the
      // persisted value. Cold-start paths (notification deep-linking) MUST check
      // this to avoid acting on the in-memory default (Simplified) before the
      // stored mode arrives.
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate app-mode store:', error);
        }
        useAppModeStore.setState({ hydrated: true });
        reportAppMode(state?.detailedMode ?? false);
        enforceSimpleMode();
      },
    },
  ),
);

// Flags arrive asynchronously after launch, so re-check on every refresh rather
// than only at hydration (where the cache may still be empty on a first run).
posthogClient?.onFeatureFlags(enforceSimpleMode);
