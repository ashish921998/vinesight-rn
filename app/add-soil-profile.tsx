import { useLocalSearchParams, useRouter } from 'expo-router';

import SoilProfileForm from '@/components/screens/soil-profile-form';

export default function AddSoilProfileRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = params.farmId ? parseInt(params.farmId, 10) : NaN;

  if (!Number.isFinite(farmId)) {
    return null;
  }

  return (
    <>
      <SoilProfileForm onClose={() => router.back()} presentation="screen" farmId={farmId} />
    </>
  );
}
