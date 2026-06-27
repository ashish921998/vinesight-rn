import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { getDelegatedFarmActivity } from '@/services/delegated-logs';

export function useProfessionalFarmActivity(options: {
  organizationId?: string;
  clientUserId?: string;
  farmId?: number;
}) {
  const { organizationId, clientUserId, farmId } = options;
  return useQuery({
    queryKey: queryKeys.professionalWorkspace.farmActivity(farmId ?? 0),
    queryFn: () =>
      getDelegatedFarmActivity({
        organizationId: organizationId!,
        clientUserId: clientUserId!,
        farmId: farmId!,
      }),
    enabled: Boolean(organizationId && clientUserId && farmId),
  });
}
