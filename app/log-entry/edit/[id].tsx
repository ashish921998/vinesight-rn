import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FarmLogForm } from '@/components/screens/farm-log-form';
import { useModalStore } from '@/stores';

export default function EditLogEntryRoute() {
  const router = useRouter();
  const { editActivity, setEditActivity } = useModalStore();
  const initialEditActivityRef = React.useRef(editActivity);

  useEffect(() => {
    if (!initialEditActivityRef.current) {
      router.back();
    }
    return () => setEditActivity(null);
  }, [router, setEditActivity]);

  if (!editActivity) {
    return null;
  }

  return (
    <>
      <FarmLogForm mode="edit" onClose={() => router.back()} />
    </>
  );
}
