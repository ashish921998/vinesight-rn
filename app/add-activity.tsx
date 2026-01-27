import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { AddEntryModal } from '@/components/screens/AddEntryModal';
import type { LogTypeId } from '@/constants/calculatorModels';

export default function AddActivityRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; logType?: LogTypeId }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : undefined;

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddEntryModal
        onClose={() => router.back()}
        presentation="screen"
        tabs={['log']}
        initialTab="log"
        initialFarmId={farmId ?? null}
        initialLogType={params.logType ?? null}
      />
    </>
  );
}
