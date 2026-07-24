import { useCallback, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EntryForm } from '@/components/screens/entry-form';
import { useModalStore } from '@/stores';
import {
  markOnboardingFirstActionCompleted,
  parseOnboardingFlag,
} from '@/features/onboarding/activation';

export default function AddTaskRoute() {
  const router = useRouter();
  const addEntry = useModalStore((s) => s.addEntry);
  const setAddEntry = useModalStore((s) => s.setAddEntry);
  const params = useLocalSearchParams<{
    farmId?: string;
    onboarding?: string;
    onboardingActionType?: string;
  }>();
  const initialFarmId =
    params.farmId && !isNaN(Number(params.farmId)) ? parseInt(params.farmId, 10) : undefined;
  const isOnboardingActionFlow = parseOnboardingFlag(params.onboarding);
  const onboardingFarmId = useMemo(
    () => initialFarmId ?? addEntry?.initialFarmId ?? null,
    [addEntry?.initialFarmId, initialFarmId],
  );

  useEffect(() => {
    return () => {
      setAddEntry(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTaskSaveSuccess = useCallback(
    (savedFarmId?: number | null) => {
      if (!isOnboardingActionFlow) return;
      markOnboardingFirstActionCompleted({
        actionType: 'task',
        farmId: savedFarmId ?? onboardingFarmId,
      });
    },
    [isOnboardingActionFlow, onboardingFarmId],
  );

  return (
    <EntryForm
      onClose={() => router.back()}
      presentation="screen"
      editingTask={addEntry?.editingTask ?? null}
      initialFarmId={onboardingFarmId}
      tabs={['log', 'task']}
      initialTab="task"
      onTaskSaveSuccess={handleTaskSaveSuccess}
    />
  );
}
