import {
  assertNativeOnboardingFlowParity,
  resolveNextOnboardingStep,
  resolveOnboardingEntryRoute,
} from '@/native/shell';

describe('native onboarding flow parity', () => {
  it('keeps onboarding flow aligned with contract and step order', () => {
    expect(() => assertNativeOnboardingFlowParity()).not.toThrow();
  });

  it('routes unauthenticated users to phone login', () => {
    expect(
      resolveOnboardingEntryRoute({
        hasHydrated: true,
        isAuthenticated: false,
        isOnboardingComplete: false,
        currentStep: 'welcome',
      }),
    ).toBe('auth.phone_login');
  });

  it('routes authenticated users to tabs when onboarding is complete', () => {
    expect(
      resolveOnboardingEntryRoute({
        hasHydrated: true,
        isAuthenticated: true,
        isOnboardingComplete: true,
        currentStep: 'complete',
      }),
    ).toBe('tabs.home');
  });

  it('keeps onboarding route while onboarding is incomplete', () => {
    expect(
      resolveOnboardingEntryRoute({
        hasHydrated: true,
        isAuthenticated: true,
        isOnboardingComplete: false,
        currentStep: 'features',
      }),
    ).toBe('onboarding');
  });

  it('resolves next/previous onboarding transitions', () => {
    expect(resolveNextOnboardingStep('welcome', { type: 'next' })).toBe('features');
    expect(resolveNextOnboardingStep('features', { type: 'previous' })).toBe('welcome');
  });

  it('resolves completion-oriented transitions', () => {
    expect(resolveNextOnboardingStep('preferences', { type: 'skip_to_complete' })).toBe('complete');
    expect(resolveNextOnboardingStep('notifications', { type: 'complete' })).toBe('complete');
    expect(resolveNextOnboardingStep('complete', { type: 'reset' })).toBe('language');
  });
});
