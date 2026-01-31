import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import TaskForm from '@/components/screens/task-form';
import { useModalStore } from '@/stores';

export default function AddTaskRoute() {
  const router = useRouter();
  const { addEntry, setAddEntry } = useModalStore();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const initialFarmId =
    params.farmId && !isNaN(Number(params.farmId)) ? parseInt(params.farmId, 10) : undefined;

  useEffect(() => {
    return () => {
      setAddEntry(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TaskForm
      onClose={() => router.back()}
      presentation="screen"
      editingTask={addEntry?.editingTask ?? null}
      initialFarmId={initialFarmId ?? null}
    />
  );
}
