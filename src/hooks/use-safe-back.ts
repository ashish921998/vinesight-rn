import { useCallback, useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';

const DISMISS_GUARD_MS = 500;

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
  const isDismissingRef = useRef(false);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    },
    [],
  );

  return useCallback(() => {
    // Navigation actions are queued. A second effect invocation or quick
    // double-tap can therefore observe the old stack and dispatch another
    // GO_BACK before the first one is handled.
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    guardTimerRef.current = setTimeout(() => {
      isDismissingRef.current = false;
      guardTimerRef.current = null;
    }, DISMISS_GUARD_MS);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, fallback]);
}
