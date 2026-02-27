import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { GUIDED_TOUR_STORAGE_KEY, GUIDED_TOUR_VERSION } from './constants';
import type {
  GuidedTourPatchPayload,
  GuidedTourServerState,
  GuidedTourState,
  GuidedTourStep,
  GuidedTourStepMeta,
} from './types';

interface GuidedTourStore extends GuidedTourState {
  isSuspended: boolean;
  isSeasonFormVisible: boolean;
  hasActiveSeasonForCurrentFarm: boolean | null;
  hydrateComplete: () => void;
  startTour: () => void;
  showStep: (step: GuidedTourStep) => void;
  completeStep: (step: GuidedTourStep, meta?: GuidedTourStepMeta) => void;
  skipTour: (step: GuidedTourStep) => void;
  completeTour: () => void;
  expireTour: () => void;
  resumeIfEligible: () => void;
  setLastActiveAt: (ts?: string) => void;
  setRemindersSent: (count: 0 | 1 | 2) => void;
  resetForReplay: () => void;
  setHasSeenWelcomeThisSession: (value: boolean) => void;
  setSuspended: (value: boolean) => void;
  setSeasonFormVisible: (value: boolean) => void;
  setHasActiveSeasonForCurrentFarm: (value: boolean | null) => void;
  applyServerState: (serverState: GuidedTourServerState) => void;
  toServerPatch: (locale?: 'en' | 'hi' | 'mr') => GuidedTourPatchPayload;
}

const initialState: GuidedTourState = {
  status: 'not_started',
  currentStep: 'welcome',
  skippedAtStep: null,
  remindersSent: 0,
  startedAt: null,
  completedAt: null,
  expiredAt: null,
  lastActiveAt: null,
  stepShownAt: null,
  activeFarmId: null,
  hasSeenWelcomeThisSession: false,
  hasHydrated: false,
  version: GUIDED_TOUR_VERSION,
};

const isWeb = process.env.EXPO_OS === 'web';
const storage = {
  getItem: async (key: string) => {
    if (isWeb) return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (isWeb) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const nowIso = () => new Date().toISOString();

export const useGuidedTourStore = create<GuidedTourStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      isSuspended: false,
      isSeasonFormVisible: false,
      hasActiveSeasonForCurrentFarm: null,
      hydrateComplete: () => set({ hasHydrated: true }),
      setHasSeenWelcomeThisSession: (value) => set({ hasSeenWelcomeThisSession: value }),
      setSuspended: (value) => set({ isSuspended: value }),
      setSeasonFormVisible: (value) => set({ isSeasonFormVisible: value }),
      setHasActiveSeasonForCurrentFarm: (value) => set({ hasActiveSeasonForCurrentFarm: value }),
      startTour: () =>
        set((state) => ({
          status: 'in_progress',
          currentStep: 'add_farm',
          startedAt: state.startedAt ?? nowIso(),
          stepShownAt: null,
          skippedAtStep: null,
          activeFarmId: null,
          hasSeenWelcomeThisSession: true,
          expiredAt: null,
          completedAt: null,
        })),
      showStep: (step) => set({ currentStep: step, stepShownAt: nowIso() }),
      completeStep: (step, meta) =>
        set((state) => ({
          currentStep:
            step === 'add_farm'
              ? 'add_log'
              : step === 'add_log'
                ? 'complete_card'
                : state.currentStep,
          activeFarmId: typeof meta?.farmId === 'number' ? meta.farmId : state.activeFarmId,
          stepShownAt: nowIso(),
        })),
      skipTour: (step) =>
        set({
          status: 'skipped',
          skippedAtStep: step,
          stepShownAt: nowIso(),
          hasSeenWelcomeThisSession: true,
        }),
      completeTour: () =>
        set({
          status: 'complete',
          currentStep: 'complete_card',
          completedAt: nowIso(),
          stepShownAt: nowIso(),
          hasSeenWelcomeThisSession: true,
        }),
      expireTour: () => set({ status: 'expired', expiredAt: nowIso() }),
      resumeIfEligible: () => {
        const state = get();
        if (state.status !== 'in_progress') return;
        set({ hasSeenWelcomeThisSession: true });
      },
      setLastActiveAt: (ts) => set({ lastActiveAt: ts ?? nowIso() }),
      setRemindersSent: (count) => set({ remindersSent: count }),
      resetForReplay: () =>
        set({
          ...initialState,
          hasHydrated: true,
          hasSeenWelcomeThisSession: false,
          isSuspended: false,
          isSeasonFormVisible: false,
          hasActiveSeasonForCurrentFarm: null,
        }),
      applyServerState: (serverState) =>
        set((state) => {
          const localTs = Date.parse(
            state.lastActiveAt ?? state.completedAt ?? state.startedAt ?? '',
          );
          const serverTs = Date.parse(serverState.updated_at ?? serverState.last_active_at ?? '');
          if (Number.isFinite(localTs) && Number.isFinite(serverTs) && localTs > serverTs) {
            return state;
          }
          return {
            ...state,
            status: serverState.tour_status,
            currentStep: serverState.current_step,
            skippedAtStep: serverState.skipped_at_step,
            remindersSent: serverState.reminders_sent,
            startedAt: serverState.tour_started_at,
            completedAt: serverState.tour_completed_at,
            expiredAt: serverState.tour_expired_at,
            lastActiveAt: serverState.last_active_at,
            activeFarmId: serverState.active_farm_id,
          };
        }),
      toServerPatch: (locale) => {
        const state = get();
        return {
          tour_status: state.status,
          current_step: state.currentStep,
          skipped_at_step: state.skippedAtStep,
          reminders_sent: state.remindersSent,
          tour_started_at: state.startedAt,
          tour_completed_at: state.completedAt,
          tour_expired_at: state.expiredAt,
          last_active_at: state.lastActiveAt,
          active_farm_id: state.activeFarmId,
          locale: locale ?? 'en',
          tour_version: state.version,
        };
      },
    }),
    {
      name: GUIDED_TOUR_STORAGE_KEY,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        status: state.status,
        currentStep: state.currentStep,
        skippedAtStep: state.skippedAtStep,
        remindersSent: state.remindersSent,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        expiredAt: state.expiredAt,
        lastActiveAt: state.lastActiveAt,
        stepShownAt: state.stepShownAt,
        activeFarmId: state.activeFarmId,
        version: state.version,
      }),
      onRehydrateStorage: () => () => {
        useGuidedTourStore.setState({ hasHydrated: true });
      },
    },
  ),
);
