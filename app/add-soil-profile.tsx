import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import AddSoilProfileModal from '@/components/screens/AddSoilProfileModal';

export default function AddSoilProfileRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

  if (!Number.isFinite(farmId)) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddSoilProfileModal onClose={() => router.back()} presentation="screen" farmId={farmId} />
    </>
  );
}
