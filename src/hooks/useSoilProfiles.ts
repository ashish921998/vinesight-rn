/**
 * Soil Profiling Hooks for Vinesight
 * React Query hooks for soil profile management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { SoilProfile, SoilProfileInsert, SoilSectionData } from '../types/database';

// Query keys
export const soilProfileQueryKeys = {
  profiles: (farmId: number) => ['soil-profiles', farmId] as const,
};

/**
 * Fetch soil profiles for a farm
 */
export function useSoilProfiles(farmId: number) {
  return useQuery({
    queryKey: soilProfileQueryKeys.profiles(farmId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soil_profiles')
        .select('*')
        .eq('farm_id', farmId)
        .order('created_at', { ascending: false });

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
      const { data, error } = await supabase
        .from('soil_profiles')
        .insert({
          ...profile,
          created_at: profile.created_at || new Date().toISOString(),
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
      const { error } = await supabase
        .from('soil_profiles')
        .delete()
        .eq('id', id);

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
export const SECTION_NAMES = ['left', 'center', 'right', 'down'] as const;
export type SectionName = typeof SECTION_NAMES[number];

// Section display info
export const SECTION_INFO: Record<SectionName, { label: string; abbr: string; color: string }> = {
  left: { label: 'Left', abbr: 'L', color: '#3B82F6' },
  center: { label: 'Center', abbr: 'C', color: '#10B981' },
  right: { label: 'Right', abbr: 'R', color: '#F59E0B' },
  down: { label: 'Down', abbr: 'D', color: '#8B5CF6' },
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
export function getSectionValue(
  sections: SoilSectionData[],
  name: SectionName
): number | null {
  const section = sections.find((s) => s.name === name);
  return section ? section.moisture_pct_user : null;
}

/**
 * Format profile date for display
 */
export function formatProfileDate(createdAt: string | null | undefined): string {
  if (!createdAt) return 'Unknown date';
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get moisture status label
 */
export function getMoistureStatus(moisture: number): {
  label: string;
  color: string;
} {
  if (moisture < 20) {
    return { label: 'Very Dry', color: '#EF4444' };
  } else if (moisture < 40) {
    return { label: 'Dry', color: '#F59E0B' };
  } else if (moisture < 60) {
    return { label: 'Optimal', color: '#10B981' };
  } else if (moisture < 80) {
    return { label: 'Moist', color: '#3B82F6' };
  } else {
    return { label: 'Wet', color: '#6366F1' };
  }
}
