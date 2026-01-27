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
  { key: 'ph', label: 'pH', unit: '', min: 0, max: 14, step: 0.1 },
  { key: 'ec', label: 'EC', unit: 'dS/m', min: 0, max: 10, step: 0.1 },
  { key: 'organicCarbon', label: 'Organic Carbon', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'organicMatter', label: 'Organic Matter', unit: '%', min: 0, max: 10, step: 0.01 },
  { key: 'nitrogen', label: 'Nitrogen', unit: 'ppm', min: 0, max: 500, step: 1 },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'ppm', min: 0, max: 200, step: 1 },
  { key: 'potassium', label: 'Potassium', unit: 'ppm', min: 0, max: 500, step: 1 },
  { key: 'calcium', label: 'Calcium', unit: 'ppm', min: 0, max: 5000, step: 1 },
  { key: 'magnesium', label: 'Magnesium', unit: 'ppm', min: 0, max: 2000, step: 1 },
  { key: 'sulfur', label: 'Sulfur', unit: 'ppm', min: 0, max: 100, step: 1 },
  { key: 'iron', label: 'Iron', unit: 'ppm', min: 0, max: 100, step: 0.1 },
  { key: 'manganese', label: 'Manganese', unit: 'ppm', min: 0, max: 50, step: 0.1 },
  { key: 'zinc', label: 'Zinc', unit: 'ppm', min: 0, max: 20, step: 0.1 },
  { key: 'copper', label: 'Copper', unit: 'ppm', min: 0, max: 10, step: 0.1 },
  { key: 'boron', label: 'Boron', unit: 'ppm', min: 0, max: 5, step: 0.1 },
];

// Common petiole test parameters (matching vinesight-web order)
export const PETIOLE_PARAMETERS = [
  { key: 'total_nitrogen', label: 'Total Nitrogen', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'nitrate_nitrogen', label: 'Nitrate N', unit: 'ppm', min: 0, max: 1000, step: 1 },
  { key: 'ammoniacal_nitrogen', label: 'Ammoniacal N', unit: 'ppm', min: 0, max: 1000, step: 1 },
  { key: 'phosphorus', label: 'Phosphorus', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'potassium', label: 'Potassium', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'calcium', label: 'Calcium', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'magnesium', label: 'Magnesium', unit: '%', min: 0, max: 2, step: 0.01 },
  { key: 'sulfur', label: 'Sulfur', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'iron', label: 'Iron', unit: 'ppm', min: 0, max: 500, step: 1 },
  { key: 'manganese', label: 'Manganese', unit: 'ppm', min: 0, max: 300, step: 1 },
  { key: 'zinc', label: 'Zinc', unit: 'ppm', min: 0, max: 200, step: 1 },
  { key: 'copper', label: 'Copper', unit: 'ppm', min: 0, max: 50, step: 1 },
  { key: 'boron', label: 'Boron', unit: 'ppm', min: 0, max: 100, step: 1 },
  { key: 'molybdenum', label: 'Molybdenum', unit: 'ppm', min: 0, max: 1, step: 0.01 },
  { key: 'sodium', label: 'Sodium', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'chloride', label: 'Chloride', unit: '%', min: 0, max: 1, step: 0.01 },
];

/**
 * Format parameter key for display
 */
export function formatParameterKey(key: string, testType: 'soil' | 'petiole' = 'soil'): string {
  const normalizedKey = normalizeParameterKey(key, testType);
  const params = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const param = params.find((p) => p.key === normalizedKey);
  return param?.label || key;
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
  };

  const keyMap = testType === 'petiole' ? petioleKeyMap : soilKeyMap;

  const mappedKey = keyMap[key];
  if (!mappedKey) {
    console.warn(`[useLabTests] No mapping found for key "${key}" in testType "${testType}"`);
  }
  return mappedKey ?? key;
}

/**
 * Get parameter unit
 */
export function getParameterUnit(key: string, isSoil: boolean): string {
  const params = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const param = params.find((p) => p.key === key);
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
