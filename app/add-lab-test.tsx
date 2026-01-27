import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import AddLabTestModal from '@/components/screens/add-lab-test-modal';

export default function AddLabTestRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; testType?: 'soil' | 'petiole' }>();

  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;
  const testType = params.testType === 'petiole' ? 'petiole' : 'soil';

  if (!Number.isFinite(farmId)) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddLabTestModal
        onClose={() => router.back()}
        presentation="screen"
        farmId={farmId}
        testType={testType}
      />
    </>
  );
}
