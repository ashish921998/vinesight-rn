import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '@/services/subscription-service';
import { queryKeys } from './query-keys';

export function useOfferings() {
  const isSupported = subscriptionService.isSupported;

  return useQuery({
    queryKey: queryKeys.offerings.current(),
    queryFn: async () => {
      const offerings = await subscriptionService.getOfferings();
      return offerings;
    },
    enabled: isSupported,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}
