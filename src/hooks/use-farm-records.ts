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
import { useTemporaryWorkerEntries } from './use-workers';

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
  const tempWorkers = useTemporaryWorkerEntries(farmId);

  const isLoading =
    irrigation.isLoading ||
    spray.isLoading ||
    harvest.isLoading ||
    expense.isLoading ||
    fertigation.isLoading ||
    dailyNotes.isLoading ||
    tempWorkers.isLoading;

  const isError =
    irrigation.isError ||
    spray.isError ||
    harvest.isError ||
    expense.isError ||
    fertigation.isError ||
    dailyNotes.isError ||
    tempWorkers.isError;

  const refetch = async () => {
    await Promise.all([
      irrigation.refetch(),
      spray.refetch(),
      harvest.refetch(),
      expense.refetch(),
      fertigation.refetch(),
      dailyNotes.refetch(),
      tempWorkers.refetch(),
    ]);
  };

  return {
    irrigationRecords: irrigation.data,
    sprayRecords: spray.data,
    harvestRecords: harvest.data,
    expenseRecords: expense.data,
    fertigationRecords: fertigation.data,
    dailyNotes: dailyNotes.data,
    temporaryWorkerEntries: tempWorkers.data,
    isLoading,
    isError,
    refetch,
  };
}
