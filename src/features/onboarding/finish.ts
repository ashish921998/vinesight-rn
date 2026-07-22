import { useAppModeIntroStore } from '@/stores/app-mode-intro-store';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useGuidedTourStore } from '@/features/guided-tour/store';

/**
 * Route target returned by {@link applyOnboardingCompletionEffects}. The screen
 * owns the actual `router.replace`/`router.push` navigation (Expo Router can't be
 * driven from this pure helper); this just describes where to land: always
 * replace to the dashboard, and optionally push the freshly-resolved farm on top.
 */
export interface OnboardingCompletionRoute {
  replace: '/(tabs)';
  push?: `/farm/${number}`;
}

/**
 * Applies the store side-effects that must happen when a new user finishes (or
 * skips) onboarding, and returns the route target for the caller to navigate.
 *
 * Beyond flipping the onboarding-complete flags, this deliberately marks the
 * guided tour complete and the Simplified-mode intro seen so neither reappears
 * as a duplicate first-run teaching gate on the dashboard:
 * - `useGuidedTourStore.completeTour()` — `GuidedTourController` shows its
 *   welcome card whenever `status === 'not_started'` on a dashboard route, so
 *   merely not launching the tour would let it resurface.
 * - `useAppModeIntroStore.markSeen()` — removes this new user from the
 *   migrating-user mode-intro modal's audience.
 */
export function applyOnboardingCompletionEffects({
  resolvedFarmId,
  notificationsEnabled,
}: {
  resolvedFarmId: number | null;
  notificationsEnabled: boolean;
}): OnboardingCompletionRoute {
  useOnboardingStore.getState().setPreferences({ notificationsEnabled });
  useOnboardingStore.getState().completeOnboarding();
  useAuthStore.getState().setHasSeenOnboarding(true);
  useGuidedTourStore.getState().completeTour();
  useAppModeIntroStore.getState().markSeen();
  useNotificationStore.getState().setNotificationPermissionPrompted(true);

  if (typeof resolvedFarmId === 'number') {
    return { replace: '/(tabs)', push: `/farm/${resolvedFarmId}` };
  }
  return { replace: '/(tabs)' };
}
