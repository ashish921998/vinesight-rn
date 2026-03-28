/**
 * Onboarding Store for Vinesight
 * Zustand store for managing onboarding state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import {
  OnboardingState,
  OnboardingStep,
  OnboardingActionType,
  OnboardingActivationState,
  OnboardingPreferences,
  DEFAULT_ONBOARDING_ACTIVATION_STATE,
  ONBOARDING_STEPS,
} from '../types/onboarding';
interface OnboardingStore extends OnboardingState {
  // Actions
  setCurrentStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  setPreferences: (preferences: Partial<OnboardingPreferences>) => void;
  markFarmCreated: (farmId: number | null) => void;
  markFirstActionStarted: (actionType: OnboardingActionType) => void;
  markFirstActionCompleted: (actionType: OnboardingActionType) => void;
  resetActivation: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  _setHasHydrated: (value: boolean) => void;
}

const initialState: OnboardingState = {
  isComplete: false,
  hasHydrated: false,
  currentStep: 'welcome',
  preferences: {
    country: '',
    currency: '',
    areaUnit: 'acres',
    notificationsEnabled: false,
  },
  activation: { ...DEFAULT_ONBOARDING_ACTIVATION_STATE },
};

const parsePersistedActivation = (value: unknown): OnboardingActivationState => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_ONBOARDING_ACTIVATION_STATE };
  }

  const raw = value as Partial<OnboardingActivationState>;
  return {
    farmCreated: raw.farmCreated === true,
    farmId: typeof raw.farmId === 'number' ? raw.farmId : null,
    firstActionType:
      raw.firstActionType === 'log' ||
      raw.firstActionType === 'note' ||
      raw.firstActionType === 'task'
        ? raw.firstActionType
        : null,
    firstActionStartedAt:
      typeof raw.firstActionStartedAt === 'string' ? raw.firstActionStartedAt : null,
    firstActionCompletedAt:
      typeof raw.firstActionCompletedAt === 'string' ? raw.firstActionCompletedAt : null,
  };
};

const isWeb = process.env.EXPO_OS === 'web';

const onboardingStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
        if (currentIndex < ONBOARDING_STEPS.length - 1) {
          set({ currentStep: ONBOARDING_STEPS[currentIndex + 1] });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
        if (currentIndex > 0) {
          set({ currentStep: ONBOARDING_STEPS[currentIndex - 1] });
        }
      },

      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      markFarmCreated: (farmId) =>
        set((state) => ({
          activation: {
            ...state.activation,
            farmCreated: true,
            farmId,
          },
        })),

      markFirstActionStarted: (actionType) =>
        set((state) => ({
          activation: {
            ...state.activation,
            firstActionType: actionType,
            firstActionStartedAt: new Date().toISOString(),
          },
        })),

      markFirstActionCompleted: (actionType) =>
        set((state) => ({
          activation: {
            ...state.activation,
            firstActionType: actionType,
            firstActionCompletedAt: new Date().toISOString(),
          },
        })),

      resetActivation: () =>
        set({
          activation: { ...DEFAULT_ONBOARDING_ACTIVATION_STATE },
        }),

      completeOnboarding: () =>
        set({
          isComplete: true,
          currentStep: 'complete',
        }),

      resetOnboarding: () => set(initialState),
      _setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'vinesight-onboarding',
      version: 2,
      storage: createJSONStorage(() => onboardingStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        let currentStep = state.currentStep as string;
        const activation = parsePersistedActivation(state.activation);
        if (version === 0) {
          // v0 → v1: 'preferences' step was renamed to 'firstFarm',
          // 'language' step was renamed to 'welcome'.
          // Fall back any unknown step to 'welcome' so users don't get stuck.
          if (currentStep === 'preferences') {
            currentStep = 'firstFarm';
          } else if (currentStep === 'language') {
            currentStep = 'welcome';
          }
        }

        if (version <= 1) {
          // v1 → v2: insert firstAction as required step before notifications.
          if (currentStep === 'notifications' && activation.firstActionCompletedAt === null) {
            currentStep = 'firstAction';
          }
          if (currentStep === 'complete' && state.isComplete !== true) {
            currentStep = activation.farmCreated ? 'firstAction' : 'firstFarm';
          }
        }

        if (!ONBOARDING_STEPS.includes(currentStep as OnboardingStep)) {
          currentStep = 'welcome';
        }

        return {
          ...initialState,
          ...state,
          currentStep: currentStep as OnboardingStep,
          activation,
        } as unknown as OnboardingStore;
      },
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);
