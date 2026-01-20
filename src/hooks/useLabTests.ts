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

// Query keys
export const labTestQueryKeys = {
  soilTests: (farmId: number) => ['soil-tests', farmId] as const,
  petioleTests: (farmId: number) => ['petiole-tests', farmId] as const,
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
      const { error } = await supabase
        .from('soil_test_records')
        .delete()
        .eq('id', id);

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
      const { error } = await supabase
        .from('petiole_test_records')
        .delete()
        .eq('id', id);

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

// Common soil test parameters
export const SOIL_PARAMETERS = [
  { key: 'pH', label: 'pH', unit: '', min: 0, max: 14, step: 0.1 },
  { key: 'EC', label: 'EC', unit: 'dS/m', min: 0, max: 10, step: 0.1 },
  { key: 'OC', label: 'Organic Carbon', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'N', label: 'Nitrogen (N)', unit: 'kg/ha', min: 0, max: 500, step: 1 },
  { key: 'P', label: 'Phosphorus (P)', unit: 'kg/ha', min: 0, max: 200, step: 1 },
  { key: 'K', label: 'Potassium (K)', unit: 'kg/ha', min: 0, max: 500, step: 1 },
  { key: 'Ca', label: 'Calcium (Ca)', unit: 'meq/100g', min: 0, max: 50, step: 0.1 },
  { key: 'Mg', label: 'Magnesium (Mg)', unit: 'meq/100g', min: 0, max: 20, step: 0.1 },
  { key: 'S', label: 'Sulfur (S)', unit: 'ppm', min: 0, max: 100, step: 1 },
  { key: 'Zn', label: 'Zinc (Zn)', unit: 'ppm', min: 0, max: 20, step: 0.1 },
  { key: 'Fe', label: 'Iron (Fe)', unit: 'ppm', min: 0, max: 100, step: 0.1 },
  { key: 'Mn', label: 'Manganese (Mn)', unit: 'ppm', min: 0, max: 50, step: 0.1 },
  { key: 'Cu', label: 'Copper (Cu)', unit: 'ppm', min: 0, max: 10, step: 0.1 },
  { key: 'B', label: 'Boron (B)', unit: 'ppm', min: 0, max: 5, step: 0.1 },
];

// Common petiole test parameters
export const PETIOLE_PARAMETERS = [
  { key: 'N', label: 'Nitrogen (N)', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'P', label: 'Phosphorus (P)', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'K', label: 'Potassium (K)', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'Ca', label: 'Calcium (Ca)', unit: '%', min: 0, max: 5, step: 0.01 },
  { key: 'Mg', label: 'Magnesium (Mg)', unit: '%', min: 0, max: 2, step: 0.01 },
  { key: 'S', label: 'Sulfur (S)', unit: '%', min: 0, max: 1, step: 0.01 },
  { key: 'Zn', label: 'Zinc (Zn)', unit: 'ppm', min: 0, max: 200, step: 1 },
  { key: 'Fe', label: 'Iron (Fe)', unit: 'ppm', min: 0, max: 500, step: 1 },
  { key: 'Mn', label: 'Manganese (Mn)', unit: 'ppm', min: 0, max: 300, step: 1 },
  { key: 'Cu', label: 'Copper (Cu)', unit: 'ppm', min: 0, max: 50, step: 1 },
  { key: 'B', label: 'Boron (B)', unit: 'ppm', min: 0, max: 100, step: 1 },
];

/**
 * Format parameter key for display
 */
export function formatParameterKey(key: string): string {
  const param = [...SOIL_PARAMETERS, ...PETIOLE_PARAMETERS].find(
    (p) => p.key === key
  );
  return param?.label || key;
}

/**
 * Get parameter unit
 */
export function getParameterUnit(key: string, isSoil: boolean): string {
  const params = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const param = params.find((p) => p.key === key);
  return param?.unit || '';
}
