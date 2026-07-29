/**
 * Edit Activity Modal
 * Modal for editing farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS EditCloudActivityLogView.swift
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  type TextInputProps,
  Keyboard,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { DateField, FormModal, SectionHeader } from '@/components/ui';
import { spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { triggerHapticSuccess } from '@/utils/haptics';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import {
  IrrigationForm,
  SprayForm,
  HarvestForm,
  ExpenseForm,
  FertigationForm,
  validateIrrigationForm,
  validateSprayForm,
  validateHarvestForm,
  validateExpenseForm,
  validateFertigationForm,
  createEmptySprayFormData,
  createEmptyHarvestFormData,
  createEmptyExpenseFormData,
  createEmptyFertigationFormData,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
} from '@/components/forms';
import { type ExpenseTypeId, type LogTypeId } from '@/constants/calculator-models';
import { isFertigationUnitRecognized } from '@/constants/fertilizer-units';
import {
  useUpdateIrrigationRecord,
  useUpdateSprayRecord,
  useUpdateHarvestRecord,
  useUpdateExpenseRecord,
  useUpdateFertigationRecord,
  useDeleteFertigationRecord,
  useFertigationRecords,
  useFarmAreaAcres,
  useResponsiveHeight,
} from '@/hooks';
import { useSaveSingleLog } from '@/features/entry-log-session';
import { toSupabaseDateString, fromSupabaseDateString } from '@/types';
import type {
  Farm,
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { mapExpenseTypeIdToRecordType } from '@/utils/expense-type';
import {
  irrigationRecordToFormData,
  sprayRecordToFormData,
  harvestRecordToFormData,
  expenseRecordToFormData,
  fertigationRecordToFormData,
} from '@/utils/record-to-form';

interface ActivityEditFormProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  logType: LogTypeId;
  record: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function ActivityEditForm({
  visible,
  onClose,
  farm,
  logType,
  record,
  onSaveSuccess,
  presentation = 'modal',
}: ActivityEditFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const { farmAreaAcres, preferredAreaUnit } = useFarmAreaAcres(farm.area);
  const isVisible = visible ?? true;
  const { windowHeight } = useResponsiveHeight();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedRecordId, setInitializedRecordId] = useState<number | undefined>(undefined);
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: undefined });
  const [sprayData, setSprayData] = useState<SprayFormData>(createEmptySprayFormData());
  const [harvestData, setHarvestData] = useState<HarvestFormData>(createEmptyHarvestFormData());
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(createEmptyExpenseFormData());
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(
    createEmptyFertigationFormData(),
  );

  const updateIrrigation = useUpdateIrrigationRecord();
  const updateSpray = useUpdateSprayRecord();
  const updateHarvest = useUpdateHarvestRecord();
  const updateExpense = useUpdateExpenseRecord();
  const updateFertigation = useUpdateFertigationRecord();
  const deleteFertigation = useDeleteFertigationRecord();
  const saveLog = useSaveSingleLog();

  // Editing an irrigation log also edits the fertigation record linked to it
  // (fused create UX writes the pair; edit mirrors create). Loaded via the
  // farm-scoped list and matched on irrigation_record_id.
  const fertigationQuery = useFertigationRecords(
    logType === 'irrigation' ? (farm.id ?? undefined) : undefined,
  );
  const linkedFertigationRecord = useMemo(
    () =>
      logType === 'irrigation' && record.id != null
        ? (fertigationQuery.data ?? []).find((f) => f.irrigation_record_id === record.id)
        : undefined,
    [logType, fertigationQuery.data, record.id],
  );
  // ponytail: edits the first linked fertigation only; multi-rider irrigation
  // logs (possible in principle, not produced by any create path) keep extras
  // untouched.
  const [linkedFertigationData, setLinkedFertigationData] = useState<FertigationFormData>({
    fertilizers: [],
  });
  // The hydration guard keys on the LINKED RECORD's identity, not just the
  // irrigation id: isSuccess can be served from the (MMKV-persisted, 5min
  // staleTime) cache before a background refetch reveals a just-created rider.
  // If the guard only tracked record.id, the form would lock onto that stale
  // "no rows" snapshot while handleSave reads the live linkedFertigationRecord
  // — and Save would then delete a record the user never saw. Re-keying makes
  // the form re-hydrate when the linked record appears/changes; unsaved
  // fertilizer edits in that brief window are replaced, which is the safer
  // trade against silent deletion.
  const [fertInitializedKey, setFertInitializedKey] = useState<string | undefined>(undefined);
  const fertHydrationKey = `${record.id}:${linkedFertigationRecord?.id ?? 'none'}`;
  // isSuccess, not !isLoading: an errored query must NOT count as settled —
  // treating it as "no linked record" would let Save create a duplicate rider
  // for an irrigation whose fertigation merely failed to load.
  const isFertigationSettled = logType === 'irrigation' && fertigationQuery.isSuccess;
  useEffect(() => {
    if (!isVisible || !isFertigationSettled || fertInitializedKey === fertHydrationKey) return;
    setLinkedFertigationData(
      linkedFertigationRecord
        ? fertigationRecordToFormData(linkedFertigationRecord)
        : { fertilizers: [] },
    );
    setFertInitializedKey(fertHydrationKey);
  }, [
    isVisible,
    isFertigationSettled,
    fertInitializedKey,
    fertHydrationKey,
    linkedFertigationRecord,
  ]);

  const isFormValid = useMemo(() => {
    switch (logType) {
      case 'irrigation':
        // Fertilizer rows ride along: zero rows means "remove/none", partial
        // rows block Save (same contract as the create flows).
        return (
          validateIrrigationForm(irrigationData) &&
          (linkedFertigationData.fertilizers.length === 0 ||
            validateFertigationForm(linkedFertigationData))
        );
      case 'spray':
        return validateSprayForm(sprayData);
      case 'harvest':
        return validateHarvestForm(harvestData);
      case 'expense':
        return validateExpenseForm(expenseData);
      case 'fertigation':
        return validateFertigationForm(fertigationData);
      default:
        return false;
    }
  }, [
    logType,
    irrigationData,
    sprayData,
    harvestData,
    expenseData,
    fertigationData,
    linkedFertigationData,
  ]);

  // Shared by the fertigation edit case and the linked-fertigation save inside
  // the irrigation case — identical mapping, one source of truth.
  const buildFertigationUpdates = useCallback(
    (data: FertigationFormData) => {
      const fertilizerItems = data.fertilizers.map((f) => ({
        name: f.name.trim(),
        // Testimony rule (issue #192): stored verbatim; kernel-unknown
        // strings are flagged for review, never coerced to kg.
        unit: f.unit,
        quantity: f.quantity ?? 0,
        quantity_basis: f.quantityBasis ?? 'total',
        ...(isFertigationUnitRecognized(f.unit) ? {} : { unit_unrecognized: true }),
        warehouse_item_id: f.warehouseItemId ?? null,
        catalog_product_id: f.catalogProductId ?? null,
        plan_item_id: f.planItemId ?? null,
        composition_snapshot: f.compositionSnapshot ?? null,
        density_kg_per_l: f.densityKgPerL ?? null,
      }));
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: fertilizerItems,
        areaAcre: farmAreaAcres ?? 0,
      });
      return {
        fertilizers: fertilizerItems,
        nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
        nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
        nutrient_calc_coverage: nutrientTotals.coveragePercent,
      };
    },
    [farmAreaAcres],
  );

  const scrollToNode = useCallback(
    (nodeHandle: number) => {
      if (!keyboardHeightRef.current) return;
      const resolvedHandle = findNodeHandle(nodeHandle) ?? nodeHandle;
      if (typeof resolvedHandle !== 'number') return;
      UIManager.measureInWindow(resolvedHandle, (_x, y, _width, height) => {
        const keyboardTop = windowHeight - keyboardHeightRef.current;
        const inputBottom = y + height;
        const buffer = 24;
        if (inputBottom > keyboardTop - buffer) {
          const scrollBy = inputBottom - (keyboardTop - buffer);
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + scrollBy),
            animated: true,
          });
        }
      });
    },
    [windowHeight],
  );

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    return () => {
      keyboardShowListener.remove();
    };
  }, [scrollToNode]);

  type OnFocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

  const scrollToFocusedInput = useCallback(
    (event: OnFocusEvent) => {
      const target = (event as { target?: unknown }).target ?? null;
      const nodeHandle = findNodeHandle(target as unknown as number | React.Component | null);
      if (typeof nodeHandle !== 'number') return;
      focusedInputRef.current = nodeHandle;
      requestAnimationFrame(() => scrollToNode(nodeHandle));
    },
    [scrollToNode],
  );

  useEffect(() => {
    if (isVisible && (!isInitialized || initializedRecordId !== record.id)) {
      const parsedDate = fromSupabaseDateString(record.date);
      if (parsedDate) setSelectedDate(parsedDate);

      switch (logType) {
        case 'irrigation':
          setIrrigationData(irrigationRecordToFormData(record as IrrigationRecord));
          break;
        case 'spray':
          setSprayData(sprayRecordToFormData(record as SprayRecord));
          break;
        case 'harvest':
          setHarvestData(harvestRecordToFormData(record as HarvestRecord));
          break;
        case 'expense':
          setExpenseData(expenseRecordToFormData(record as ExpenseRecord));
          break;
        case 'fertigation':
          setFertigationData(fertigationRecordToFormData(record as FertigationRecord));
          break;
      }
      setInitializedRecordId(record.id);
      setIsInitialized(true);
    }
  }, [isVisible, isInitialized, initializedRecordId, logType, record]);

  const handleSave = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    const dateStr = toSupabaseDateString(selectedDate);

    try {
      switch (logType) {
        case 'irrigation': {
          const r = record as IrrigationRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateIrrigation.mutateAsync({
            id: r.id,
            updates: {
              duration: irrigationData.duration,
              date: dateStr,
            },
          });
          // Keep the linked fertigation record in step with the irrigation it
          // was applied with: update it (incl. the date, so the pair never
          // desyncs), delete it when all rows were removed, or create a new
          // linked one when rows were added to a fertilizer-less irrigation.
          const hasFertilizerRows = linkedFertigationData.fertilizers.length > 0;
          if (linkedFertigationRecord?.id != null) {
            if (hasFertilizerRows) {
              await updateFertigation.mutateAsync({
                id: linkedFertigationRecord.id,
                updates: {
                  ...buildFertigationUpdates(linkedFertigationData),
                  date: dateStr,
                },
              });
            } else {
              await deleteFertigation.mutateAsync({
                id: linkedFertigationRecord.id,
                clientUuid: linkedFertigationRecord.client_uuid ?? null,
                farmId: farm.id ?? 0,
              });
            }
          } else if (hasFertilizerRows && isFertigationSettled) {
            await saveLog({
              type: 'fertigation',
              data: { ...linkedFertigationData },
              farm,
              dateStr,
              preferredAreaUnit,
              linkedIrrigationRecordId: r.id,
            });
          }
          break;
        }
        case 'spray': {
          const r = record as SprayRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          const chemicalStr = sprayData.chemicals
            .map((c) => `${c.name} (${c.quantity} ${c.unit})`)
            .join(', ');
          const doseStr = sprayData.waterVolume != null ? `Water: ${sprayData.waterVolume}L` : '';
          const chemicalItems = sprayData.chemicals
            .filter((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
            .map((c) => ({
              name: c.name.trim(),
              unit: c.unit,
              quantity: c.quantity!,
              quantity_basis: c.quantityBasis ?? 'total',
              warehouse_item_id: c.warehouseItemId ?? null,
              catalog_product_id: c.catalogProductId ?? null,
              plan_item_id: c.planItemId ?? null,
              composition_snapshot: c.compositionSnapshot ?? null,
              density_kg_per_l: c.densityKgPerL ?? null,
            }));
          const nutrientTotals = calculateNutrientTotalsForLog({
            items: chemicalItems,
            areaAcre: farmAreaAcres ?? 0,
            waterVolumeL: sprayData.waterVolume ?? null,
          });
          await updateSpray.mutateAsync({
            id: r.id,
            updates: {
              chemical: chemicalStr,
              chemical_items: chemicalItems,
              dose: doseStr,
              nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
              nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
              nutrient_calc_coverage: nutrientTotals.coveragePercent,
              date: dateStr,
            },
          });
          break;
        }
        case 'harvest': {
          const r = record as HarvestRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateHarvest.mutateAsync({
            id: r.id,
            updates: {
              quantity: harvestData.quantity,
              grade: harvestData.grade,
              price: harvestData.price || undefined,
              buyer: harvestData.buyer || undefined,
              date: dateStr,
            },
          });
          break;
        }
        case 'expense': {
          const r = record as ExpenseRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateExpense.mutateAsync({
            id: r.id,
            updates: {
              type: mapExpenseTypeIdToRecordType((expenseData.type || 'Other') as ExpenseTypeId),
              cost: expenseData.cost,
              remarks: expenseData.remarks || undefined,
              date: dateStr,
            },
          });
          break;
        }
        case 'fertigation': {
          const r = record as FertigationRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateFertigation.mutateAsync({
            id: r.id,
            updates: {
              ...buildFertigationUpdates(fertigationData),
              date: dateStr,
            },
          });
          break;
        }
      }

      triggerHapticSuccess();
      onSaveSuccess?.();
      setIsInitialized(false);
      onClose();
    } catch (error) {
      console.error('Error updating log:', error);
      Alert.alert(t('common.error'), t('common.errors.failedToUpdateLog'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsInitialized(false);
    setInitializedRecordId(undefined);
    setFertInitializedKey(undefined);
    onClose();
  };

  const renderForm = () => {
    if (!isInitialized) {
      return (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing[10],
          }}
        >
          <Spinner size="large" color={m3.primary.p500} />
          <Text selectable style={{ marginTop: spacing[4], color: m3.surface.s500 }}>
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: spacing[4] }}>
        {logType === 'irrigation' && (
          <>
            <IrrigationForm
              data={irrigationData}
              onChange={setIrrigationData}
              onInputFocus={scrollToFocusedInput}
            />
            {/* Linked fertigation edits inline with its irrigation — same fused
                UX as create. Hidden until the linked record has loaded so a
                premature Save can't create a duplicate rider. */}
            {isFertigationSettled && fertInitializedKey === fertHydrationKey && (
              <View style={{ marginTop: spacing[4] }}>
                <FertigationForm
                  data={linkedFertigationData}
                  onChange={setLinkedFertigationData}
                  onInputFocus={scrollToFocusedInput}
                  areaAcres={farmAreaAcres}
                  compact
                />
              </View>
            )}
          </>
        )}
        {logType === 'spray' && (
          <SprayForm
            data={sprayData}
            onChange={setSprayData}
            onInputFocus={scrollToFocusedInput}
            areaAcres={farmAreaAcres}
          />
        )}
        {logType === 'harvest' && (
          <HarvestForm
            data={harvestData}
            onChange={setHarvestData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {logType === 'expense' && (
          <ExpenseForm
            data={expenseData}
            onChange={setExpenseData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {logType === 'fertigation' && (
          <FertigationForm
            data={fertigationData}
            onChange={setFertigationData}
            onInputFocus={scrollToFocusedInput}
            areaAcres={farmAreaAcres}
          />
        )}
      </View>
    );
  };

  return (
    <FormModal
      visible={isVisible}
      onClose={handleClose}
      title={t('activityEdit.title')}
      onSave={handleSave}
      saveLabel={t('common.saveChanges')}
      isLoading={isSubmitting}
      isSaveDisabled={!isFormValid}
      presentation={presentation}
      scrollViewRef={scrollViewRef}
      scrollViewProps={{
        keyboardShouldPersistTaps: 'handled',
        onScroll: (event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        },
        scrollEventThrottle: 16,
      }}
    >
      <SectionHeader
        title={t('activityEdit.detailsTitle')}
        subtitle={farm.name}
        style={{ marginBottom: spacing[4] }}
      />

      <DateField
        value={selectedDate}
        onChange={setSelectedDate}
        label={t('activityEdit.dateLabel')}
        style={{ marginBottom: spacing[6] }}
      />

      {renderForm()}
    </FormModal>
  );
}
