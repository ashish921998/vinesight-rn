import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEffectiveCapabilities } from '@/services/capabilities-service';
import { useAuthStore } from '@/stores';
import { queryKeys } from './query-keys';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { DEFAULT_CAPABILITY_SET } from '@/constants/capabilities';
import type { EffectiveCapabilitiesResponse } from '@/types';

interface CapabilitiesResult {
  data: EffectiveCapabilitiesResponse;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  source: 'server' | 'cache' | 'default';
  refetch: () => void;
}

const buildDefaultResponse = (): EffectiveCapabilitiesResponse => ({
  planId: DEFAULT_CAPABILITY_SET.id,
  status: 'active',
  trialEndsAt: null,
  renewsAt: null,
  capabilities: DEFAULT_CAPABILITY_SET.capabilities,
});

export function useCapabilities(): CapabilitiesResult {
  const user = useAuthStore((s) => s.user);
  const setLastKnown = useSubscriptionStore((s) => s.setLastKnown);
  const lastKnown = useSubscriptionStore((s) => s.lastKnown);

  const query = useQuery({
    queryKey: queryKeys.capabilities.current(user?.id),
    queryFn: fetchEffectiveCapabilities,
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
    retry: 1,
  });

  useEffect(() => {
    if (!query.data) return;
    const data = query.data;
    setLastKnown({
      planId: data.planId,
      status: data.status,
      trialEndsAt: data.trialEndsAt ?? null,
      renewsAt: data.renewsAt ?? null,
      capabilities: data.capabilities,
      updatedAt: new Date().toISOString(),
    });
  }, [query.data, setLastKnown]);

  const fallback = lastKnown
    ? {
        planId: lastKnown.planId,
        status: lastKnown.status,
        trialEndsAt: lastKnown.trialEndsAt,
        renewsAt: lastKnown.renewsAt,
        capabilities: lastKnown.capabilities,
      }
    : buildDefaultResponse();

  const data = (query.data ?? fallback) as EffectiveCapabilitiesResponse;
  const source: CapabilitiesResult['source'] = query.data
    ? 'server'
    : lastKnown
      ? 'cache'
      : 'default';

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? (query.error as Error) : null,
    isStale: source !== 'server',
    source,
    refetch: () => {
      void query.refetch();
    },
  };
}
