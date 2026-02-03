import { useLocalSearchParams, useRouter } from 'expo-router';

import { EntryForm } from '@/components/screens/entry-form';
import type { LogTypeId } from '@/constants/calculator-models';

export default function AddActivityRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; logType?: LogTypeId }>();
  const farmId =
    params.farmId && !isNaN(Number(params.farmId)) ? parseInt(params.farmId, 10) : undefined;

  return (
    <>
      <EntryForm
        onClose={() => router.back()}
        presentation="screen"
        tabs={['log', 'task']}
        initialTab="log"
        initialFarmId={farmId && !isNaN(farmId) ? farmId : null}
        initialLogType={params.logType ?? null}
      />
    </>
  );
}
