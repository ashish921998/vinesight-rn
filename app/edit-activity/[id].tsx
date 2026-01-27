import { useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { EditActivityModal } from '@/components/screens/EditActivityModal';
import { useModalStore } from '@/stores';

export default function EditActivityRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { editActivity, setEditActivity } = useModalStore();

  useEffect(() => {
    if (!editActivity) {
      router.back();
    }
    return () => setEditActivity(null);
  }, [editActivity, router, setEditActivity]);

  if (!editActivity) {
    return null;
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
          title: id ? `Edit Activity ${id}` : 'Edit Activity',
        }}
      />
      <EditActivityModal
        onClose={() => router.back()}
        presentation="screen"
        farm={editActivity.farm}
        logType={editActivity.logType}
        record={editActivity.record}
      />
    </>
  );
}
