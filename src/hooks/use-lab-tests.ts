/**
 * Lab Tests Hooks for Vinesight
 * React Query hooks for soil and petiole test management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
import {
  SoilTestRecord,
  SoilTestRecordInsert,
  PetioleTestRecord,
  PetioleTestRecordInsert,
} from '../types/database';
import { LabTrendsService } from '../services/lab-trends-service';
import i18n from '@/i18n';
import { normalizeParameterKey } from '@/utils/lab-test-utils';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../constants/lab-test-parameters';
import { resolveSeasonIdForDate } from '../lib/season-context';

// Query keys
export const labTestQueryKeys = {
  soilTests: {
    all: ['soil-tests'] as const,
    forFarm: (farmId: number) => [...labTestQueryKeys.soilTests.all, farmId] as const,
  },
  petioleTests: {
    all: ['petiole-tests'] as const,
    forFarm: (farmId: number) => [...labTestQueryKeys.petioleTests.all, farmId] as const,
  },
  soilTrends: (farmId: number) => ['soil-trends', farmId] as const,
  petioleTrends: (farmId: number) => ['petiole-trends', farmId] as const,
};

async function backfillMissingPetiolePruningDates(
  farmId: number,
  tests: PetioleTestRecord[],
): Promise<PetioleTestRecord[]> {
  const idsToBackfill = tests
    .filter((test) => !test.date_of_pruning)
    .map((test) => test.id)
    .filter((id): id is number => typeof id === 'number');

  if (idsToBackfill.length === 0) {
    return tests;
  }

  const { data: farmData, error: farmError } = await getDataAccess()
    .from('farms')
    .select('date_of_pruning')
    .eq('id', farmId)
    .single();

  if (farmError || !farmData?.date_of_pruning) {
    return tests;
  }

  const pruningDate = farmData.date_of_pruning;
  const { error: updateError } = await getDataAccess()
    .from('petiole_test_records')
    .update({ date_of_pruning: pruningDate })
    .in('id', idsToBackfill);

  if (updateError) {
    return tests;
  }

  const idsSet = new Set(idsToBackfill);
  return tests.map((test) => {
    if (!test.id || !idsSet.has(test.id) || test.date_of_pruning) {
      return test;
    }
    return { ...test, date_of_pruning: pruningDate };
  });
}

/**
 * Fetch soil test records for a farm
 */
export function useSoilTests(farmId: number, seasonId?: number) {
  return useQuery({
    queryKey: [...labTestQueryKeys.soilTests.forFarm(farmId), { seasonId: seasonId ?? null }],
    queryFn: async () => {
      let query = getDataAccess()
        .from('soil_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SoilTestRecord[];
    },
    enabled: farmId > 0,
  });
}

/**
 * Fetch petiole test records for a farm
 */
export function usePetioleTests(farmId: number, seasonId?: number) {
  return useQuery({
    queryKey: [...labTestQueryKeys.petioleTests.forFarm(farmId), { seasonId: seasonId ?? null }],
    queryFn: async () => {
      let query = getDataAccess()
        .from('petiole_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: false });
      if (seasonId !== undefined) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const testData = (data ?? []) as PetioleTestRecord[];
      return backfillMissingPetiolePruningDates(farmId, testData);
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await getDataAccess()
        .from('soil_test_records')
        .insert({ ...record, season_id: seasonId })
        .select()
        .single();

      if (error) throw error;
      return data as SoilTestRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.soilTests.forFarm(data.farm_id),
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
      const seasonId =
        record.season_id ??
        (await resolveSeasonIdForDate({
          farmId: record.farm_id,
          date: record.date,
        }));
      const { data, error } = await getDataAccess()
        .from('petiole_test_records')
        .insert({ ...record, season_id: seasonId })
        .select()
        .single();

      if (error) throw error;
      return data as PetioleTestRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.petioleTests.forFarm(data.farm_id),
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
      const { error } = await getDataAccess().from('soil_test_records').delete().eq('id', id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.soilTests.forFarm(data.farmId),
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
      const { error } = await getDataAccess().from('petiole_test_records').delete().eq('id', id);

      if (error) throw error;
      return { id, farmId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: labTestQueryKeys.petioleTests.forFarm(data.farmId),
      });
    },
  });
}

/**
 * Format parameter key for display
 */
export function formatParameterKey(key: string, testType: 'soil' | 'petiole' = 'soil'): string {
  return getParameterLabel(key, testType);
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
      const { data, error } = await getDataAccess()
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
      const { data, error } = await getDataAccess()
        .from('petiole_test_records')
        .select('*')
        .eq('farm_id', farmId)
        .order('date', { ascending: true });

      if (error) throw error;
      const rawData = (data ?? []) as PetioleTestRecord[];
      const testData = await backfillMissingPetiolePruningDates(farmId, rawData);
      const trends = LabTrendsService.calculatePetioleTrends(testData || []);
      return trends;
    },
    enabled: farmId > 0,
  });
}
