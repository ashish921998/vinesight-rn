import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * Returns a stable callback that dismisses the current screen safely.
 *
 * Plain `router.back()` fires a `GO_BACK` navigation action even when there is
 * nothing on the stack to pop — e.g. when a modal route is reached directly via
 * a deep link / notification, or when a close button is double-tapped (the first
 * tap pops the screen, the second finds an empty stack). React Navigation then
 * logs the dev warning:
 *
 *   The action 'GO_BACK' was not handled by any navigator.
 *
 * Guarding with `canGoBack()` makes dismissal robust regardless of how the screen
 * was entered: pop when we can, otherwise replace to a safe home route.
 *
 * @param fallback Route to navigate to when there is no screen to go back to.
 *                 Defaults to the tabs home.
 */
export function useSafeBack(fallback: Href = '/(tabs)') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, fallback]);
}
