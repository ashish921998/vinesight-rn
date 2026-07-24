import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import WarehouseItemForm from '@/components/screens/warehouse-item-form';
import { useModalStore } from '@/stores';

export default function AddWarehouseItemRoute() {
  const router = useRouter();
  const addWarehouseItem = useModalStore((s) => s.addWarehouseItem);
  const setAddWarehouseItem = useModalStore((s) => s.setAddWarehouseItem);

  useEffect(() => {
    return () => setAddWarehouseItem(null);
  }, [setAddWarehouseItem]);

  return (
    <>
      <WarehouseItemForm
        onClose={() => router.back()}
        presentation="screen"
        editingItem={addWarehouseItem?.editingItem ?? null}
      />
    </>
  );
}
