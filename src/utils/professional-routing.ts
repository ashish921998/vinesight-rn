import type { ProfessionalWorkspace } from '@/services/delegated-logs';

export function resolveAuthenticatedRoute(input: {
  needsProfileCompletion: boolean;
  hasProfileName: boolean;
  professionalWorkspace: ProfessionalWorkspace | null | undefined;
  onboardingComplete: boolean;
  hasSeenOnboarding: boolean;
}): '/(auth)/profile-completion' | '/professional' | '/onboarding' | '/(tabs)' {
  if (input.needsProfileCompletion || !input.hasProfileName) {
    return '/(auth)/profile-completion';
  }
  if (input.professionalWorkspace) return '/professional';
  if (!input.onboardingComplete && !input.hasSeenOnboarding) return '/onboarding';
  return '/(tabs)';
}
