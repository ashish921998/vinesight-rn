import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FarmForm } from '@/components/screens/farm-form';

export default function EditFarmScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id, 10) : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FarmForm mode="edit" farmId={farmId} onClose={() => router.back()} />
    </>
  );
}
