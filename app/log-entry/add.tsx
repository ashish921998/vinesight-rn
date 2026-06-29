import { Redirect, useLocalSearchParams } from 'expo-router';

import { createAddLogHref } from '@/utils/add-log-navigation';

export const screenOptions = {
  presentation: 'modal',
  headerShown: false,
};

export default function AddLogEntryRoute() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum = farmId && !isNaN(Number(farmId)) ? parseInt(farmId, 10) : undefined;
  return <Redirect href={createAddLogHref({ farmId: farmIdNum, lockFarmSelection: true })} />;
}
