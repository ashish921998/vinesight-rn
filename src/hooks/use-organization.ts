import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import { joinOrganizationBySlug } from '@/services/organization';

/**
 * Mutation wrapper around the join_organization_by_slug RPC. On a successful
 * join the RPC has already written profiles.consultant_organization_id, so the
 * cached profile is stale; invalidating it here (and awaiting the refetch)
 * guarantees org-gated UI (e.g. Fertilizer Plans) is visible by the time
 * mutateAsync resolves, without every caller having to remember to refetch.
 *
 * The underlying service never throws — it returns a typed JoinOrgResult with
 * a status code — so callers branch on result.ok rather than try/catch.
 */
export function useJoinOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinOrganizationBySlug,
    onSuccess: async (result) => {
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      }
    },
  });
}
