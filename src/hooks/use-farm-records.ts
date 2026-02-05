/**
 * Farm Records Composite Hook
 * Fetches all record types for a specific farm
 */

import {
  useIrrigationRecords,
  useSprayRecords,
  useHarvestRecords,
  useExpenseRecords,
  useFertigationRecords,
} from './use-records';
import type { CapabilityLimit } from '@/types';
import { getRecordBaseDate, isWithinRetention } from '@/utils/retention';

/**
 * Fetch all records for a specific farm
 */
export function useFarmRecords(farmId: number | undefined, retentionMonths?: CapabilityLimit) {
  const irrigation = useIrrigationRecords(farmId);
  const spray = useSprayRecords(farmId);
  const harvest = useHarvestRecords(farmId);
  const expense = useExpenseRecords(farmId);
  const fertigation = useFertigationRecords(farmId);

  const filterByRetention = <T extends { created_at?: string | null; date?: string | null }>(
    records: T[] | undefined,
  ): T[] | undefined => {
    if (!records) return records;
    if (!retentionMonths) return records;
    return records.filter((record) =>
      isWithinRetention(getRecordBaseDate(record), retentionMonths),
    );
  };

  const isLoading =
    irrigation.isLoading ||
    spray.isLoading ||
    harvest.isLoading ||
    expense.isLoading ||
    fertigation.isLoading;

  const isError =
    irrigation.isError ||
    spray.isError ||
    harvest.isError ||
    expense.isError ||
    fertigation.isError;

  const refetch = async () => {
    await Promise.all([
      irrigation.refetch(),
      spray.refetch(),
      harvest.refetch(),
      expense.refetch(),
      fertigation.refetch(),
    ]);
  };

  return {
    irrigationRecords: filterByRetention(irrigation.data),
    sprayRecords: filterByRetention(spray.data),
    harvestRecords: filterByRetention(harvest.data),
    expenseRecords: filterByRetention(expense.data),
    fertigationRecords: filterByRetention(fertigation.data),
    isLoading,
    isError,
    refetch,
  };
}
