import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import StockForm from '@/components/screens/stock-form';
import { useModalStore } from '@/stores';

export default function AddStockRoute() {
  const router = useRouter();
  const addStock = useModalStore((s) => s.addStock);
  const setAddStock = useModalStore((s) => s.setAddStock);

  useEffect(() => {
    return () => setAddStock(null);
  }, [setAddStock]);

  return (
    <>
      <StockForm
        onClose={() => router.back()}
        presentation="screen"
        item={addStock?.item ?? null}
      />
    </>
  );
}
