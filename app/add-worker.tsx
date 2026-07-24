import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { WorkerForm } from '@/components/screens/worker-form';
import { useModalStore } from '@/stores';

export default function AddWorkerRoute() {
  const router = useRouter();
  const addWorker = useModalStore((s) => s.addWorker);
  const setAddWorker = useModalStore((s) => s.setAddWorker);

  useEffect(() => {
    return () => setAddWorker(null);
  }, [setAddWorker]);

  return (
    <>
      <WorkerForm
        onClose={() => router.back()}
        presentation="screen"
        worker={addWorker?.worker ?? undefined}
      />
    </>
  );
}
