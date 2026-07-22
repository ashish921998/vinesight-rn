import { useAppModeStore } from './app-mode-store';
import { useOnboardingStore } from './onboarding-store';

/** Reset device-persisted choices when a genuinely new farmer signs up. */
export const initializeNewFarmerExperience = () => {
  useAppModeStore.getState().setDetailedMode(false);
  useOnboardingStore.getState().resetOnboarding();
};
