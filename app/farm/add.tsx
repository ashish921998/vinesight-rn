import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { FarmForm } from '@/components/screens/farm-form';
import { useCapabilities, useFarms } from '@/hooks';
import { isLimitReached } from '@/utils/capabilities';
import { LockedFeatureScreen } from '@/components/subscription/locked-feature-screen';
import { useTranslation } from 'react-i18next';

export default function AddFarmScreen() {
  const router = useRouter();
  const { data: farms } = useFarms();
  const { data: capabilities } = useCapabilities();
  const { t } = useTranslation();

  const farmCount = farms?.length ?? 0;
  const maxFarms = capabilities.capabilities.farms.maxFarms;
  const canAddFarm = !isLimitReached(farmCount, maxFarms);

  if (!canAddFarm) {
    return (
      <LockedFeatureScreen
        title={t('subscription.locks.farms.title')}
        description={t('subscription.locks.farms.description', { limit: maxFarms })}
        ctaLabel={t('subscription.locks.cta')}
        secondaryLabel={t('common.goBack')}
        featureKey="farms"
        onUpgrade={() => router.push('/paywall?source=farms')}
      />
    );
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FarmForm mode="add" onClose={() => router.back()} />
    </>
  );
}
