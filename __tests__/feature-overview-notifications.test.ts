import {
  FEATURE_OVERVIEW_CAMPAIGN,
  FEATURE_OVERVIEW_ROUTES,
  isFeatureOverviewRoute,
  resolveFeatureOverviewRoute,
} from '@/services/feature-overview-notifications';

describe('feature overview notification helpers', () => {
  it('accepts only allowlisted routes', () => {
    for (const route of FEATURE_OVERVIEW_ROUTES) {
      expect(isFeatureOverviewRoute(route)).toBe(true);
    }

    expect(isFeatureOverviewRoute('/ai-chat')).toBe(false);
    expect(isFeatureOverviewRoute('/(tabs)/settings')).toBe(false);
    expect(isFeatureOverviewRoute(null)).toBe(false);
  });

  it('resolves a valid feature overview payload', () => {
    expect(
      resolveFeatureOverviewRoute({
        type: 'feature_overview',
        route: '/tasks',
        day: 3,
        campaign: FEATURE_OVERVIEW_CAMPAIGN,
      }),
    ).toBe('/tasks');
  });

  it('rejects payloads with invalid route, day, or campaign', () => {
    expect(
      resolveFeatureOverviewRoute({
        type: 'feature_overview',
        route: '/ai-chat',
        day: 1,
        campaign: FEATURE_OVERVIEW_CAMPAIGN,
      }),
    ).toBeNull();

    expect(
      resolveFeatureOverviewRoute({
        type: 'feature_overview',
        route: '/tasks',
        day: 8,
        campaign: FEATURE_OVERVIEW_CAMPAIGN,
      }),
    ).toBeNull();

    expect(
      resolveFeatureOverviewRoute({
        type: 'feature_overview',
        route: '/tasks',
        day: 2,
        campaign: 'unexpected_campaign',
      }),
    ).toBeNull();
  });
});
