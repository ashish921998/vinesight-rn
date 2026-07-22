import React from 'react';
import { Redirect } from 'expo-router';

import { useAppModeStore } from '@/stores';

/**
 * Wraps an advanced (Detailed-mode only) route. Renders its children only when
 * the user is in Detailed mode; a Simplified user is redirected home.
 *
 * Placed as the route's default export so the guard runs BEFORE the guarded
 * screen's mount-time data hooks (which live in the inner component), avoiding
 * needless fetches on a route the user isn't allowed to see.
 *
 * `hydrated` guard: while the persisted app-mode is still loading we render
 * nothing rather than acting on the in-memory default (Simplified) and
 * bouncing a Detailed user home on cold start. Mirrors the hydrated-guard
 * pattern in `_layout.tsx` / `(tabs)/_layout.tsx`.
 */
export function AdvancedRouteGuard({ children }: { children: React.ReactNode }) {
  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const hydrated = useAppModeStore((s) => s.hydrated);

  if (!hydrated) return null;
  if (!detailedMode) return <Redirect href="/(tabs)" />;
  return <>{children}</>;
}
