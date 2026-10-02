/**
 * Edit-mode save for the four QuickLog types.
 *
 * Owns the update orchestration (including irrigation ↔ linked-fertigation
 * sync) so QuickLogSheet stays a UI shell. Payload mapping lives in
 * {@link ./form-to-update}.
 */

import {
  finalizeSprayFormData,
  type FertigationFormData,
  type SprayFormData,
} from '@/components/forms';
import type { AreaUnitPreference } from '@/utils/preferences';
import type { ExpenseFormData, HarvestFormData, IrrigationFormData } from '@/components/forms';
import type {
  ExpenseRecord,
  Farm,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types';
import {
  buildExpenseUpdate,
  buildFertigationUpdate,
  buildHarvestUpdate,
  buildIrrigationUpdate,
  buildSprayUpdate,
} from '@/utils/form-to-update';

export type QuickLogEditTarget =
  | { type: 'irrigation'; record: IrrigationRecord }
  | { type: 'spray'; record: SprayRecord }
  | { type: 'harvest'; record: HarvestRecord }
  | { type: 'expense'; record: ExpenseRecord };

export interface QuickLogEditDrafts {
  irrigation: IrrigationFormData;
  spray: SprayFormData;
  harvest: HarvestFormData;
  expense: ExpenseFormData;
  fertigation: FertigationFormData;
}

export interface QuickLogEditMutations {
  updateIrrigation: (args: {
    id: number;
    updates: ReturnType<typeof buildIrrigationUpdate>;
  }) => Promise<unknown>;
  updateSpray: (args: {
    id: number;
    updates: ReturnType<typeof buildSprayUpdate>;
  }) => Promise<unknown>;
  updateHarvest: (args: {
    id: number;
    updates: ReturnType<typeof buildHarvestUpdate>;
  }) => Promise<unknown>;
  updateExpense: (args: {
    id: number;
    updates: ReturnType<typeof buildExpenseUpdate>;
  }) => Promise<unknown>;
  updateFertigation: (args: {
    id: number;
    updates: ReturnType<typeof buildFertigationUpdate>;
  }) => Promise<unknown>;
  deleteFertigation: (args: {
    id: number;
    clientUuid: string | null;
    farmId: number;
  }) => Promise<unknown>;
  saveLinkedFertigation: (args: {
    data: FertigationFormData;
    farm: Farm;
    dateStr: string;
    preferredAreaUnit: AreaUnitPreference;
    linkedIrrigationRecordId: number;
  }) => Promise<unknown>;
}

export interface SaveQuickLogEditArgs {
  target: QuickLogEditTarget;
  drafts: QuickLogEditDrafts;
  dateStr: string;
  farm: Farm;
  farmAreaAcres: number | null | undefined;
  preferredAreaUnit: AreaUnitPreference;
  isGrapeFarm: boolean;
  /** Optional spray override after PHI double-confirm. */
  sprayPayload?: SprayFormData;
  linkedFertigationRecord?: FertigationRecord;
  /** True only when the fertigation list query settled successfully. */
  isFertigationSettled: boolean;
  mutations: QuickLogEditMutations;
}

function requireId(id: number | undefined | null): number {
  if (id == null) throw new Error('Record ID is missing');
  return id;
}

/**
 * Persist an edited quick-log record. Throws on mutation failure so the caller
 * can surface a single error alert.
 */
export async function saveQuickLogEdit(args: SaveQuickLogEditArgs): Promise<void> {
  const {
    target,
    drafts,
    dateStr,
    farm,
    farmAreaAcres,
    preferredAreaUnit,
    isGrapeFarm,
    sprayPayload,
    linkedFertigationRecord,
    isFertigationSettled,
    mutations,
  } = args;

  switch (target.type) {
    case 'irrigation': {
      const id = requireId(target.record.id);
      await mutations.updateIrrigation({
        id,
        updates: buildIrrigationUpdate(drafts.irrigation, dateStr),
      });

      // Keep the linked fertigation record in step: update, delete when rows
      // were cleared, or create when rows were added to a fertilizer-less log.
      const hasFertilizerRows = drafts.fertigation.fertilizers.length > 0;
      if (linkedFertigationRecord?.id != null) {
        if (hasFertilizerRows) {
          await mutations.updateFertigation({
            id: linkedFertigationRecord.id,
            updates: buildFertigationUpdate(drafts.fertigation, dateStr, farmAreaAcres),
          });
        } else {
          await mutations.deleteFertigation({
            id: linkedFertigationRecord.id,
            clientUuid: linkedFertigationRecord.client_uuid ?? null,
            farmId: requireId(farm.id),
          });
        }
      } else if (hasFertilizerRows && isFertigationSettled) {
        await mutations.saveLinkedFertigation({
          data: { ...drafts.fertigation },
          farm,
          dateStr,
          preferredAreaUnit,
          linkedIrrigationRecordId: id,
        });
      }
      return;
    }
    case 'spray': {
      const id = requireId(target.record.id);
      const sprayData = finalizeSprayFormData(sprayPayload ?? drafts.spray, isGrapeFarm);
      await mutations.updateSpray({
        id,
        updates: buildSprayUpdate(sprayData, dateStr, farmAreaAcres),
      });
      return;
    }
    case 'harvest': {
      const id = requireId(target.record.id);
      await mutations.updateHarvest({
        id,
        updates: buildHarvestUpdate(drafts.harvest, dateStr),
      });
      return;
    }
    case 'expense': {
      const id = requireId(target.record.id);
      await mutations.updateExpense({
        id,
        updates: buildExpenseUpdate(drafts.expense, dateStr),
      });
      return;
    }
  }
}
