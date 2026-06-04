import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FarmLogForm } from '@/components/screens/farm-log-form';
import { useSafeBack } from '@/hooks/use-safe-back';

export const screenOptions = {
  presentation: 'modal',
  headerShown: false,
};

export default function AddLogEntryRoute() {
  const goBack = useSafeBack();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum = farmId && !isNaN(Number(farmId)) ? parseInt(farmId, 10) : undefined;

  return (
    <>
      <FarmLogForm mode="add" farmId={farmIdNum} onClose={goBack} />
    </>
  );
}
