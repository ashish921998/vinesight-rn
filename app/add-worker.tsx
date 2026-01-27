import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';

import { AddWorkerModal } from '@/components/screens/AddWorkerModal';
import { useModalStore } from '@/stores';

export default function AddWorkerRoute() {
  const router = useRouter();
  const { addWorker, setAddWorker } = useModalStore();

  useEffect(() => {
    return () => setAddWorker(null);
  }, [setAddWorker]);

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddWorkerModal
        onClose={() => router.back()}
        presentation="screen"
        worker={addWorker?.worker ?? undefined}
      />
    </>
  );
}
