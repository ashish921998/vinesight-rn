import { useMemo } from 'react';
import { nativeUiFeatureFlags } from '@/constants/native-ui-flags';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useNativeBootstrapDecision } from './hook';
import { resolveNativeRuntimeRoutingDecision, type NativeRuntimeRoutingDecision } from './runtime';

export const useNativeRuntimeRoutingDecision = (): NativeRuntimeRoutingDecision => {
  const bootstrapDecision = useNativeBootstrapDecision();
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const isOnboardingComplete = useOnboardingStore((state) => state.isComplete);

  return useMemo(
    () =>
      resolveNativeRuntimeRoutingDecision(
        bootstrapDecision,
        {
          hasHydrated: onboardingHasHydrated,
          isComplete: isOnboardingComplete,
        },
        nativeUiFeatureFlags,
      ),
    [bootstrapDecision, onboardingHasHydrated, isOnboardingComplete],
  );
};
