import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import {
  fetchFertilizerPlanForFarm,
  fetchFertilizerPlansForFarm,
  fetchOrgFertilizerPlanItemHistory,
  type OrgFertilizerPlanHistoryItem,
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
      ? queryKeys.fertilizerPlan.listByFarm(farmId)
      : ['fertilizerPlan', 'list', 'disabled'],
    queryFn: async (): Promise<FertilizerPlan[]> => {
      if (!farmId) return [];
      return fetchFertilizerPlansForFarm(farmId);
    },
    enabled: Boolean(farmId),
  });
}

/**
 * Items across the org's recent plans (newest first) — the consultant plan
 * picker's "what you prescribe often" section. Raw rows; dedupe happens in
 * `orgPlanHistoryToOptions`.
 */
export function useOrgFertilizerPlanItemHistory(organizationId?: string) {
  return useQuery({
    queryKey: organizationId
      ? queryKeys.fertilizerPlan.orgItemHistory(organizationId)
      : ['fertilizerPlan', 'orgItemHistory', 'disabled'],
    queryFn: async (): Promise<OrgFertilizerPlanHistoryItem[]> => {
      if (!organizationId) return [];
      return fetchOrgFertilizerPlanItemHistory(organizationId);
    },
    enabled: Boolean(organizationId),
  });
}
