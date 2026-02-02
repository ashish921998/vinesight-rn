/**
 * Lab Tests Hooks for Vinesight
 * React Query hooks for soil and petiole test management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  SoilTestRecord,
  SoilTestRecordInsert,
  PetioleTestRecord,
  PetioleTestRecordInsert,
} from '../types/database';
import { LabTrendsService } from '../services/lab-trends-service';
import i18n from '@/i18n';

// Query keys
export const labTestQueryKeys = {
  soilTests: (farmId: number) => ['soil-tests', farmId] as const,
  petioleTests: (farmId: number) => ['petiole-tests', farmId] as const,
  soilTrends: (farmId: number) => ['soil-trends', farmId] as const,
  petioleTrends: (farmId: number) => ['petiole-trends', farmId] as const,
};

/**
 * Fetch soil test records for a farm
 */
export function useSoilTests(farmId: number) {
  return useQuery({
    queryKey: labTestQueryKeys.soilTests(farmId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soil_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as SoilTestRecord[];
    },
    enabled: farmId > 0,
  });
}

/**
 * Fetch petiole test records for a farm
 */
export function usePetioleTests(farmId: number) {
  return useQuery({
    queryKey: labTestQueryKeys.petioleTests(farmId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petiole_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as PetioleTestRecord[];
    },
    enabled: farmId > 0,
  });
}

/**
 * Create a new soil test record
 */
export function useCreateSoilTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: SoilTestRecordInsert) => {
      const { data, error } = await supabase
        .from('soil_test_records')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data as SoilTestRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.soilTests(data.farm_id),
      });
    },
  });
}

/**
 * Create a new petiole test record
 */
export function useCreatePetioleTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: PetioleTestRecordInsert) => {
      const { data, error } = await supabase
        .from('petiole_test_records')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data as PetioleTestRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.petioleTests(data.farm_id),
      });
    },
  });
}

/**
 * Delete a soil test record
 */
export function useDeleteSoilTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }) => {
      const { error } = await supabase.from('soil_test_records').delete().eq('id', id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.soilTests(data.farmId),
      });
    },
  });
}

/**
 * Delete a petiole test record
 */
export function useDeletePetioleTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, farmId }: { id: number; farmId: number }) => {
      const { error } = await supabase.from('petiole_test_records').delete().eq('id', id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.petioleTests(data.farmId),
      });
    },
  });
}

// Common soil test parameters (matching vinesight-web order)
export const SOIL_PARAMETERS = [
  {
    key: 'ph',
    label: 'pH',
    shortLabel: 'pH',
    unit: '',
    min: 0,
    max: 14,
    step: 0.1,
    optimalMin: 6.5,
    optimalMax: 7.5,
  },
  {
    key: 'ec',
    label: 'EC',
    shortLabel: 'EC',
    unit: 'dS/m',
    min: 0,
    max: 10,
    step: 0.1,
    optimalMin: 0,
    optimalMax: 1.0,
  },
  {
    key: 'organicCarbon',
    label: 'Organic Carbon',
    shortLabel: 'OC',
    unit: '%',
    min: 0,
    max: 5,
    step: 0.01,
    optimalMin: 1.01,
    optimalMax: 3.0,
  },
  {
    key: 'organicMatter',
    label: 'Organic Matter',
    shortLabel: 'OM',
    unit: '%',
    min: 0,
    max: 10,
    step: 0.01,
    optimalMin: 2.0,
    optimalMax: 5.0,
  },
  {
    key: 'nitrogen',
    label: 'Nitrogen',
    shortLabel: 'N',
    unit: 'ppm',
    min: 0,
    max: 500,
    step: 1,
    optimalMin: 200,
    optimalMax: 400,
  },
  {
    key: 'phosphorus',
    label: 'Phosphorus',
    shortLabel: 'P',
    unit: 'ppm',
    min: 0,
    max: 200,
    step: 1,
    optimalMin: 10,
    optimalMax: 20,
  },
  {
    key: 'potassium',
    label: 'Potassium',
    shortLabel: 'K',
    unit: 'ppm',
    min: 0,
    max: 500,
    step: 1,
    optimalMin: 120,
    optimalMax: 200,
  },
  {
    key: 'calcium',
    label: 'Calcium',
    shortLabel: 'Ca',
    unit: 'ppm',
    min: 0,
    max: 5000,
    step: 1,
    optimalMin: 1000,
    optimalMax: 4500,
  },
  {
    key: 'magnesium',
    label: 'Magnesium',
    shortLabel: 'Mg',
    unit: 'ppm',
    min: 0,
    max: 2000,
    step: 1,
    optimalMin: 500,
    optimalMax: 1000,
  },
  {
    key: 'sulfur',
    label: 'Sulfur',
    shortLabel: 'S',
    unit: 'ppm',
    min: 0,
    max: 100,
    step: 1,
    optimalMin: 10,
    optimalMax: 20,
  },
  {
    key: 'iron',
    label: 'Iron',
    shortLabel: 'Fe',
    unit: 'ppm',
    min: 0,
    max: 100,
    step: 0.1,
    optimalMin: 3.1,
    optimalMax: 5.0,
  },
  {
    key: 'manganese',
    label: 'Manganese',
    shortLabel: 'Mn',
    unit: 'ppm',
    min: 0,
    max: 50,
    step: 0.1,
    optimalMin: 0.6,
    optimalMax: 1.0,
  },
  {
    key: 'zinc',
    label: 'Zinc',
    shortLabel: 'Zn',
    unit: 'ppm',
    min: 0,
    max: 20,
    step: 0.1,
    optimalMin: 1.0,
    optimalMax: 1.5,
  },
  {
    key: 'copper',
    label: 'Copper',
    shortLabel: 'Cu',
    unit: 'ppm',
    min: 0,
    max: 10,
    step: 0.1,
    optimalMin: 0.3,
    optimalMax: 0.5,
  },
  {
    key: 'boron',
    label: 'Boron',
    shortLabel: 'B',
    unit: 'ppm',
    min: 0,
    max: 5,
    step: 0.1,
    optimalMin: 0,
    optimalMax: 0.5,
  },
];

