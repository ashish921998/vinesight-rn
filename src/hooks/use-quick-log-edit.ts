/**
 * Edit-mode plumbing for QuickLogSheet: linked-fertigation hydration and the
 * shared {@link saveQuickLogEdit} call. Keeps the sheet a UI shell.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  SprayFormData,
} from '@/components/forms';
import {
  useDeleteFertigationRecord,
  useFertigationRecords,
  useUpdateExpenseRecord,
  useUpdateFertigationRecord,
  useUpdateHarvestRecord,
  useUpdateIrrigationRecord,
  useUpdateSprayRecord,
} from '@/hooks/use-records';
import { useSaveSingleLog } from '@/features/entry-log-session';
import { fertigationRecordToFormData } from '@/utils/record-to-form';
import { saveQuickLogEdit, type QuickLogEditTarget } from '@/utils/quick-log-edit-save';
import { queryKeys } from '@/hooks/query-keys';
import type { Farm } from '@/types';
import type { AreaUnitPreference } from '@/utils/preferences';

export interface UseQuickLogEditArgs {
  editTarget: QuickLogEditTarget | null;
  farm: Farm | null;
  farmAreaAcres: number | null | undefined;
  preferredAreaUnit: AreaUnitPreference;
  isGrapeFarm: boolean;
  dateStr: string;
  drafts: {
    irrigation: IrrigationFormData;
    spray: SprayFormData;
    harvest: HarvestFormData;
    expense: ExpenseFormData;
    fertigation: FertigationFormData;
  };
  setFertigationDraft: (data: FertigationFormData) => void;
}

export function useQuickLogEdit({
  editTarget,
  farm,
  farmAreaAcres,
  preferredAreaUnit,
  isGrapeFarm,
  dateStr,
  drafts,
  setFertigationDraft,
}: UseQuickLogEditArgs) {
  const farmId = farm?.id ?? undefined;
  const queryClient = useQueryClient();
  const saveLog = useSaveSingleLog();
  const updateIrrigation = useUpdateIrrigationRecord();
  const updateSpray = useUpdateSprayRecord();
  const updateHarvest = useUpdateHarvestRecord();
  const updateExpense = useUpdateExpenseRecord();
  const updateFertigation = useUpdateFertigationRecord();
  const deleteFertigation = useDeleteFertigationRecord();

  const irrigationEditId =
    editTarget?.type === 'irrigation' ? (editTarget.record.id ?? undefined) : undefined;
  const fertigationEditQuery = useFertigationRecords(irrigationEditId != null ? farmId : undefined);
  const linkedFertigationRecord = useMemo(
    () =>
      irrigationEditId != null
        ? (fertigationEditQuery.data ?? []).find((f) => f.irrigation_record_id === irrigationEditId)
        : undefined,
    [irrigationEditId, fertigationEditQuery.data],
  );

  // Treat a query error as settled so a failed lookup doesn't permanently
  // disable Save — the user can still edit the irrigation row itself.
  const isFertigationEditSettled =
    irrigationEditId != null && (fertigationEditQuery.isSuccess || fertigationEditQuery.isError);
  // Ref (not state) tracks which linked-record snapshot was last applied so
  // we re-seed when the query reveals a rider, without cascading renders.
  const fertEditHydrationKeyRef = useRef<string | undefined>(undefined);
  const fertEditKey = `${irrigationEditId ?? 'none'}:${linkedFertigationRecord?.id ?? 'none'}`;

  useEffect(() => {
    if (editTarget == null) {
      fertEditHydrationKeyRef.current = undefined;
      return;
    }
    if (!isFertigationEditSettled || fertEditHydrationKeyRef.current === fertEditKey) return;
    setFertigationDraft(
      linkedFertigationRecord
        ? fertigationRecordToFormData(linkedFertigationRecord)
        : { fertilizers: [] },
    );
    fertEditHydrationKeyRef.current = fertEditKey;
  }, [
    editTarget,
    isFertigationEditSettled,
    fertEditKey,
    linkedFertigationRecord,
    setFertigationDraft,
  ]);

  const saveEdit = useCallback(
    async (sprayPayload?: SprayFormData) => {
      if (!editTarget || !farm) return;
      await saveQuickLogEdit({
        target: editTarget,
        drafts,
        dateStr,
        farm,
        farmAreaAcres,
        preferredAreaUnit,
        isGrapeFarm,
        sprayPayload,
        linkedFertigationRecord,
        isFertigationSettled: isFertigationEditSettled,
        mutations: {
          updateIrrigation: (args) => updateIrrigation.mutateAsync(args),
          updateSpray: (args) => updateSpray.mutateAsync(args),
          updateHarvest: (args) => updateHarvest.mutateAsync(args),
          updateExpense: (args) => updateExpense.mutateAsync(args),
          updateFertigation: (args) => updateFertigation.mutateAsync(args),
          deleteFertigation: (args) => deleteFertigation.mutateAsync(args),
          saveLinkedFertigation: ({
            data,
            farm: f,
            dateStr: d,
            preferredAreaUnit: unit,
            linkedIrrigationRecordId,
          }) =>
            saveLog({
              type: 'fertigation',
              data,
              farm: f,
              dateStr: d,
              preferredAreaUnit: unit,
              linkedIrrigationRecordId,
            }),
        },
      });
      // Invalidate dashboard so recent-activity rows reflect the edit.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }).catch(() => {});
    },
    [
      editTarget,
      farm,
      drafts,
      dateStr,
      farmAreaAcres,
      preferredAreaUnit,
      isGrapeFarm,
      linkedFertigationRecord,
      isFertigationEditSettled,
      updateIrrigation,
      updateSpray,
      updateHarvest,
      updateExpense,
      updateFertigation,
      deleteFertigation,
      saveLog,
      queryClient,
    ],
  );

  return {
    isFertigationEditSettled,
    saveEdit,
  };
}
