import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { FarmForm } from '@/components/screens/farm-form';
import { useGuidedTourStore } from '@/features/guided-tour/store';

export default function AddFarmScreen() {
  const router = useRouter();
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const disableDismissGesture = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_farm';

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !disableDismissGesture }} />
      <FarmForm mode="add" onClose={() => router.back()} />
    </>
  );
}
