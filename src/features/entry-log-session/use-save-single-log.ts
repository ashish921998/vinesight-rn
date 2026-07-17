/**
 * Per-entry log save.
 *
 * The "receipt" Add-Log flow saves each activity the moment the user confirms
 * it, instead of staging drafts and committing them as one batch. This hook
 * reuses {@link submitEntryPendingLog} — the same form-data -> DB-record mapping
 * (PHI metadata, nutrient totals) that the batch session
 * uses — so a single save and a batch save go through identical logic.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Farm } from '@/types';
import type { DailyNoteRecord } from '@/types/database';
import type { LogTypeId } from '@/constants/calculator-models';
import {
  submitEntryPendingLog,
  type EntryLogFarmContext,
  type EntryLogSubmitters,
  type EntryPendingLogSubmission,
} from '@/utils/entry-log-submission';
import { resolveAreaUnitPreference, type AreaUnitPreference } from '@/utils/preferences';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpsertDailyNote,
  fetchDailyNoteByDate,
  queryKeys,
} from '@/hooks';

export interface SaveSingleLogInput {
  type: LogTypeId;
  data: EntryPendingLogSubmission['data'];
  farm: Farm;
  dateStr: string;
  preferredAreaUnit: AreaUnitPreference;
}

export interface SaveSingleLogResult {
  type: LogTypeId;
  /** Record id from the insert. May be null until an offline-created row is reconciled. */
  recordId: number | null;
  clientUuid: string | null;
  farmId: number;
  /**
   * Snapshot of the daily note that existed before this save. Only set for note entries.
   * Used by the receipt screen to restore the original text if the user removes the row,
   * rather than deleting the whole record (which would lose a pre-existing note).
   */
  previousDailyNote?: DailyNoteRecord | null;
}

function buildFarmContext(farm: Farm, preferredAreaUnit: AreaUnitPreference): EntryLogFarmContext {
  return {
    id: farm.id ?? 0,
    area: farm.area,
    areaUnit: resolveAreaUnitPreference(preferredAreaUnit),
    system_discharge: farm.system_discharge,
    date_of_pruning: farm.date_of_pruning,
  };
}

/**
 * Returns an async `saveLog` that persists a single activity and invalidates the
 * dashboard queries. Throws on failure so the caller can surface a per-row error
 * and offer retry — unlike the batch flow, one failure never blocks the others.
 */
export function useSaveSingleLog() {
  const queryClient = useQueryClient();
  const createIrrigation = useCreateIrrigationRecord();
  const createSpray = useCreateSprayRecord();
  const createHarvest = useCreateHarvestRecord();
  const createExpense = useCreateExpenseRecord();
  const createFertigation = useCreateFertigationRecord();
  const upsertDailyNote = useUpsertDailyNote();

  return useCallback(
    async (input: SaveSingleLogInput): Promise<SaveSingleLogResult> => {
      const { type, data, farm, dateStr, preferredAreaUnit } = input;
      const farmId = farm.id;
      if (typeof farmId !== 'number') {
        throw new Error('Cannot save log: farm has no id');
      }

      const submitters: EntryLogSubmitters = {
        createIrrigation: (payload) => createIrrigation.mutateAsync(payload),
        createSpray: (payload) => createSpray.mutateAsync(payload),
        createHarvest: (payload) => createHarvest.mutateAsync(payload),
        createExpense: (payload) => createExpense.mutateAsync(payload),
        createFertigation: (payload) => createFertigation.mutateAsync(payload),
        upsertDailyNote: (payload) => upsertDailyNote.mutateAsync(payload),
      };

      const previousDailyNote =
        type === 'note' ? await fetchDailyNoteByDate(farmId, dateStr) : undefined;

      const result = await submitEntryPendingLog({
        log: { id: `single_${type}`, type, data },
        dateStr,
        farm: buildFarmContext(farm, preferredAreaUnit),
        submitters,
      });

      // Refresh the dashboard in the background — don't block the caller (and the
      // user) on the full dashboard refetch. The record is already written; the
      // receipt screen can close/advance immediately while the dashboard catches up.
      // A background refetch failure is non-critical (each query tracks its own
      // error state), so swallow it rather than surfacing an unhandled rejection.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }).catch(() => {});

      return {
        type,
        recordId: result.recordId,
        clientUuid: result.clientUuid ?? null,
        farmId,
        previousDailyNote,
      };
    },
    [
      queryClient,
      createIrrigation,
      createSpray,
      createHarvest,
      createExpense,
      createFertigation,
      upsertDailyNote,
    ],
  );
}
