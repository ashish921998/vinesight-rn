import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';

import AddStockModal from '@/components/screens/add-stock-modal';
import { useModalStore } from '@/stores';

export default function AddStockRoute() {
  const router = useRouter();
  const { addStock, setAddStock } = useModalStore();

  useEffect(() => {
    return () => setAddStock(null);
  }, [setAddStock]);

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddStockModal
        onClose={() => router.back()}
        presentation="screen"
        item={addStock?.item ?? null}
      />
    </>
  );
}
