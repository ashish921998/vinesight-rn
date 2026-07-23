/**
 * QuickLogSheet — single-log bottom sheet for dashboard quick actions.
 *
 * Tapping a quick action opens one sheet with just that log's form; Save
 * persists immediately (via {@link useSaveSingleLog}) and closes the sheet.
 * The farm is the dashboard's selected farm and is NOT repeated here (it's
 * already visible in the "Logging to" bar); the date defaults to today.
 *
 * Irrigation carries an optional "add fertilizers" switch that saves a linked
 * fertigation record. Spray gets the full picker sources (catalog mixes,
 * warehouse, history, plan) plus the PHI harvest-safety check on Save.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, Switch } from 'react-native';
import { BottomSheet, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol } from '@/components/ui/symbol';
import { SheetHeader } from '@/components/ui/sheet-header';
import { Spinner } from '@/components/ui/spinner';
import { DateField } from '@/components/ui';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { getLogType, type LogTypeId } from '@/constants/calculator-models';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';
import { isGrapeCrop } from '@/utils/crop';
import { isPhiConflict } from '@/services/phi-service';
import { createStartSeasonHref } from '@/utils/add-log-navigation';
import { triggerHapticSuccess } from '@/utils/haptics';
import { telemetry } from '@/services/telemetry';
import { guidedTourEmit } from '@/features/guided-tour';
import {
  IrrigationForm,
  SprayForm,
  ExpenseForm,
  HarvestForm,
  FertigationForm,
  validateIrrigationForm,
  validateSprayForm,
  validateExpenseForm,
  validateHarvestForm,
  validateFertigationForm,
  createEmptySprayFormData,
  createEmptyExpenseFormData,
  createEmptyHarvestFormData,
  createEmptyFertigationFormData,
  finalizeSprayFormData,
  type IrrigationFormData,
  type SprayFormData,
  type ExpenseFormData,
  type HarvestFormData,
  type FertigationFormData,
} from '@/components/forms';
import {
  useFarmAreaAcres,
  useFarmSeasonStatus,
  useChemicalMixSearch,
  usePhiComputation,
  useSprayInputSources,
  useFertigationInputSources,
  useDeleteIrrigationRecord,
} from '@/hooks';
import { useSaveSingleLog } from '@/features/entry-log-session';

export type QuickLogType = Extract<LogTypeId, 'irrigation' | 'spray' | 'harvest' | 'expense'>;

interface QuickLogSheetProps {
  /** Which log's sheet to show; null keeps the sheet closed. */
  type: QuickLogType | null;
  farm: Farm | null;
  onClose: () => void;
}

