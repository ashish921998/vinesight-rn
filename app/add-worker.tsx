import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { WorkerForm } from '@/components/screens/worker-form';
import { useModalStore } from '@/stores';
import { AdvancedRouteGuard } from '@/components/advanced-route-guard';

function AddWorkerScreen() {
  const router = useRouter();
  const { addWorker, setAddWorker } = useModalStore();

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

export default function AddWorkerRoute() {
  return (
    <AdvancedRouteGuard>
      <AddWorkerScreen />
    </AdvancedRouteGuard>
  );
}
