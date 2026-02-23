import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import { useChemicalCatalog, useChemicalMixById } from '@/hooks/use-chemical-catalog';
import {
  buildSafeToSprayStatus,
  computeEarliestSafeHarvest,
  computePhiForMix,
  fetchSprayPhiRows,
  type SprayPhiRow,
} from '@/services/phi-service';
import type { PhiComputationResult, SafeToSprayStatus } from '@/types/phi';

export function usePhiComputation(mixId: number | null | undefined, sprayDate: string) {
  const mixQuery = useChemicalMixById(mixId);
  const data = useMemo<PhiComputationResult | null>(() => {
    if (!mixQuery.data || !sprayDate) return null;
    return computePhiForMix(mixQuery.data, sprayDate);
  }, [mixQuery.data, sprayDate]);

  return {
    data,
    isLoading: mixQuery.isLoading,
    error: mixQuery.error,
  };
}

export function useEarliestSafeHarvestForSeason(
  farmId: number | undefined,
  seasonId?: number | null,
) {
  return useQuery({
    queryKey: queryKeys.phi.earliestSafeHarvest(farmId ?? -1, seasonId ?? null),
    queryFn: async () => {
      if (!farmId) return { earliestDate: null, reason: null };
      const data = await fetchSprayPhiRows(farmId, seasonId);
      return computeEarliestSafeHarvest(data as SprayPhiRow[]);
    },
    enabled: !!farmId,
    staleTime: 30_000,
  });
}

export function useSafeToSprayMatrix(args: {
  farmId: number | undefined;
  seasonId?: number | null;
  targetHarvestDate: string | null | undefined;
}) {
  const { targetHarvestDate, farmId, seasonId } = args;
  const catalog = useChemicalCatalog();
  const data = useMemo<SafeToSprayStatus[]>(() => {
    if (!targetHarvestDate || !catalog.data) return [];
    return buildSafeToSprayStatus({
      mixes: catalog.data,
      targetHarvestDate,
    });
  }, [catalog.data, targetHarvestDate]);

  return {
    data,
    isLoading: catalog.isLoading,
    isError: catalog.isError,
    error: catalog.error,
    queryKey: queryKeys.phi.safeToSprayMatrix(
      farmId ?? -1,
      seasonId ?? null,
      targetHarvestDate ?? '',
    ),
  };
}
