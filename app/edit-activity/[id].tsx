import { useEffect } from 'react';

import { ActivityEditForm } from '@/components/screens/activity-edit-form';
import { useModalStore } from '@/stores';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function EditActivityRoute() {
  const goBack = useSafeBack();
  const { editActivity, setEditActivity } = useModalStore();

  useEffect(() => {
    if (!editActivity) {
      goBack();
    }
    return () => setEditActivity(null);
  }, [editActivity, goBack, setEditActivity]);

  if (!editActivity) {
    return null;
  }

  return (
    <>
      <ActivityEditForm
        onClose={goBack}
        presentation="screen"
        farm={editActivity.farm}
        logType={editActivity.logType}
        record={editActivity.record}
      />
    </>
  );
}