// Common petiole test parameters (matching vinesight-web order)
export const PETIOLE_PARAMETERS = [
  {
    key: 'total_nitrogen',
    label: 'Total Nitrogen',
    shortLabel: 'TN',
    unit: '%',
    min: 0,
    max: 5,
    step: 0.01,
    optimalMin: 1.51,
    optimalMax: 2.21,
  },
  {
    key: 'nitrate_nitrogen',
    label: 'Nitrate N',
    shortLabel: 'NO₃-N',
    unit: 'ppm',
    min: 0,
    max: 1000,
    step: 1,
    optimalMin: 700,
    optimalMax: 1000,
  },
  {
    key: 'ammoniacal_nitrogen',
    label: 'Ammonical N',
    shortLabel: 'NH₄-N',
    unit: 'ppm',
    min: 0,
    max: 1000,
    step: 1,
    optimalMin: 400,
    optimalMax: 700,
  },
  {
    key: 'phosphorus',
    label: 'Phosphorus',
    shortLabel: 'P',
    unit: '%',
    min: 0,
    max: 1,
    step: 0.01,
    optimalMin: 0.31,
    optimalMax: 0.51,
  },
  {
    key: 'potassium',
    label: 'Potassium',
    shortLabel: 'K',
    unit: '%',
    min: 0,
    max: 5,
    step: 0.01,
    optimalMin: 1.51,
    optimalMax: 2.01,
  },
  {
    key: 'calcium',
    label: 'Calcium',
    shortLabel: 'Ca',
    unit: '%',
    min: 0,
    max: 5,
    step: 0.01,
    optimalMin: 1.51,
    optimalMax: 2.21,
  },
  {
    key: 'magnesium',
    label: 'Magnesium',
    shortLabel: 'Mg',
    unit: '%',
    min: 0,
    max: 2,
    step: 0.01,
    optimalMin: 0.31,
    optimalMax: 0.61,
  },
  {
    key: 'sulfur',
    label: 'Sulfur',
    shortLabel: 'S',
    unit: '%',
    min: 0,
    max: 1,
    step: 0.01,
    optimalMin: 0.15,
    optimalMax: 0.51,
  },
  {
    key: 'iron',
    label: 'Iron',
    shortLabel: 'Fe',
    unit: 'ppm',
    min: 0,
    max: 500,
    step: 1,
    optimalMin: 80,
    optimalMax: 120,
  },
  {
    key: 'manganese',
    label: 'Manganese',
    shortLabel: 'Mn',
    unit: 'ppm',
    min: 0,
    max: 300,
    step: 1,
    optimalMin: 40,
    optimalMax: 100,
  },
  {
    key: 'zinc',
    label: 'Zinc',
    shortLabel: 'Zn',
    unit: 'ppm',
    min: 0,
    max: 200,
    step: 1,
    optimalMin: 50,
    optimalMax: 80,
  },
  {
    key: 'copper',
    label: 'Copper',
    shortLabel: 'Cu',
    unit: 'ppm',
    min: 0,
    max: 50,
    step: 1,
    optimalMin: 5,
    optimalMax: 15,
  },
  {
    key: 'boron',
    label: 'Boron',
    shortLabel: 'B',
    unit: 'ppm',
    min: 0,
    max: 100,
    step: 1,
    optimalMin: 25,
    optimalMax: 50,
  },
  {
    key: 'molybdenum',
    label: 'Molybdenum',
    shortLabel: 'Mo',
    unit: 'ppm',
    min: 0,
    max: 1,
    step: 0.01,
    optimalMin: 0.25,
    optimalMax: 0.51,
  },
  {
    key: 'sodium',
    label: 'Sodium',
    shortLabel: 'Na',
    unit: '%',
    min: 0,
    max: 1,
    step: 0.01,
    optimalMin: 0.01,
    optimalMax: 0.51,
  },
  {
    key: 'chloride',
    label: 'Chloride',
    shortLabel: 'Cl',
    unit: '%',
    min: 0,
    max: 1,
    step: 0.01,
    optimalMin: 0.05,
    optimalMax: 0.25,
  },
];

