import { useQuery } from '@tanstack/react-query';
import { getTriageForFarm } from '@/services/petiole-triage';

export function useTriageForFarm(farmId?: number) {
  return useQuery({
    queryKey: ['triage', farmId],
    queryFn: () => getTriageForFarm(farmId!),
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
