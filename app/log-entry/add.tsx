import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FarmLogForm } from '@/components/screens/farm-log-form';

export const screenOptions = {
  presentation: 'modal',
  headerShown: false,
};

export default function AddLogEntryRoute() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum = farmId && !isNaN(Number(farmId)) ? parseInt(farmId, 10) : undefined;

  return (
    <>
      <FarmLogForm mode="add" farmId={farmIdNum} onClose={() => router.back()} />
    </>
  );
}
