import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { WaterLevelModal } from '@/components/screens/water-level-modal';
import { useFarm } from '@/hooks';

export default function WaterLevelRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

  const { data: farm, isLoading } = useFarm(Number.isFinite(farmId) ? farmId : undefined);

  if (!Number.isFinite(farmId)) {
    return null;
  }

  if (isLoading || !farm) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <WaterLevelModal onClose={() => router.back()} presentation="screen" farm={farm} />
    </>
  );
}
