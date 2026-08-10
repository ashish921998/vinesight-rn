import type { AggregateHarvestStatus } from '@/services/phi-service';

interface HarvestSafetyBannerVisibilityArgs {
  detailedMode: boolean;
  isGrapeFarm: boolean;
  status: AggregateHarvestStatus | undefined;
  hasPhiConflict: boolean;
}

/**
 * Harvest-safety verification is a Detailed-mode advisory. Keep the policy
 * separate from the farm screen's layout so mode regressions are testable.
 */
export function shouldShowHarvestUnverifiedBanner({
  detailedMode,
  isGrapeFarm,
  status,
  hasPhiConflict,
}: HarvestSafetyBannerVisibilityArgs): boolean {
  return detailedMode && isGrapeFarm && status === 'unverified' && !hasPhiConflict;
}
