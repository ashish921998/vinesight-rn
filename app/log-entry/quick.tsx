import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReceiptLogScreen } from '@/components/screens/receipt-log-screen';

export const screenOptions = {
  presentation: 'modal',
  headerShown: false,
};

export default function QuickLogRoute() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum = farmId && !isNaN(Number(farmId)) ? parseInt(farmId, 10) : undefined;

  return <ReceiptLogScreen farmId={farmIdNum} onClose={() => router.back()} />;
}
