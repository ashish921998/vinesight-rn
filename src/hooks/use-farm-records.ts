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
  useDailyNotes,
} from './use-records';

/**
 * Fetch all records for a specific farm
 */
export function useFarmRecords(farmId: number | undefined) {
  const irrigation = useIrrigationRecords(farmId);
  const spray = useSprayRecords(farmId);
  const harvest = useHarvestRecords(farmId);
  const expense = useExpenseRecords(farmId);
  const fertigation = useFertigationRecords(farmId);
  const dailyNotes = useDailyNotes(farmId);

  const isLoading =
    irrigation.isLoading ||
    spray.isLoading ||
    harvest.isLoading ||
    expense.isLoading ||
    fertigation.isLoading ||
    dailyNotes.isLoading;

  const isError =
    irrigation.isError ||
    spray.isError ||
    harvest.isError ||
    expense.isError ||
    fertigation.isError ||
    dailyNotes.isError;

  const refetch = async () => {
    await Promise.all([
      irrigation.refetch(),
      spray.refetch(),
      harvest.refetch(),
      expense.refetch(),
      fertigation.refetch(),
      dailyNotes.refetch(),
    ]);
  };

  return {
    irrigationRecords: irrigation.data,
    sprayRecords: spray.data,
    harvestRecords: harvest.data,
    expenseRecords: expense.data,
    fertigationRecords: fertigation.data,
    dailyNotes: dailyNotes.data,
    isLoading,
    isError,
    refetch,
  };
}
