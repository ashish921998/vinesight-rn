import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { ActivityEditForm } from '@/components/screens/activity-edit-form';
import { useModalStore } from '@/stores';

export default function EditActivityRoute() {
  const router = useRouter();
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
      <ActivityEditForm
        onClose={() => router.back()}
        presentation="screen"
        farm={editActivity.farm}
        logType={editActivity.logType}
        record={editActivity.record}
      />
    </>
  );
}
