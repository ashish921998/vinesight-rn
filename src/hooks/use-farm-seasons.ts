import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { requireUserId } from '../lib/auth-utils';
import { queryKeys } from './query-keys';
import type { FarmSeason, FarmSeasonInsert } from '../types';
import { TABLES } from '../types';

export function useFarmSeasons(farmId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.farmSeasons.listByFarm(farmId ?? -1),
    queryFn: async (): Promise<FarmSeason[]> => {
      if (!farmId) return [];
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from(TABLES.FARM_SEASONS)
        .select('*')
        .eq('farm_id', farmId)
        .eq('user_id', userId)
        .order('end_date', { ascending: true });

      if (error) {
        // Allow gradual rollout if migration isn't applied yet.
        if ('code' in error && error.code === '42P01') return [];
        throw error;
      }
      return data ?? [];
    },
    enabled: !!farmId && !Number.isNaN(farmId),
  });
}

export function useCreateFarmSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (season: FarmSeasonInsert): Promise<FarmSeason> => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from(TABLES.FARM_SEASONS)
        .insert({ ...season, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newSeason) => {
      queryClient.setQueryData<FarmSeason[]>(
        queryKeys.farmSeasons.listByFarm(newSeason.farm_id),
        (old) => {
          if (!old) return [newSeason];
          const next = [...old, newSeason];
          next.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
          return next;
        },
      );
    },
  });
}
