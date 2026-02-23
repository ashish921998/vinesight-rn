import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import { fetchFertilizerPlanForFarm } from '@/services/fertilizer-plan';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

export function useFertilizerPlan(farmId?: number) {
  return useQuery({
    queryKey: farmId ? queryKeys.fertilizerPlan.detail(farmId) : queryKeys.fertilizerPlan.all,
    queryFn: async (): Promise<FertilizerPlan | null> => {
      if (!farmId) return null;
      return fetchFertilizerPlanForFarm(farmId);
    },
    enabled: Boolean(farmId),
  });
}
