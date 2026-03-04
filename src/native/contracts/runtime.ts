import type { NativeBootstrapDecision } from './adapter';

export interface NativeOnboardingSnapshot {
  readonly hasHydrated: boolean;
  readonly isComplete: boolean;
}

export interface NativeRuntimeRoutingFlags {
  readonly nativeUiEnabled: boolean;
  readonly onboardingEnabled: boolean;
}

export interface NativeRuntimeRoutingDecision {
  readonly isLoading: boolean;
  readonly targetExpoPath: string;
}

const SPLASH_PATH = '/index';
const ONBOARDING_PATH = '/onboarding';

export const resolveNativeRuntimeRoutingDecision = (
  bootstrapDecision: NativeBootstrapDecision,
  onboardingSnapshot: NativeOnboardingSnapshot,
  flags: NativeRuntimeRoutingFlags,
): NativeRuntimeRoutingDecision => {
  if (bootstrapDecision.authState === 'loading') {
    return {
      isLoading: true,
      targetExpoPath: SPLASH_PATH,
    };
  }

  if (!flags.nativeUiEnabled) {
    return {
      isLoading: false,
      targetExpoPath: bootstrapDecision.initialExpoPath,
    };
  }

  if (bootstrapDecision.authState !== 'authenticated') {
    return {
      isLoading: false,
      targetExpoPath: bootstrapDecision.initialExpoPath,
    };
  }

  if (!flags.onboardingEnabled) {
    return {
      isLoading: false,
      targetExpoPath: bootstrapDecision.initialExpoPath,
    };
  }

  if (!onboardingSnapshot.hasHydrated) {
    return {
      isLoading: true,
      targetExpoPath: SPLASH_PATH,
    };
  }

  if (!onboardingSnapshot.isComplete) {
    return {
      isLoading: false,
      targetExpoPath: ONBOARDING_PATH,
    };
  }

  return {
    isLoading: false,
    targetExpoPath: bootstrapDecision.initialExpoPath,
  };
};
