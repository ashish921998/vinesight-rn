import { shouldShowHarvestUnverifiedBanner } from '@/utils/harvest-safety-visibility';

describe('shouldShowHarvestUnverifiedBanner', () => {
  const base = {
    detailedMode: true,
    isGrapeFarm: true,
    status: 'unverified' as const,
    hasPhiConflict: false,
  };

  it('shows the advisory for an unverified grape farm in Detailed mode', () => {
    expect(shouldShowHarvestUnverifiedBanner(base)).toBe(true);
  });

  it('hides the advisory in Simplified mode', () => {
    expect(shouldShowHarvestUnverifiedBanner({ ...base, detailedMode: false })).toBe(false);
  });

  it('hides the advisory when the farm or harvest state does not apply', () => {
    expect(shouldShowHarvestUnverifiedBanner({ ...base, isGrapeFarm: false })).toBe(false);
    expect(shouldShowHarvestUnverifiedBanner({ ...base, status: 'verified' })).toBe(false);
    expect(shouldShowHarvestUnverifiedBanner({ ...base, hasPhiConflict: true })).toBe(false);
  });
});
