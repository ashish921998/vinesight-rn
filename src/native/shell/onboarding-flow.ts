import { nativeUiContractManifest } from '@/native/contracts';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/types/onboarding';

export type NativeOnboardingRouteOutcome = 'onboarding' | 'tabs.home' | 'auth.phone_login';

export interface NativeOnboardingSnapshot {
  readonly hasHydrated: boolean;
  readonly isAuthenticated: boolean;
  readonly isOnboardingComplete: boolean;
  readonly currentStep: OnboardingStep;
}

export type NativeOnboardingEvent =
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'complete' }
  | { readonly type: 'reset' }
  | { readonly type: 'skip_to_complete' };

const routeIds = nativeUiContractManifest.routes.map((route) => route.id);

const onboardingRouteId = 'onboarding';
const onboardingExistsInManifest = routeIds.includes(onboardingRouteId);

export const resolveOnboardingEntryRoute = (
  snapshot: NativeOnboardingSnapshot,
): NativeOnboardingRouteOutcome => {
  if (!snapshot.hasHydrated) {
    return 'onboarding';
  }

  if (!snapshot.isAuthenticated) {
    return 'auth.phone_login';
  }

  return snapshot.isOnboardingComplete ? 'tabs.home' : 'onboarding';
};

const indexOfStep = (step: OnboardingStep): number => ONBOARDING_STEPS.indexOf(step);

export const resolveNextOnboardingStep = (
  currentStep: OnboardingStep,
  event: NativeOnboardingEvent,
): OnboardingStep => {
  const currentIndex = indexOfStep(currentStep);

  switch (event.type) {
    case 'next': {
      if (currentIndex < ONBOARDING_STEPS.length - 1) {
        return ONBOARDING_STEPS[currentIndex + 1];
      }
      return currentStep;
    }
    case 'previous': {
      if (currentIndex > 0) {
        return ONBOARDING_STEPS[currentIndex - 1];
      }
      return currentStep;
    }
    case 'complete':
    case 'skip_to_complete':
      return 'complete';
    case 'reset':
      return ONBOARDING_STEPS[0];
    default:
      return currentStep;
  }
};

export const assertNativeOnboardingFlowParity = (): void => {
  if (!onboardingExistsInManifest) {
    throw new Error('onboarding route is missing from native UI contract manifest');
  }

  const uniqueSteps = new Set(ONBOARDING_STEPS);
  if (uniqueSteps.size !== ONBOARDING_STEPS.length) {
    throw new Error('onboarding step order contains duplicate entries');
  }

  if (ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1] !== 'complete') {
    throw new Error('onboarding final step must be complete');
  }
};