/**
 * Format parameter key for display
 */
export function formatParameterKey(key: string, testType: 'soil' | 'petiole' = 'soil'): string {
  return getParameterLabel(key, testType);
}

/**
 * Normalize parameter key (handles old keys like pH, OC, N, etc.)
 */
function normalizeParameterKey(key: string, testType: 'soil' | 'petiole' = 'soil'): string {
  const soilKeyMap: Record<string, string> = {
    pH: 'ph',
    EC: 'ec',
    OC: 'organicCarbon',
    OM: 'organicMatter',
    organic_carbon: 'organicCarbon',
    organic_matter: 'organicMatter',
    calcium_carbonate: 'calciumCarbonate',
    carbonate: 'carbonate',
    bicarbonate: 'bicarbonate',
    N: 'nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
  };

  const petioleKeyMap: Record<string, string> = {
    N: 'total_nitrogen',
    P: 'phosphorus',
    K: 'potassium',
    Ca: 'calcium',
    Mg: 'magnesium',
    S: 'sulfur',
    Fe: 'iron',
    Mn: 'manganese',
    Zn: 'zinc',
    Cu: 'copper',
    B: 'boron',
    Mo: 'molybdenum',
    Na: 'sodium',
    Cl: 'chloride',
    ammonical_nitrogen: 'ammoniacal_nitrogen',
  };

  const keyMap = testType === 'petiole' ? petioleKeyMap : soilKeyMap;

  // Try direct lookup first
  let mappedKey = keyMap[key];

  // If not found, try case-insensitive lookup for lowercase keys
  if (!mappedKey) {
    const lowerKey = key.toLowerCase();
    for (const [mapKey, mapValue] of Object.entries(keyMap)) {
      if (mapKey.toLowerCase() === lowerKey) {
        mappedKey = mapValue;
        break;
      }
    }
  }

  // If still not found, return the key as-is (it might already be normalized)
  if (!mappedKey) {
    return key;
  }

  return mappedKey;
}

/**
 * Get localized parameter label
 */
export function getParameterLabel(key: string, testType: 'soil' | 'petiole' = 'soil'): string {
  const normalizedKey = normalizeParameterKey(key, testType);
  const params = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const param = params.find((p) => p.key === normalizedKey);
  const baseKey = param?.key ?? normalizedKey;
  const camelKey = baseKey.includes('_')
    ? baseKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    : baseKey;
  const labelKey = param?.key ?? camelKey;
  const fallback = param?.label ?? key;
  return i18n.t(`labTests.parameters.${labelKey}`, { defaultValue: fallback });
}

/**
 * Get parameter unit
 */
export function getParameterUnit(key: string, isSoil: boolean): string {
  const testType = isSoil ? 'soil' : 'petiole';
  const normalizedKey = normalizeParameterKey(key, testType);
  const params = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const param = params.find((p) => p.key === normalizedKey);
  return param?.unit || '';
}

// Parameter colors for charts (distinct colors)
export const PARAMETER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
] as const;

// Default selected parameters (matching vinesight-web defaults)
export const SOIL_DEFAULT_PARAMS = ['ph', 'ec'] as const;
export const PETIOLE_DEFAULT_PARAMS = ['total_nitrogen', 'potassium'] as const;

export function useSoilTestTrends(farmId: number) {
  return useQuery({
    queryKey: labTestQueryKeys.soilTrends(farmId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('soil_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: true });

      if (error) throw error;
      const testData = data as SoilTestRecord[];
      const trends = LabTrendsService.calculateSoilTrends(testData || []);
      return trends;
    },
    enabled: farmId > 0,
  });
}

export function usePetioleTestTrends(farmId: number) {
  return useQuery({
    queryKey: labTestQueryKeys.petioleTrends(farmId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petiole_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: true });

      if (error) throw error;
      const testData = data as PetioleTestRecord[];
      const trends = LabTrendsService.calculatePetioleTrends(testData || []);
      return trends;
    },
    enabled: farmId > 0,
  });
}
