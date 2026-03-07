export const FEATURE_OVERVIEW_CAMPAIGN = 'install_core_v1' as const;

export const FEATURE_OVERVIEW_ROUTES = [
  '/(tabs)',
  '/(tabs)/explore',
  '/tasks',
  '/(tabs)/workers',
  '/warehouse',
  '/weather',
  '/analytics',
] as const;

export type FeatureOverviewRoute = (typeof FEATURE_OVERVIEW_ROUTES)[number];

type FeatureOverviewNotificationData = {
  type?: unknown;
  route?: unknown;
  day?: unknown;
  campaign?: unknown;
};

export function isFeatureOverviewRoute(value: unknown): value is FeatureOverviewRoute {
  return (
    typeof value === 'string' && (FEATURE_OVERVIEW_ROUTES as readonly string[]).includes(value)
  );
}

export function resolveFeatureOverviewRoute(
  data: FeatureOverviewNotificationData | null | undefined,
): FeatureOverviewRoute | null {
  if (!data || data.type !== 'feature_overview') return null;
  if (data.campaign !== FEATURE_OVERVIEW_CAMPAIGN) return null;
  if (typeof data.day !== 'number' || !Number.isInteger(data.day) || data.day < 1 || data.day > 7) {
    return null;
  }
  return isFeatureOverviewRoute(data.route) ? data.route : null;
}
