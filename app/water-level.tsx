import { useLocalSearchParams, useRouter } from 'expo-router';

import { WaterLevelSheet } from '@/components/screens/water-level-sheet';
import { LockedFeatureScreen } from '@/components/subscription/locked-feature-screen';
import { useFarm, useCapabilities } from '@/hooks';
import { useTranslation } from 'react-i18next';

export default function WaterLevelRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

  const { data: farm, isLoading } = useFarm(Number.isFinite(farmId) ? farmId : undefined);
  const { data: capabilities } = useCapabilities();
  const { t } = useTranslation();

  if (!Number.isFinite(farmId)) {
    return null;
  }

  if (isLoading || !farm) {
    return null;
  }

  if (!capabilities.capabilities.soilWater.manualUpdate) {
    return (
      <LockedFeatureScreen
        title={t('subscription.locks.soilWater.title')}
        description={t('subscription.locks.soilWater.description')}
        ctaLabel={t('subscription.locks.cta')}
        secondaryLabel={t('common.goBack')}
        featureKey="soilWater"
        onUpgrade={() => router.push('/paywall?source=soilWater')}
      />
    );
  }

  return (
    <>
      <WaterLevelSheet onClose={() => router.back()} presentation="screen" farm={farm} />
    </>
  );
}
