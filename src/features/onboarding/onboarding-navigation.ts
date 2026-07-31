import { createAddLogHref, createStartSeasonHref } from '@/utils/add-log-navigation';

export type OnboardingFarmDestination = 'tabs' | 'log' | 'season';

export function resolveOnboardingFarmHref(farmId: number, destination: OnboardingFarmDestination) {
  if (destination === 'log') {
    return createAddLogHref({
      farmId,
      initialLogType: 'irrigation',
      lockFarmSelection: true,
    });
  }
  if (destination === 'season') return createStartSeasonHref(farmId);
  return '/(tabs)' as const;
}
