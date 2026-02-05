import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { WorkerForm } from '@/components/screens/worker-form';
import { LockedFeatureScreen } from '@/components/subscription/locked-feature-screen';
import { useModalStore } from '@/stores';
import { useCapabilities, useWorkers } from '@/hooks';
import { isLimitReached } from '@/utils/capabilities';
import { useTranslation } from 'react-i18next';

export default function AddWorkerRoute() {
  const router = useRouter();
  const { addWorker, setAddWorker } = useModalStore();
  const { data: workers } = useWorkers();
  const { data: capabilities } = useCapabilities();
  const { t } = useTranslation();

  const activeWorkers = workers?.filter((worker) => worker.is_active) ?? [];
  const maxWorkers = capabilities.capabilities.workers.maxWorkers;
  const isEditMode = Boolean(addWorker?.worker);

  useEffect(() => {
    return () => setAddWorker(null);
  }, [setAddWorker]);

  if (!isEditMode && isLimitReached(activeWorkers.length, maxWorkers)) {
    return (
      <LockedFeatureScreen
        title={t('subscription.locks.workers.title')}
        description={t('subscription.locks.workers.description', { limit: maxWorkers })}
        ctaLabel={t('subscription.locks.cta')}
        secondaryLabel={t('common.goBack')}
        featureKey="workers"
        onUpgrade={() => router.push('/paywall?source=workers')}
      />
    );
  }

  return (
    <>
      <WorkerForm
        onClose={() => router.back()}
        presentation="screen"
        worker={addWorker?.worker ?? undefined}
      />
    </>
  );
}
