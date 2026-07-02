import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import { fetchFarmSoilBaseline } from '@/services/farm-soil-baseline';
import type { FarmSoilBaseline } from '@/components/professional/soil-baseline-panel';

/**
 * Farm-level soil baseline (texture / CEC / bulk density / etc.) recorded at
 * farm creation. Supplementary to the lab-test soil panel: a genuine fetch
 * failure (or RLS-hidden / deleted farm) yields `null` rather than an error, so
 * callers surface the lab tests alone. See `isError` note in lab-reports.
 */
export function useFarmSoilBaseline(farmId: number) {
  return useQuery<FarmSoilBaseline | null>({
    queryKey: queryKeys.farmSoilBaseline.detail(farmId),
    queryFn: () => fetchFarmSoilBaseline(farmId),
    enabled: Number.isFinite(farmId) && farmId > 0,
  });
}
