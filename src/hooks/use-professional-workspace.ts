import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { getProfessionalWorkspace } from '@/services/delegated-logs';

export function useProfessionalWorkspace(enabled = true) {
  return useQuery({ queryKey: queryKeys.professionalWorkspace.current(), queryFn: getProfessionalWorkspace, enabled, staleTime: 30_000, retry: 1 });
}
