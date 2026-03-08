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
  OnboardingPreferences,
  ONBOARDING_STEPS,
} from '../types/onboarding';
interface OnboardingStore extends OnboardingState {
  // Actions
  setCurrentStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  setPreferences: (preferences: Partial<OnboardingPreferences>) => void;
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
      version: 1,
      storage: createJSONStorage(() => onboardingStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // v0 → v1: 'preferences' step was renamed to 'firstFarm',
          // 'language' step was renamed to 'welcome'.
          // Fall back any unknown step to 'welcome' so users don't get stuck.
          const step = state.currentStep as string;
          if (step === 'preferences') {
            state.currentStep = 'firstFarm';
          } else if (step === 'language' || !ONBOARDING_STEPS.includes(step as OnboardingStep)) {
            state.currentStep = 'welcome';
          }
        }
        return state as unknown as OnboardingStore;
      },
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);
