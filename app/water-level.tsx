import { useLocalSearchParams, useRouter } from 'expo-router';

import { WaterLevelSheet } from '@/components/screens/water-level-sheet';
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
      <WaterLevelSheet onClose={() => router.back()} presentation="screen" farm={farm} />
    </>
  );
}
