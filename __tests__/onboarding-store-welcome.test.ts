jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  AFTER_FIRST_UNLOCK: 0,
}));

import { useOnboardingStore } from '@/stores/onboarding-store';

type Migrate = (state: unknown, version: number) => { hasSeenWelcome: boolean };

const migrate = useOnboardingStore.persist.getOptions().migrate as unknown as Migrate;

describe('onboarding store welcome flag', () => {
  it('keeps hasSeenWelcome when onboarding is reset', () => {
    useOnboardingStore.getState().markWelcomeSeen();
    useOnboardingStore.getState().resetOnboarding();
    expect(useOnboardingStore.getState().hasSeenWelcome).toBe(true);
  });

  it('marks every pre-v4 persisted user as having seen welcome', () => {
    expect(migrate({ isComplete: false, currentStep: 'firstFarm' }, 3).hasSeenWelcome).toBe(true);
    expect(migrate({ isComplete: true, currentStep: 'complete' }, 3).hasSeenWelcome).toBe(true);
  });

  it('keeps an explicit persisted value', () => {
    expect(migrate({ hasSeenWelcome: false, currentStep: 'firstFarm' }, 3).hasSeenWelcome).toBe(
      false,
    );
  });
});
