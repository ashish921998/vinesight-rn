/**
 * React Query hooks for the consultant review & plan authoring flow.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import {
  fetchPetioleTriage,
  sendFertilizerPlan,
  createPetioleTriage,
  type CreatePetioleTriageInput,
} from '@/services/consultant-reviews';
import { labTestQueryKeys } from './use-lab-tests';

export function usePetioleTriage(organizationId: string | undefined, farmId: number) {
  return useQuery({
    queryKey: queryKeys.consultantReviews.triage(organizationId ?? '', farmId),
    queryFn: async () => {
      if (!organizationId) return [];
      return fetchPetioleTriage(organizationId, farmId);
    },
    enabled: !!organizationId && farmId > 0,
  });
}

export function useSendFertilizerPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendFertilizerPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consultantReviews.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.professionalWorkspace.all });
      queryClient.invalidateQueries({ queryKey: labTestQueryKeys.petioleTests.all });
    },
  });
}

export function useCreatePetioleTriage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePetioleTriageInput) => createPetioleTriage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consultantReviews.all });
    },
  });
}
