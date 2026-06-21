import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { getProfessionalWorkspace } from '@/services/delegated-logs';
import { deriveProfessionalRole, type ProfessionalRoleFlags } from '@/utils/professional-role';

export function useProfessionalWorkspace(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.professionalWorkspace.current(),
    queryFn: getProfessionalWorkspace,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Presentation-only role flags for the current professional. React Query dedupes
 * this against `useProfessionalWorkspace`, so it is cheap to call alongside it.
 */
export function useProfessionalRole(): ProfessionalRoleFlags {
  const { data } = useProfessionalWorkspace();
  return deriveProfessionalRole(data);
}
