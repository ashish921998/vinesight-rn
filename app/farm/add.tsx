import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { FarmForm } from '@/components/screens/farm-form';

export default function AddFarmScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FarmForm mode="add" onClose={() => router.back()} />
    </>
  );
}
