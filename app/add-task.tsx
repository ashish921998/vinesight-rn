import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import AddTaskModal from '@/components/screens/add-task-modal';
import { useModalStore } from '@/stores';

export default function AddTaskRoute() {
  const router = useRouter();
  const { addEntry } = useModalStore();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const initialFarmId = params.farmId ? parseInt(params.farmId, 10) : undefined;

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddTaskModal
        onClose={() => router.back()}
        presentation="screen"
        editingTask={addEntry?.editingTask ?? null}
        initialFarmId={initialFarmId ?? null}
      />
    </>
  );
}
