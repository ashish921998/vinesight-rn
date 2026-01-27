import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';

import AddWarehouseItemModal from '@/components/screens/add-warehouse-item-modal';
import { useModalStore } from '@/stores';

export default function AddWarehouseItemRoute() {
  const router = useRouter();
  const { addWarehouseItem, setAddWarehouseItem } = useModalStore();

  useEffect(() => {
    return () => setAddWarehouseItem(null);
  }, [setAddWarehouseItem]);

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddWarehouseItemModal
        onClose={() => router.back()}
        presentation="screen"
        editingItem={addWarehouseItem?.editingItem ?? null}
      />
    </>
  );
}
