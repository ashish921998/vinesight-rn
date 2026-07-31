/**
 * Shared create-time transaction for an irrigation log that carries a linked
 * fertigation "rider".
 *
 * Both the quick-log sheet ({@link QuickLogSheet}) and the receipt Add-Log
 * screen ({@link ReceiptLogScreen}) persist an irrigation and — when the farmer
 * added fertilizers — a fertigation record pointing back at the irrigation's id.
 * If the fertigation save fails, the irrigation is deleted so a retry can't
 * create a duplicate pair, then the original error rethrows.
 *
 * What stays with the callers (it differs intentionally):
 * - Telemetry capture (the quick-log sheet emits `meaningful_action` for the
 *   fertigation rider; the receipt screen does not, and the capture order
 *   differs).
 * - Guided-tour emission and haptics.
 * - Retry-ref retention (the quick-log sheet retains the saved irrigation in a
 *   ref so a retry only re-saves the rider; the receipt screen has no such ref).
 * - Entry-list / receipt-row bookkeeping.
 *
 * The batch entry-form flow uses a different mechanism (pending-log-id linking
 * and whole-batch rollback via {@link saveEntryLogSession}), and the
 * activity-edit-form flow updates/deletes an existing linked fertigation rather
 * than creating one — neither shares this transaction.
 */
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';
import type { IrrigationFormData, FertigationFormData } from '@/components/forms';
import type { RecordRef } from '@/features/offline/record-writes';
import type { SaveSingleLogInput, SaveSingleLogResult } from './use-save-single-log';

/** Persists a single activity, the contract returned by {@link useSaveSingleLog}. */
export type SaveLogFn = (input: SaveSingleLogInput) => Promise<SaveSingleLogResult>;

/** Deletes an irrigation row by ref (server id preferred, client_uuid fallback). */
export type IrrigationDeleteFn = (ref: RecordRef & { farmId: number }) => Promise<void>;

export interface SaveIrrigationWithLinkedFertigationParams {
  saveLog: SaveLogFn;
  deleteIrrigation: IrrigationDeleteFn;
  irrigationData: IrrigationFormData;
  fertigationData: FertigationFormData;
  /** When false (no fertilizer rows), only the irrigation is saved. */
  hasFertilizers: boolean;
  farm: Farm;
  dateStr: string;
  preferredAreaUnit: AreaUnitPreference;
  /**
   * A previously-saved irrigation result to reuse instead of re-saving (the
   * quick-log sheet's retry path). When set, the irrigation save is skipped and
   * the fertigation rider links to this existing record. Undefined/null always
   * saves fresh.
   */
  existingIrrigation?: SaveSingleLogResult | null;
}

export interface SaveIrrigationWithLinkedFertigationResult {
  /** The irrigation record that was saved (or reused, on the retry path). */
  irrigation: SaveSingleLogResult;
  /** The linked fertigation record, or null when no fertilizers were saved. */
  fertigation: SaveSingleLogResult | null;
}

/**
 * Save an irrigation log and, when it carries fertilizers, a linked fertigation
 * record pointing at the irrigation's id. If the fertigation save fails, the
 * irrigation is deleted (best-effort) so a retry can't create a duplicate pair,
 * then the original error rethrows.
 *
 * @returns the irrigation result and, when applicable, the fertigation result.
 */
export async function saveIrrigationWithLinkedFertigation(
  params: SaveIrrigationWithLinkedFertigationParams,
): Promise<SaveIrrigationWithLinkedFertigationResult> {
  const {
    saveLog,
    deleteIrrigation,
    irrigationData,
    fertigationData,
    hasFertilizers,
    farm,
    dateStr,
    preferredAreaUnit,
    existingIrrigation,
  } = params;

  const irrigation =
    existingIrrigation ??
    (await saveLog({
      type: 'irrigation',
      data: { ...irrigationData },
      farm,
      dateStr,
      preferredAreaUnit,
    }));

  if (!hasFertilizers) {
    return { irrigation, fertigation: null };
  }

  try {
    const fertigation = await saveLog({
      type: 'fertigation',
      data: { ...fertigationData },
      farm,
      dateStr,
      preferredAreaUnit,
      linkedIrrigationRecordId: irrigation.recordId,
    });
    return { irrigation, fertigation };
  } catch (error) {
    // Don't leave a half-saved pair behind: undo the irrigation so a retry
    // can't create duplicates. Compensation is best-effort — a delete failure
    // (e.g. an offline-queued delete that commits on replay) is swallowed so
    // the original save error reaches the caller.
    try {
      await deleteIrrigation({
        id: irrigation.recordId,
        clientUuid: irrigation.clientUuid,
        farmId: irrigation.farmId,
      });
    } catch {
      // best-effort; surfacing the original save error matters more
    }
    throw error;
  }
}
