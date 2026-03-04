import {
  resolveNativeRuntimeRoutingDecision,
  type NativeBootstrapDecision,
  type NativeOnboardingSnapshot,
  type NativeRuntimeRoutingFlags,
} from '@/native/contracts';

const makeBootstrapDecision = (
  partial: Partial<NativeBootstrapDecision>,
): NativeBootstrapDecision => ({
  authState: 'unauthenticated',
  initialRouteId: 'auth.phone_login',
  initialExpoPath: '/(auth)/phone-login',
  ...partial,
});

const makeOnboardingSnapshot = (
  partial: Partial<NativeOnboardingSnapshot>,
): NativeOnboardingSnapshot => ({
  hasHydrated: true,
  isComplete: true,
  ...partial,
});

const makeFlags = (partial: Partial<NativeRuntimeRoutingFlags>): NativeRuntimeRoutingFlags => ({
  nativeUiEnabled: false,
  onboardingEnabled: false,
  ...partial,
});

describe('native runtime routing decision', () => {
  it('keeps splash while bootstrap auth is loading', () => {
    const result = resolveNativeRuntimeRoutingDecision(
      makeBootstrapDecision({
        authState: 'loading',
        initialRouteId: 'splash',
        initialExpoPath: '/index',
      }),
      makeOnboardingSnapshot({ isComplete: false }),
      makeFlags({ nativeUiEnabled: true, onboardingEnabled: true }),
    );

    expect(result).toEqual({
      isLoading: true,
      targetExpoPath: '/index',
    });
  });

  it('returns bootstrap path when native UI rollout is disabled', () => {
    const result = resolveNativeRuntimeRoutingDecision(
      makeBootstrapDecision({
        authState: 'authenticated',
        initialRouteId: 'tabs.home',
        initialExpoPath: '/(tabs)',
      }),
      makeOnboardingSnapshot({ isComplete: false }),
      makeFlags({ nativeUiEnabled: false, onboardingEnabled: true }),
    );

    expect(result).toEqual({
      isLoading: false,
      targetExpoPath: '/(tabs)',
    });
  });

  it('routes authenticated users to onboarding when native onboarding is enabled and incomplete', () => {
    const result = resolveNativeRuntimeRoutingDecision(
      makeBootstrapDecision({
        authState: 'authenticated',
        initialRouteId: 'tabs.home',
        initialExpoPath: '/(tabs)',
      }),
      makeOnboardingSnapshot({ hasHydrated: true, isComplete: false }),
      makeFlags({ nativeUiEnabled: true, onboardingEnabled: true }),
    );

    expect(result).toEqual({
      isLoading: false,
      targetExpoPath: '/onboarding',
    });
  });

  it('holds splash until onboarding store hydration completes', () => {
    const result = resolveNativeRuntimeRoutingDecision(
      makeBootstrapDecision({
        authState: 'authenticated',
        initialRouteId: 'tabs.home',
        initialExpoPath: '/(tabs)',
      }),
      makeOnboardingSnapshot({ hasHydrated: false, isComplete: false }),
      makeFlags({ nativeUiEnabled: true, onboardingEnabled: true }),
    );

    expect(result).toEqual({
      isLoading: true,
      targetExpoPath: '/index',
    });
  });

  it('routes authenticated users to tabs when onboarding is complete', () => {
    const result = resolveNativeRuntimeRoutingDecision(
      makeBootstrapDecision({
        authState: 'authenticated',
        initialRouteId: 'tabs.home',
        initialExpoPath: '/(tabs)',
      }),
      makeOnboardingSnapshot({ hasHydrated: true, isComplete: true }),
      makeFlags({ nativeUiEnabled: true, onboardingEnabled: true }),
    );

    expect(result).toEqual({
      isLoading: false,
      targetExpoPath: '/(tabs)',
    });
  });
});
