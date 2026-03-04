import { resolveOnboardingRouteGuard } from '@/features/onboarding/route-guard';

describe('onboarding route guard', () => {
  it('stays loading while auth or onboarding hydration is in progress', () => {
    expect(
      resolveOnboardingRouteGuard({
        authLoading: true,
        isAuthenticated: false,
        onboardingHydrated: false,
        onboardingComplete: false,
      }),
    ).toEqual({ mode: 'loading' });

    expect(
      resolveOnboardingRouteGuard({
        authLoading: false,
        isAuthenticated: true,
        onboardingHydrated: false,
        onboardingComplete: false,
      }),
    ).toEqual({ mode: 'loading' });
  });

  it('redirects unauthenticated users to phone login', () => {
    expect(
      resolveOnboardingRouteGuard({
        authLoading: false,
        isAuthenticated: false,
        onboardingHydrated: true,
        onboardingComplete: false,
      }),
    ).toEqual({ mode: 'redirect_auth', href: '/(auth)/phone-login' });
  });

  it('redirects completed onboarding users to tabs', () => {
    expect(
      resolveOnboardingRouteGuard({
        authLoading: false,
        isAuthenticated: true,
        onboardingHydrated: true,
        onboardingComplete: true,
      }),
    ).toEqual({ mode: 'redirect_tabs', href: '/(tabs)' });
  });

  it('renders onboarding flow when authenticated and incomplete', () => {
    expect(
      resolveOnboardingRouteGuard({
        authLoading: false,
        isAuthenticated: true,
        onboardingHydrated: true,
        onboardingComplete: false,
      }),
    ).toEqual({ mode: 'render' });
  });
});
