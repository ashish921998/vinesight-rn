import React, { useEffect } from 'react';
import { FarmLogForm } from '@/components/screens/farm-log-form';
import { useModalStore } from '@/stores';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function EditLogEntryRoute() {
  const goBack = useSafeBack();
  const editActivity = useModalStore((s) => s.editActivity);
  const setEditActivity = useModalStore((s) => s.setEditActivity);
  const initialEditActivityRef = React.useRef(editActivity);

  useEffect(() => {
    if (!initialEditActivityRef.current) {
      goBack();
    }
    return () => setEditActivity(null);
  }, [goBack, setEditActivity]);

  if (!editActivity) {
    return null;
  }

  return (
    <>
      <FarmLogForm onClose={goBack} />
    </>
  );
}
