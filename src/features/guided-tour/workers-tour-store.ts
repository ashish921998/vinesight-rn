import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Use a stable key. Bump the version ONLY if you need to force-reset ALL
// users (e.g. after a breaking schema change). Do NOT bump just for testing —
// call resetAllTours() from the dev screen instead.
const WORKERS_TOUR_STORAGE_KEY = 'vinesight-workers-tour-v1';

// ─── Overview tour (Workers screen) ───────────────────────────────────────────
export type WorkersTourStep = 'tabs_overview' | 'add_worker' | 'attendance_tab' | 'mark_day';

const STEP_ORDER: WorkersTourStep[] = ['tabs_overview', 'add_worker', 'attendance_tab', 'mark_day'];

// ─── Add Worker form tour ─────────────────────────────────────────────────────
export type AddWorkerTourStep = 'name_field' | 'daily_rate_field' | 'save_button';
const ADD_WORKER_STEP_ORDER: AddWorkerTourStep[] = [
  'name_field',
  'daily_rate_field',
  'save_button',
];

// ─── Settlement tour ──────────────────────────────────────────────────────────
export type SettlementTourStep = 'worker_picker' | 'period_selector' | 'calculate_btn';
const SETTLEMENT_STEP_ORDER: SettlementTourStep[] = [
  'worker_picker',
  'period_selector',
  'calculate_btn',
];

// ─── Store ────────────────────────────────────────────────────────────────────
interface WorkersTourStore {
  /**
   * Hydration guard — stays false until AsyncStorage has finished loading.
   * All tour trigger logic MUST check this before starting any tour, to avoid
   * the race condition where the store has its in-memory defaults (hasSeenX = false)
   * before the persisted "true" values arrive from AsyncStorage.
   */
  _hydrated: boolean;

  // Overview tour
  hasSeenTour: boolean;
  isActive: boolean;
  currentStep: WorkersTourStep;

  // Add Worker form tour
  hasSeenAddWorkerTour: boolean;
  isAddWorkerTourActive: boolean;
  addWorkerTourStep: AddWorkerTourStep;

  // Settlement tour
  hasSeenSettlementTour: boolean;
  isSettlementTourActive: boolean;
  settlementTourStep: SettlementTourStep;

  // Overview tour actions
  startTour: () => void;
  advanceStep: () => void;
  completeTour: () => void;
  skipTour: () => void;
  resetTour: () => void;

  // Add Worker tour actions
  startAddWorkerTour: () => void;
  advanceAddWorkerStep: () => void;
  skipAddWorkerTour: () => void;

  // Settlement tour actions
  startSettlementTour: () => void;
  advanceSettlementStep: () => void;
  skipSettlementTour: () => void;

  // Reset all (for Settings / dev screen)
  resetAllTours: () => void;
}

export const useWorkersTourStore = create<WorkersTourStore>()(
  persist(
    (set, get) => ({
      // ── Hydration ──────────────────────────────────────────────────────────
      _hydrated: false,

      // ── Overview tour ──────────────────────────────────────────────────────
      hasSeenTour: false,
      isActive: false,
      currentStep: 'tabs_overview',

      startTour: () => set({ isActive: true, currentStep: 'tabs_overview' }),

      advanceStep: () => {
        const { currentStep } = get();
        const idx = STEP_ORDER.indexOf(currentStep);
        const next = STEP_ORDER[idx + 1];
        if (next) {
          set({ currentStep: next });
        } else {
          set({ isActive: false, hasSeenTour: true, currentStep: 'tabs_overview' });
        }
      },

      completeTour: () => set({ isActive: false, hasSeenTour: true, currentStep: 'tabs_overview' }),

      skipTour: () => set({ isActive: false, hasSeenTour: true, currentStep: 'tabs_overview' }),

      resetTour: () => set({ hasSeenTour: false, isActive: false, currentStep: 'tabs_overview' }),

      // ── Add Worker form tour ───────────────────────────────────────────────
      hasSeenAddWorkerTour: false,
      isAddWorkerTourActive: false,
      addWorkerTourStep: 'name_field',

      startAddWorkerTour: () =>
        set({ isAddWorkerTourActive: true, addWorkerTourStep: 'name_field' }),

      advanceAddWorkerStep: () => {
        const { addWorkerTourStep } = get();
        const idx = ADD_WORKER_STEP_ORDER.indexOf(addWorkerTourStep);
        const next = ADD_WORKER_STEP_ORDER[idx + 1];
        if (next) {
          set({ addWorkerTourStep: next });
        } else {
          set({
            isAddWorkerTourActive: false,
            hasSeenAddWorkerTour: true,
            addWorkerTourStep: 'name_field',
          });
        }
      },

      skipAddWorkerTour: () =>
        set({
          isAddWorkerTourActive: false,
          hasSeenAddWorkerTour: true,
          addWorkerTourStep: 'name_field',
        }),

      // ── Settlement tour ────────────────────────────────────────────────────
      hasSeenSettlementTour: false,
      isSettlementTourActive: false,
      settlementTourStep: 'worker_picker',

      startSettlementTour: () =>
        set({ isSettlementTourActive: true, settlementTourStep: 'worker_picker' }),

      advanceSettlementStep: () => {
        const { settlementTourStep } = get();
        const idx = SETTLEMENT_STEP_ORDER.indexOf(settlementTourStep);
        const next = SETTLEMENT_STEP_ORDER[idx + 1];
        if (next) {
          set({ settlementTourStep: next });
        } else {
          set({
            isSettlementTourActive: false,
            hasSeenSettlementTour: true,
            settlementTourStep: 'worker_picker',
          });
        }
      },

      skipSettlementTour: () =>
        set({
          isSettlementTourActive: false,
          hasSeenSettlementTour: true,
          settlementTourStep: 'worker_picker',
        }),

      // ── Reset all ──────────────────────────────────────────────────────────
      resetAllTours: () =>
        set({
          hasSeenTour: false,
          isActive: false,
          currentStep: 'tabs_overview',
          hasSeenAddWorkerTour: false,
          isAddWorkerTourActive: false,
          addWorkerTourStep: 'name_field',
          hasSeenSettlementTour: false,
          isSettlementTourActive: false,
          settlementTourStep: 'worker_picker',
        }),
    }),
    {
      name: WORKERS_TOUR_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the "seen" flags. Never persist isActive/currentStep:
      // if the app crashes mid-tour the overlay won't be stuck on next launch.
      partialize: (state) => ({
        hasSeenTour: state.hasSeenTour,
        hasSeenAddWorkerTour: state.hasSeenAddWorkerTour,
        hasSeenSettlementTour: state.hasSeenSettlementTour,
      }),
      // Set _hydrated = true once AsyncStorage has delivered the persisted values.
      // All tour trigger useEffects check this flag so they never fire on the
      // brief in-memory defaults pass (where every hasSeenX is still false).
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate workers tour store:', error);
        }
        useWorkersTourStore.setState({ _hydrated: true });
      },
    },
  ),
);