export function QuickLogSheet({ type, farm, onClose }: QuickLogSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const farmId = farm?.id ?? undefined;
  const isGrapeFarm = isGrapeCrop(farm?.crop, farm?.crop_variety);
  const { preferredAreaUnit, farmAreaAcres } = useFarmAreaAcres(farm?.area);
  const { activeSeason, hasResolvedSeasons } = useFarmSeasonStatus(farmId);
  // Gate on hasResolvedSeasons: activeSeason is null both while the query
  // loads and when it errors, so only a confirmed no-season result blocks.
  const isBlockedByNoSeason = farmId != null && hasResolvedSeasons && !activeSeason;

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateStr = useMemo(() => toSupabaseDateString(selectedDate), [selectedDate]);

  const [irrigationDraft, setIrrigationDraft] = useState<IrrigationFormData>({
    duration: undefined,
  });
  const [includeFertilizers, setIncludeFertilizers] = useState(false);
  const [fertigationDraft, setFertigationDraft] = useState<FertigationFormData>(() =>
    createEmptyFertigationFormData(),
  );
  const [sprayDraft, setSprayDraft] = useState<SprayFormData>(() => createEmptySprayFormData());
  const [expenseDraft, setExpenseDraft] = useState<ExpenseFormData>(() =>
    createEmptyExpenseFormData(),
  );
  const [harvestDraft, setHarvestDraft] = useState<HarvestFormData>(() =>
    createEmptyHarvestFormData(),
  );
  const [saving, setSaving] = useState(false);
  // Synchronous re-entrancy guard (the `saving` state flips a tick later).
  const savingRef = useRef(false);

  // Fresh sheet per open: today's date, empty drafts, fertilizers off.
  useEffect(() => {
    if (!type) return;
    setSelectedDate(new Date());
    setIrrigationDraft({ duration: undefined });
    setIncludeFertilizers(false);
    setFertigationDraft(createEmptyFertigationFormData());
    setSprayDraft(createEmptySprayFormData());
    setExpenseDraft(createEmptyExpenseFormData());
    setHarvestDraft(createEmptyHarvestFormData());
  }, [type]);

  // Picker sources — catalog for spray (per design), plan/warehouse/history for both.
  const spraySources = useSprayInputSources(farmId);
  const fertigationSources = useFertigationInputSources(farmId, {
    catalogEnabled: type === 'irrigation' && includeFertilizers,
  });
  const { data: catalogMixes = [] } = useChemicalMixSearch('', isGrapeFarm);

  // PHI fields derive from mix + spray date; stamp them into the draft so the
  // saved record carries them (same contract as EntryForm).
  const { data: sprayPhiComputation } = usePhiComputation(sprayDraft.catalogMixId ?? null, dateStr);
  useEffect(() => {
    if (!sprayPhiComputation) return;
    setSprayDraft((prev) => {
      if (prev.catalogMixId !== sprayPhiComputation.catalogMixId) return prev;
      if (
        prev.governingPhiDays === sprayPhiComputation.governingPhiDays &&
        prev.safeHarvestDate === sprayPhiComputation.safeHarvestDate &&
        prev.phiBlockingComponent === sprayPhiComputation.blockingComponentName &&
        prev.phiStatus === sprayPhiComputation.phiStatus
      ) {
        return prev;
      }
      return {
        ...prev,
        governingPhiDays: sprayPhiComputation.governingPhiDays,
        safeHarvestDate: sprayPhiComputation.safeHarvestDate,
        phiBlockingComponent: sprayPhiComputation.blockingComponentName,
        phiStatus: sprayPhiComputation.phiStatus,
      };
    });
  }, [sprayPhiComputation]);

  const saveLog = useSaveSingleLog();
  const deleteIrrigation = useDeleteIrrigationRecord();
  // Retain a successfully created irrigation when compensation fails so an
  // immediate retry only saves its fertigation rider instead of duplicating it.
  const pendingIrrigationRef = useRef<Awaited<ReturnType<typeof saveLog>> | null>(null);

  const isValid =
    type === 'irrigation'
      ? validateIrrigationForm(irrigationDraft) &&
        (!includeFertilizers || validateFertigationForm(fertigationDraft))
      : type === 'spray'
        ? validateSprayForm(sprayDraft)
        : type === 'expense'
          ? validateExpenseForm(expenseDraft)
          : type === 'harvest'
            ? validateHarvestForm(harvestDraft)
            : false;

  const captureSaved = useCallback((recordType: LogTypeId, savedFarmId: number) => {
    try {
      telemetry.capture('record_created', {
        record_type: recordType,
        created_from: 'manual',
        farm_id: savedFarmId,
      });
      telemetry.capture('meaningful_action', {
        action_type: 'record_created',
        feature_name: recordType,
      });
    } catch {
      // telemetry is best-effort
    }
  }, []);

  const performSave = useCallback(
    async (sprayPayload?: SprayFormData) => {
      if (!type || !farm || savingRef.current || isBlockedByNoSeason) return;
      savingRef.current = true;
      setSaving(true);
      try {
        if (type === 'irrigation') {
          const irrigationResult =
            pendingIrrigationRef.current ??
            (await saveLog({
              type: 'irrigation',
              data: { ...irrigationDraft },
              farm,
              dateStr,
              preferredAreaUnit,
            }));
          pendingIrrigationRef.current = irrigationResult;
          if (includeFertilizers) {
            try {
              await saveLog({
                type: 'fertigation',
                data: { ...fertigationDraft },
                farm,
                dateStr,
                preferredAreaUnit,
                linkedIrrigationRecordId: irrigationResult.recordId,
              });
            } catch (error) {
              // Don't leave a half-saved pair behind: undo the irrigation so a
              // retry can't create duplicates.
              try {
                await deleteIrrigation.mutateAsync({
                  id: irrigationResult.recordId,
                  clientUuid: irrigationResult.clientUuid,
                  farmId: irrigationResult.farmId,
                });
                pendingIrrigationRef.current = null;
              } catch {
                // Delete threw on an offline-queued path that usually commits on
                // replay, so the irrigation is likely already gone. Drop the ref
                // so a retry rebuilds rather than linking the rider to a deleted
                // record (FK failure/orphan) — a deletable duplicate beats a
                // dangling link. ponytail: fully-correct fix is idempotent
                // re-save via original client_uuid; needs save-path plumbing.
                pendingIrrigationRef.current = null;
              }
              throw error;
            }
            captureSaved('fertigation', irrigationResult.farmId);
          }
          pendingIrrigationRef.current = null;
          captureSaved('irrigation', irrigationResult.farmId);
          guidedTourEmit('guidedTour.logCreated', {
            farmId: irrigationResult.farmId,
            recordType: 'irrigation',
          });
        } else if (type === 'spray') {
          const result = await saveLog({
            type: 'spray',
            data: finalizeSprayFormData(sprayPayload ?? sprayDraft, isGrapeFarm),
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('spray', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'spray' });
        } else if (type === 'expense') {
          const result = await saveLog({
            type: 'expense',
            data: { ...expenseDraft },
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('expense', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'expense' });
        } else {
          const result = await saveLog({
            type: 'harvest',
            data: { ...harvestDraft },
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('harvest', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'harvest' });
        }
        triggerHapticSuccess();
        onClose();
      } catch (error) {
        Alert.alert(
          t('common.error'),
          error instanceof Error ? error.message : t('common.errors.failedToSaveLogs'),
        );
      } finally {
        setSaving(false);
        savingRef.current = false;
      }
    },
    [
      type,
      farm,
      isBlockedByNoSeason,
      saveLog,
      deleteIrrigation,
      irrigationDraft,
      includeFertilizers,
      fertigationDraft,
      sprayDraft,
      expenseDraft,
      harvestDraft,
      isGrapeFarm,
      dateStr,
      preferredAreaUnit,
      captureSaved,
      onClose,
      t,
    ],
  );

  const handleSave = useCallback(() => {
    if (!isValid || savingRef.current) return;
    if (type === 'spray') {
      // Same harvest-safety gate as EntryForm: a catalog mix whose PHI window
      // crosses the season's target harvest needs an explicit double-confirm.
      if (
        isGrapeFarm &&
        sprayDraft.catalogMixId &&
        sprayDraft.safeHarvestDate &&
        sprayDraft.governingPhiDays != null &&
        isPhiConflict({
          safeHarvestDate: sprayDraft.safeHarvestDate,
          targetHarvestDate: activeSeason?.target_harvest_date ?? null,
        })
      ) {
        Alert.alert(
          t('entryForm.phiErrors.conflictTitle'),
          t('entryForm.phiErrors.conflictBody', {
            safeDate: sprayDraft.safeHarvestDate,
            component: sprayDraft.phiBlockingComponent ?? 'a component',
            targetDate: activeSeason?.target_harvest_date ?? '-',
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('entryForm.phiErrors.overrideAction', { defaultValue: 'Add anyway' }),
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  t('entryForm.phiErrors.conflictTitle'),
                  t('entryForm.phiErrors.overrideConfirmBody', {
                    defaultValue:
                      'Are you sure? This spray violates harvest safety guidance and will be marked as an override.',
                  }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('common.confirm', { defaultValue: 'Confirm' }),
                      style: 'destructive',
                      onPress: () => void performSave({ ...sprayDraft, phiOverride: true }),
                    },
                  ],
                );
              },
            },
          ],
        );
        return;
      }
      if (
        isGrapeFarm &&
        sprayDraft.phiStatus === 'unknown' &&
        (!sprayDraft.catalogMixId ||
          sprayDraft.safeHarvestDate == null ||
          sprayDraft.governingPhiDays == null)
      ) {
        Alert.alert(
          t('entryForm.phiErrors.computeFailedTitle'),
          t('entryForm.phiErrors.computeFailedBody'),
        );
        return;
      }
    }
    void performSave();
  }, [isValid, type, isGrapeFarm, sprayDraft, activeSeason?.target_harvest_date, performSave, t]);

  const goStartSeason = useCallback(() => {
    if (farm?.id == null) return;
    onClose();
    router.push(createStartSeasonHref(farm.id));
  }, [farm?.id, onClose, router]);

  const logType = type ? getLogType(type) : null;
  const saveDisabled = !isValid || saving || isBlockedByNoSeason;
  // Spray and irrigation can grow into multi-section workspaces (catalog,
  // product rows, PHI, or linked fertigation). Give them a full-screen
  // detent from the start; harvest and expense stay content-sized quick tasks.
  const usesFullHeight = type === 'spray' || type === 'irrigation';

  return (
    <BottomSheet
      key={type ?? 'closed'}
      index={type === null ? -1 : 0}
      snapPoints={usesFullHeight ? ['100%'] : undefined}
      enableDynamicSizing={!usesFullHeight}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.colorScheme.background }}
    >
      {/* Long operational forms use the full-height detent above; short forms
          continue to hug their content. The scroll view owns keyboard-safe
          overflow in both presentations. */}
      <BottomSheetScrollView
        style={usesFullHeight ? { flex: 1 } : undefined}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          // Small gap below the native drag handle; SheetHeader adds its own
          // top padding for the rest of the breathing room.
          paddingTop: spacing[2],
          paddingBottom: spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* One shared header contract for every activity type. */}
        <SheetHeader
          title={logType ? t('quickLog.title', { type: t(logType.labelKey) }) : ''}
          subtitle={farm ? t('quickLog.loggingTo', { farm: farm.name }) : undefined}
          leading={
            logType ? (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(logType.color, 0.14),
                }}
              >
                <Symbol
                  name={resolveSymbolIconName(logType.icon)}
                  size={20}
                  color={logType.color}
                />
              </View>
            ) : null
          }
        />

        {/* Date — its own row, defaults to today. */}
        <View style={{ marginTop: spacing[4], marginBottom: spacing[5] }}>
          <DateField
            value={selectedDate}
            onChange={setSelectedDate}
            maximumDate={new Date()}
            label={t('activityEdit.dateLabel', { defaultValue: 'Date' })}
            testID="quick-log-date-field"
          />
        </View>

        {isBlockedByNoSeason ? (
          <View style={{ marginBottom: spacing[4] }}>
            <NoActiveSeasonBanner onStartSeason={goStartSeason} />
          </View>
        ) : null}

        {type === 'irrigation' && (
          <>
            {/* No farmArea: the farm is fixed by the dashboard, so the area
                chip is noise here — only the Est. Water echo earns its spot. */}
            <IrrigationForm
              data={irrigationDraft}
              onChange={setIrrigationDraft}
              systemDischarge={farm?.system_discharge ?? undefined}
              showHeader={false}
            />
            {/* Fertigation rider — a switch, per design: irrigation and its
                  fertilizers are one field visit, saved as linked records. */}
            <View
              style={{
                marginTop: spacing[4],
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius.xl,
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setIncludeFertilizers((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: includeFertilizers }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing[4],
                  gap: spacing[3],
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: m3.colorScheme.onSurface }}>
                    {t('irrigationForm.addFertilizers.title')}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('irrigationForm.addFertilizers.subtitle')}
                  </Text>
                </View>
                <Switch
                  value={includeFertilizers}
                  onValueChange={setIncludeFertilizers}
                  trackColor={{
                    false: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.24),
                    true: m3.colorScheme.primary,
                  }}
                />
              </Pressable>
              {includeFertilizers && (
                <View
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingBottom: spacing[4],
                    paddingTop: spacing[4],
                    borderTopWidth: 1,
                    borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                  }}
                >
                  <FertigationForm
                    data={fertigationDraft}
                    onChange={setFertigationDraft}
                    quickAddItems={fertigationSources.quickAddItems}
                    historyItems={fertigationSources.historyItems}
                    planItems={fertigationSources.planItems}
                    catalogProducts={fertigationSources.catalogProducts}
                    areaAcres={farmAreaAcres}
                    compact
                  />
                </View>
              )}
            </View>
          </>
        )}

        {type === 'spray' && (
          <SprayForm
            data={sprayDraft}
            onChange={setSprayDraft}
            quickAddItems={spraySources.quickAddItems}
            showQuickAddSection={false}
            catalogMixes={catalogMixes}
            historyItems={spraySources.historyItems}
            planItems={spraySources.planItems}
            areaAcres={farmAreaAcres}
            compact
          />
        )}

        {type === 'expense' && (
          <ExpenseForm data={expenseDraft} onChange={setExpenseDraft} compact />
        )}

        {type === 'harvest' && (
          <HarvestForm data={harvestDraft} onChange={setHarvestDraft} compact />
        )}
      </BottomSheetScrollView>

      {/* Fixed action footer: the form scrolls independently while its primary
          action remains reachable above the platform safe area. */}
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: Math.max(spacing[3], insets.bottom + spacing[2]),
          backgroundColor: m3.colorScheme.background,
          borderTopWidth: 1,
          borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
        }}
      >
        <Pressable
          disabled={saveDisabled}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled }}
          accessibilityLabel={
            logType ? t('quickLog.saveType', { type: t(logType.labelKey) }) : undefined
          }
          style={{
            paddingVertical: 15,
            borderRadius: borderRadius.xl,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: !saveDisabled ? m3.colorScheme.primary : m3.surface.s50,
          }}
        >
          {saving ? (
            <Spinner size="small" color={m3.colorScheme.onSurfaceVariant} />
          ) : (
            <AppIcon
              name="checkmark-circle"
              size={20}
              color={
                !saveDisabled
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)
              }
            />
          )}
          <Text
            style={{
              fontWeight: '700',
              color: !saveDisabled
                ? m3.colorScheme.onPrimary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
            }}
          >
            {saving
              ? t('common.saving')
              : logType
                ? t('quickLog.saveType', { type: t(logType.labelKey) })
                : ''}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
