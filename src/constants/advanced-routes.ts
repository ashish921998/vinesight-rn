/**
 * Single source of truth for which routes are "advanced" (Detailed-mode only).
 *
 * Used by:
 *  - `AdvancedRouteGuard` (redirects Simplified users home before the guarded
 *    screen's mount-time data hooks run), and
 *  - the notification deep-link allowlist in `app/_layout.tsx`
 *    (`resolveNotificationTarget`).
 *
 * The `add-*` segments are guarded too (deep links to them must redirect a
 * Simplified user home) — they are not decorative.
 */
export const ADVANCED_ROUTE_SEGMENTS = [
  'lab-tests',
  'soil-profiling',
  'soil-trends',
  'petiole-trends',
  'fertilizer-plans',
  'tasks',
  'analytics',
  'spray-catalog',
  'add-worker',
  'add-task',
  'add-soil-profile',
  'add-lab-test',
] as const;

export type AdvancedRouteSegment = (typeof ADVANCED_ROUTE_SEGMENTS)[number];

const ADVANCED_SEGMENT_SET: ReadonlySet<string> = new Set(ADVANCED_ROUTE_SEGMENTS);

/**
 * Tab routes that are hidden in Simplified mode. Kept here (rather than in
 * `ADVANCED_ROUTE_SEGMENTS`) because they live under the `(tabs)` group and are
 * matched by their full `/(tabs)/xxx` form, preserving the notification
 * allowlist's existing behavior.
 */
const ADVANCED_TAB_ROUTES: ReadonlySet<string> = new Set([
  '/(tabs)/workers',
  '/(tabs)/tools',
  '/(tabs)/assistant',
]);

/**
 * Whether a route/path is advanced (Detailed-mode only).
 *
 * Normalizes the input by stripping the query string, a leading `/`, and a
 * leading `(tabs)/` group segment, then checks membership against the advanced
 * segment set. The `(tabs)` tab routes (workers/tools/assistant) are matched in
 * their full form so the notification allowlist keeps its current behavior.
 */
export function isAdvancedRoute(routeOrPath: string | null | undefined): boolean {
  if (!routeOrPath) return false;

  // Drop query string / hash.
  const withoutQuery = routeOrPath.split(/[?#]/)[0] ?? '';

  // Full-form tab routes (e.g. `/(tabs)/workers`).
  if (ADVANCED_TAB_ROUTES.has(withoutQuery)) return true;

  let normalized = withoutQuery;
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized.startsWith('(tabs)/')) normalized = normalized.slice('(tabs)/'.length);

  // Take the first path segment (advanced screens are top-level routes).
  const firstSegment = normalized.split('/')[0] ?? '';
  return ADVANCED_SEGMENT_SET.has(firstSegment);
}
