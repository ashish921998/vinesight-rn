export interface OnboardingRouteGuardInput {
  readonly authLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly onboardingHydrated: boolean;
  readonly onboardingComplete: boolean;
}

export type OnboardingRouteGuardResult =
  | { readonly mode: 'loading' }
  | { readonly mode: 'redirect_auth'; readonly href: '/(auth)/phone-login' }
  | { readonly mode: 'redirect_tabs'; readonly href: '/(tabs)' }
  | { readonly mode: 'render' };

export const resolveOnboardingRouteGuard = (
  input: OnboardingRouteGuardInput,
): OnboardingRouteGuardResult => {
  if (input.authLoading || !input.onboardingHydrated) {
    return { mode: 'loading' };
  }

  if (!input.isAuthenticated) {
    return { mode: 'redirect_auth', href: '/(auth)/phone-login' };
  }

  if (input.onboardingComplete) {
    return { mode: 'redirect_tabs', href: '/(tabs)' };
  }

  return { mode: 'render' };
};
