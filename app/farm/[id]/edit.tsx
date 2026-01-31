import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FarmForm } from '@/components/screens/farm-form';

export default function EditFarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsedId = typeof id === 'string' ? parseInt(id, 10) : NaN;
  const farmId = typeof id === 'string' && !Number.isNaN(parsedId) ? parsedId : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FarmForm mode="edit" farmId={farmId} onClose={() => router.back()} />
    </>
  );
}
