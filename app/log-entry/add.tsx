import { Redirect, useLocalSearchParams } from 'expo-router';

import { createAddLogHref, createQuickLogHref } from '@/utils/add-log-navigation';

export const screenOptions = {
  presentation: 'fullScreenModal',
  headerShown: false,
};

/**
 * Thin redirect. This route used to be a byte-for-byte duplicate of the batch
 * composer; the farmer fast path now lives at `/log-entry/quick`. A concrete
 * numeric `farmId` redirects there; a missing/invalid farmId falls through to
 * the batch composer (`/add-entry`) so a farm-less deep link still gets the
 * composer's farm picker (the fast-path screen requires a concrete farm).
 */
export default function AddLogEntryRoute() {
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farmIdNum =
    farmId && farmId !== 'all' && !Number.isNaN(Number(farmId)) ? parseInt(farmId, 10) : null;
  if (farmIdNum != null) {
    return <Redirect href={createQuickLogHref({ farmId: farmIdNum })} />;
  }
  return <Redirect href={createAddLogHref()} />;
}
