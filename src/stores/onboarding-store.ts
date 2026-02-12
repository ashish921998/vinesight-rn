/**
 * Onboarding Store for Vinesight
 * Zustand store for managing onboarding state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';
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
  currentStep: 'language',
  preferences: {
    country: '',
    currency: '',
    areaUnit: 'acres',
    notificationsEnabled: false,
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
      storage: createJSONStorage(() => ExpoSecureStoreAdapter),
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);
