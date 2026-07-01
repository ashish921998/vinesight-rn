import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import {
  fetchFertilizerPlanForFarm,
  fetchFertilizerPlansForFarm,
} from '@/services/fertilizer-plan';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

/**
 * The most recent fertilizer plan for a farm (or null). Used where only the
 * current plan matters, e.g. the entry-form fertigation quick-add.
 */
export function useFertilizerPlan(farmId?: number) {
  return useQuery({
    queryKey: farmId ? queryKeys.fertilizerPlan.detail(farmId) : ['fertilizerPlan', 'disabled'],
    queryFn: async (): Promise<FertilizerPlan | null> => {
      if (!farmId) return null;
      return fetchFertilizerPlanForFarm(farmId);
    },
    enabled: Boolean(farmId),
  });
}

/**
 * Full plan history for a farm, newest first. Backs the fertilizer-plans screen,
 * which shows the current plan plus older ones.
 */
export function useFertilizerPlans(farmId?: number) {
  return useQuery({
    queryKey: farmId
      ? queryKeys.fertilizerPlan.list(farmId)
      : ['fertilizerPlan', 'list', 'disabled'],
    queryFn: async (): Promise<FertilizerPlan[]> => {
      if (!farmId) return [];
      return fetchFertilizerPlansForFarm(farmId);
    },
    enabled: Boolean(farmId),
  });
}
