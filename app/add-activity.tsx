import { Redirect, useLocalSearchParams } from 'expo-router';

import type { LogTypeId } from '@/constants/calculator-models';
import { createAddLogHref } from '@/utils/add-log-navigation';

export default function AddActivityRoute() {
  const params = useLocalSearchParams<{ farmId?: string; logType?: LogTypeId }>();
  const farmId =
    params.farmId && !isNaN(Number(params.farmId)) ? parseInt(params.farmId, 10) : undefined;
  return <Redirect href={createAddLogHref({ farmId, initialLogType: params.logType })} />;
}
