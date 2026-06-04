import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ReceiptLogScreen } from '@/components/screens/receipt-log-screen';
import { useSafeBack } from '@/hooks/use-safe-back';

export const screenOptions = {
  presentation: 'modal',
  headerShown: false,
};

export default function QuickLogRoute() {
  const goBack = useSafeBack();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum = farmId && !isNaN(Number(farmId)) ? parseInt(farmId, 10) : undefined;

  return <ReceiptLogScreen farmId={farmIdNum} onClose={goBack} />;
}
