import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LockedFeatureScreen } from '@/components/subscription/locked-feature-screen';

function getCopy(feature: string, t: (key: string, options?: Record<string, unknown>) => string) {
  switch (feature) {
    case 'ai':
      return {
        title: t('subscription.locks.ai.title'),
        description: t('subscription.locks.ai.description'),
      };
    case 'farms':
      return {
        title: t('subscription.locks.farms.title'),
        description: t('subscription.locks.farms.description'),
      };
    case 'workers':
      return {
        title: t('subscription.locks.workers.title'),
        description: t('subscription.locks.workers.description'),
      };
    case 'attendance':
      return {
        title: t('subscription.locks.attendance.title'),
        description: t('subscription.locks.attendance.description'),
      };
    case 'labTrends':
      return {
        title: t('subscription.locks.labTrends.title'),
        description: t('subscription.locks.labTrends.description'),
      };
    case 'labParsing':
      return {
        title: t('subscription.locks.labParsing.title'),
        description: t('subscription.locks.labParsing.description'),
      };
    case 'soilWater':
      return {
        title: t('subscription.locks.soilWater.title'),
        description: t('subscription.locks.soilWater.description'),
      };
    case 'soilTrends':
      return {
        title: t('subscription.locks.soilTrends.title'),
        description: t('subscription.locks.soilTrends.description'),
      };
    default:
      return {
        title: t('subscription.locks.generic.title'),
        description: t('subscription.locks.generic.description'),
      };
  }
}

export default function LockedFeatureRoute() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const featureKey = feature ?? 'generic';
  const copy = getCopy(featureKey, t);

  return (
    <LockedFeatureScreen
      title={copy.title}
      description={copy.description}
      ctaLabel={t('subscription.locks.cta')}
      secondaryLabel={t('common.goBack')}
      featureKey={featureKey}
      onUpgrade={() => router.push(`/paywall?source=${featureKey}`)}
    />
  );
}
