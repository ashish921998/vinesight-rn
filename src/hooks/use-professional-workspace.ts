import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { getProfessionalWorkspace } from '@/services/delegated-logs';

export function useProfessionalWorkspace(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.professionalWorkspace.current(),
    queryFn: getProfessionalWorkspace,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    retry: 1,
  });
}
