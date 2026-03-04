import { useOnboardingStore } from '@/stores/onboarding-store';

describe('onboarding store', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      isComplete: false,
      hasHydrated: true,
      currentStep: 'language',
      preferences: {
        country: '',
        currency: '',
        areaUnit: 'acres',
        notificationsEnabled: false,
      },
    });
  });

  it('marks onboarding complete and moves to complete step', () => {
    useOnboardingStore.getState().completeOnboarding();

    const state = useOnboardingStore.getState();
    expect(state.isComplete).toBe(true);
    expect(state.currentStep).toBe('complete');
  });

  it('supports step progression and preference updates', () => {
    const store = useOnboardingStore.getState();

    store.nextStep();
    store.setPreferences({ areaUnit: 'hectares', notificationsEnabled: true });

    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe('welcome');
    expect(state.preferences.areaUnit).toBe('hectares');
    expect(state.preferences.notificationsEnabled).toBe(true);
  });
});
