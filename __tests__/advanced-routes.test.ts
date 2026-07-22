import { ADVANCED_ROUTE_SEGMENTS, isAdvancedRoute } from '@/constants/advanced-routes';

describe('isAdvancedRoute', () => {
  it('matches every advanced segment with a leading slash', () => {
    for (const segment of ADVANCED_ROUTE_SEGMENTS) {
      expect(isAdvancedRoute(`/${segment}`)).toBe(true);
    }
  });

  it('matches advanced segments without a leading slash', () => {
    for (const segment of ADVANCED_ROUTE_SEGMENTS) {
      expect(isAdvancedRoute(segment)).toBe(true);
    }
  });

  it('matches advanced segments with a query string', () => {
    expect(isAdvancedRoute('/lab-tests?farmId=12')).toBe(true);
    expect(isAdvancedRoute('/fertilizer-plans?farmId=3')).toBe(true);
    expect(isAdvancedRoute('/tasks?filter=overdue&farmId=1')).toBe(true);
  });

  it('gates each advanced add-* deep link', () => {
    expect(isAdvancedRoute('/add-worker')).toBe(true);
    expect(isAdvancedRoute('/add-task')).toBe(true);
    expect(isAdvancedRoute('/add-soil-profile')).toBe(true);
    expect(isAdvancedRoute('/add-lab-test?farmId=7')).toBe(true);
  });

  it('matches the advanced (tabs) routes in full form', () => {
    expect(isAdvancedRoute('/(tabs)/workers')).toBe(true);
    expect(isAdvancedRoute('/(tabs)/tools')).toBe(true);
    expect(isAdvancedRoute('/(tabs)/assistant')).toBe(true);
  });

  it('rejects simplified-safe and unknown routes', () => {
    expect(isAdvancedRoute('/warehouse')).toBe(false);
    expect(isAdvancedRoute('/reports')).toBe(false);
    expect(isAdvancedRoute('/(tabs)')).toBe(false);
    expect(isAdvancedRoute('/(tabs)/explore')).toBe(false);
    expect(isAdvancedRoute('/spray-safe-checker')).toBe(false);
    expect(isAdvancedRoute('/farm/12')).toBe(false);
    expect(isAdvancedRoute('/log-entry/quick')).toBe(false);
    expect(isAdvancedRoute(null)).toBe(false);
    expect(isAdvancedRoute(undefined)).toBe(false);
    expect(isAdvancedRoute('')).toBe(false);
  });
});
