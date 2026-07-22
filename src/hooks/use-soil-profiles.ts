/**
 * Soil Profiling Hooks for Vinesight
 * React Query hooks for soil profile management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
import { SoilProfile, SoilProfileInsert, SoilSectionData } from '../types/database';
import i18n from '@/i18n';
import { formatDate } from '@/i18n/format';
import { formatLocalDate } from '../utils/date';
import { resolveSeasonIdForDate } from '../lib/season-context';

// Query keys
export const soilProfileQueryKeys = {
  profiles: (farmId: number) => ['soil-profiles', farmId] as const,
};

/**
 * Fetch soil profiles for a farm
 */
export function useSoilProfiles(farmId: number, seasonId?: number) {
  return useQuery({
    queryKey: [...soilProfileQueryKeys.profiles(farmId), { seasonId: seasonId ?? null }],
    queryFn: async () => {
      let query = getDataAccess()
        .from('soil_profiles')
        .select('*')
        .eq('farm_id', farmId)
        .order('created_at', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SoilProfile[];
    },
    enabled: farmId > 0,
  });
}

/**
 * Create a new soil profile
 */
export function useCreateSoilProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: SoilProfileInsert) => {
      const createdAt = profile.created_at || new Date().toISOString();
      const seasonId =
        profile.season_id ??
        (await resolveSeasonIdForDate({
          farmId: profile.farm_id,
          date: formatLocalDate(new Date(createdAt)),
        }));
      const { data, error } = await getDataAccess()
        .from('soil_profiles')
        .insert({
          ...profile,
          season_id: seasonId,
          created_at: createdAt,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SoilProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: soilProfileQueryKeys.profiles(data.farm_id),
      });
    },
  });
}

/**
 * Delete a soil profile
 */
export function useDeleteSoilProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }) => {
      const { error } = await getDataAccess().from('soil_profiles').delete().eq('id', id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: soilProfileQueryKeys.profiles(data.farmId),
      });
    },
  });
}

// Section names
export const SECTION_NAMES = ['top', 'bottom', 'right', 'left'] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

// Section display info
export const SECTION_INFO: Record<SectionName, { labelKey: string; abbr: string; color: string }> =
  {
    top: { labelKey: 'soilProfileForm.sections.top', abbr: 'T', color: '#10B981' },
    bottom: { labelKey: 'soilProfileForm.sections.bottom', abbr: 'B', color: '#8B5CF6' },
    right: { labelKey: 'soilProfileForm.sections.right', abbr: 'R', color: '#F59E0B' },
    left: { labelKey: 'soilProfileForm.sections.left', abbr: 'L', color: '#3B82F6' },
  };

/**
 * Calculate average moisture from sections
 */
export function calculateAverageMoisture(sections: SoilSectionData[]): number {
  if (sections.length === 0) return 0;
  const total = sections.reduce((sum, s) => sum + s.moisture_pct_user, 0);
  return Math.round((total / sections.length) * 10) / 10;
}

/**
 * Get section value by name
 */
export function getSectionValue(sections: SoilSectionData[], name: SectionName): number | null {
  const legacyMap: Record<SectionName, string[]> = {
    top: ['top', 'center'],
    bottom: ['bottom', 'down'],
    right: ['right'],
    left: ['left'],
  };
  const section = sections.find((s) => legacyMap[name].includes(s.name));
  return section ? section.moisture_pct_user : null;
}

/**
 * Format profile date for display
 */
export function formatProfileDate(createdAt: string | null | undefined): string {
  if (!createdAt) return i18n.t('common.unknownDate');
  return formatDate(createdAt, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Get moisture status label
 */
export function getMoistureStatus(moisture: number): {
  labelKey: string;
  color: string;
} {
  if (moisture < 20) {
    return { labelKey: 'soilProfile.moistureStatus.veryDry', color: '#EF4444' };
  } else if (moisture < 40) {
    return { labelKey: 'soilProfile.moistureStatus.dry', color: '#F59E0B' };
  } else if (moisture < 60) {
    return { labelKey: 'soilProfile.moistureStatus.optimal', color: '#10B981' };
  } else if (moisture < 80) {
    return { labelKey: 'soilProfile.moistureStatus.moist', color: '#3B82F6' };
  } else {
    return { labelKey: 'soilProfile.moistureStatus.wet', color: '#6366F1' };
  }
}
