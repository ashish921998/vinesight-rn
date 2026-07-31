import { useAppModeStore } from './app-mode-store';
import { useOnboardingStore } from './onboarding-store';

type PersistedStore = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
};

const waitForHydration = (store: PersistedStore): Promise<void> => {
  if (store.persist.hasHydrated()) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
};

/** Reset device-persisted choices when a genuinely new farmer signs up. */
export const initializeNewFarmerExperience = async (): Promise<void> => {
  await Promise.all([waitForHydration(useAppModeStore), waitForHydration(useOnboardingStore)]);
  useAppModeStore.getState().setDetailedMode(false);
  useOnboardingStore.getState().resetOnboarding();
};
