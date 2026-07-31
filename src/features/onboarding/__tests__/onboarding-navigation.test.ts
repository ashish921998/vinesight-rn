import { resolveOnboardingFarmHref } from '../onboarding-navigation';

describe('resolveOnboardingFarmHref', () => {
  it('opens a locked, prefilled irrigation log after first-farm creation', () => {
    expect(resolveOnboardingFarmHref(42, 'log')).toEqual({
      pathname: '/add-entry',
      params: {
        farmId: '42',
        initialLogType: 'irrigation',
        initialTab: 'log',
        tabs: 'log',
        lockFarmSelection: 'true',
      },
    });
  });

  it('routes to season recovery when the initial season is unavailable', () => {
    expect(resolveOnboardingFarmHref(42, 'season')).toEqual({
      pathname: '/farm/[id]',
      params: { id: '42', startSeason: '1' },
    });
  });

  it('keeps existing farmers on the dashboard', () => {
    expect(resolveOnboardingFarmHref(42, 'tabs')).toBe('/(tabs)');
  });
});
