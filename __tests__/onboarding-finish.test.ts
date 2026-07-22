import { applyOnboardingCompletionEffects } from '@/features/onboarding/finish';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useAppModeIntroStore } from '@/stores/app-mode-intro-store';
import { useGuidedTourStore } from '@/features/guided-tour/store';

jest.mock('@/services/telemetry', () => ({
  telemetry: {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
  },
}));

const seedStores = () => {
  // Onboarding: not complete, notifications preference off.
  useOnboardingStore.setState({
    isComplete: false,
    currentStep: 'notifications',
    preferences: {
      country: '',
      currency: '',
      areaUnit: 'acres',
      notificationsEnabled: false,
    },
  });
  useAuthStore.setState({ hasSeenOnboarding: false });
  useNotificationStore.setState({ notificationPermissionPrompted: false });
  useAppModeIntroStore.setState({ hasSeenSimplifiedModeIntro: false });
  useGuidedTourStore.setState({
    status: 'not_started',
    hasSeenWelcomeThisSession: false,
  });
};

beforeEach(() => {
  seedStores();
});

describe('applyOnboardingCompletionEffects', () => {
  it('flips all completion flags including the notificationsEnabled preference', () => {
    applyOnboardingCompletionEffects({ resolvedFarmId: null, notificationsEnabled: true });

    expect(useOnboardingStore.getState().isComplete).toBe(true);
    expect(useOnboardingStore.getState().preferences.notificationsEnabled).toBe(true);
    expect(useAuthStore.getState().hasSeenOnboarding).toBe(true);
    expect(useNotificationStore.getState().notificationPermissionPrompted).toBe(true);
    expect(useAppModeIntroStore.getState().hasSeenSimplifiedModeIntro).toBe(true);

    // Tour marked complete so GuidedTourController's welcome card can't reappear.
    expect(useGuidedTourStore.getState().status).toBe('complete');
    expect(useGuidedTourStore.getState().hasSeenWelcomeThisSession).toBe(true);
  });

  it('persists a disabled notifications preference when skipping', () => {
    applyOnboardingCompletionEffects({ resolvedFarmId: null, notificationsEnabled: false });

    expect(useOnboardingStore.getState().preferences.notificationsEnabled).toBe(false);
    // The other flags still flip regardless of the notifications choice.
    expect(useOnboardingStore.getState().isComplete).toBe(true);
    expect(useAppModeIntroStore.getState().hasSeenSimplifiedModeIntro).toBe(true);
  });

  it('returns the no-farm route (replace only) when there is no resolved farm', () => {
    const route = applyOnboardingCompletionEffects({
      resolvedFarmId: null,
      notificationsEnabled: false,
    });

    expect(route).toEqual({ replace: '/(tabs)' });
    expect(route.push).toBeUndefined();
  });

  it('returns the farm route (replace + push) when a farm was resolved', () => {
    const route = applyOnboardingCompletionEffects({
      resolvedFarmId: 42,
      notificationsEnabled: true,
    });

    expect(route).toEqual({ replace: '/(tabs)', push: '/farm/42' });
  });
});
