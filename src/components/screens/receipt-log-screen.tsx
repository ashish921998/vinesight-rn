/**
 * Receipt Add-Log screen.
 *
 * Rethink of the activity-logging UX as a "today's activities" receipt:
 * the screen is a list of what you logged, tapping an activity opens a
 * content-sized sheet with just that form, and each Save persists immediately
 * (per-entry, via {@link useSaveSingleLog}) and drops a row into the list.
 * No drafts, no "Save N logs", no stacked scroll — one short form at a time.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol } from '@/components/ui/symbol';
import { LOG_TYPES, type LogType, type LogTypeId } from '@/constants/calculator-models';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { toSupabaseDateString, type DailyNoteRecord } from '@/types/database';
import type { Farm } from '@/types';
import { triggerHapticSuccess } from '@/utils/haptics';
import { convertAreaToAcres, resolveAreaUnitPreference } from '@/utils/preferences';
import { formatDate } from '@/i18n/format';
import {
  IrrigationForm,
  SprayForm,
  HarvestForm,
  ExpenseForm,
  FertigationForm,
  NoteForm,
  validateIrrigationForm,
  validateSprayForm,
  validateHarvestForm,
  validateExpenseForm,
  validateFertigationForm,
  validateNoteForm,
  createEmptySprayFormData,
  createEmptyHarvestFormData,
  createEmptyExpenseFormData,
  createEmptyFertigationFormData,
  createEmptyNoteFormData,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
  type NoteFormData,
} from '@/components/forms';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFarm,
  useProfile,
  useDeleteIrrigationRecord,
  useDeleteSprayRecord,
  useDeleteHarvestRecord,
  useDeleteExpenseRecord,
  useDeleteFertigationRecord,
  useDeleteDailyNote,
  useUpsertDailyNote,
  useUpdateFarmWaterLevel,
  queryKeys,
} from '@/hooks';
import { useSaveSingleLog } from '@/features/entry-log-session';
import type { SaveSingleLogResult } from '@/features/entry-log-session/use-save-single-log';
import { useAuthStore } from '@/stores';
import { telemetry } from '@/services/telemetry';
import { guidedTourEmit } from '@/features/guided-tour';
import {
  buildDelegatedLogPayload,
  createDelegatedLog,
  deleteDelegatedLog,
  updateDelegatedLog,
  type DelegatedContext,
  type DelegatedLogFormInput,
  type DelegatedLogType,
} from '@/services/delegated-logs';

interface ReceiptLogScreenProps {
  farmId?: number | null;
  onClose: () => void;
  /**
   * When set, the screen runs in "delegated" mode: the farm is locked to
   * `delegatedContext.farm`, the `expense` chip is hidden, the header shows
   * `clientName · farm.name`, and saves route through the
   * `create_delegated_log` / `delete_delegated_log` RPCs instead of the
   * farmer mutation hooks. Used by the professional `/professional/log/add`
   * route so consultants get the same UI farmers see when they tap "Add log"
   * from a farm's details page (`/log-entry/quick`).
   */
  delegatedContext?: DelegatedContext;
}

type AnyLogData =
  | IrrigationFormData
  | SprayFormData
  | HarvestFormData
  | ExpenseFormData
  | FertigationFormData
  | NoteFormData;

interface SavedEntry {
  key: string;
  type: LogTypeId;
  recordId: number | null;
  farmId: number;
  summary: string;
  /** The date this entry was saved on. Stored here so handleRemove uses the correct date even if the picker is changed afterwards. */
  savedDateStr: string;
  /** Amount this irrigation added to the tank level. Subtracted from the live level on remove (composes across multiple irrigations). */
  waterDelta?: number;
  /** Snapshot of the daily note that existed before this save. Used to restore the original text on remove instead of deleting the record. */
  previousDailyNote?: DailyNoteRecord | null;
}

let entryKeySeq = 0;
const nextKey = () => `entry_${++entryKeySeq}`;

function emptyDataFor(type: LogTypeId): AnyLogData {
  switch (type) {
    case 'irrigation':
      return { duration: undefined } as IrrigationFormData;
    case 'spray':
      return createEmptySprayFormData();
    case 'harvest':
      return createEmptyHarvestFormData();
    case 'expense':
      return createEmptyExpenseFormData();
    case 'fertigation':
      return createEmptyFertigationFormData();
    case 'note':
      return createEmptyNoteFormData();
  }
}

function isDataValid(type: LogTypeId, data: AnyLogData): boolean {
  switch (type) {
    case 'irrigation':
      return validateIrrigationForm(data as IrrigationFormData);
    case 'spray':
      return validateSprayForm(data as SprayFormData);
    case 'harvest':
      return validateHarvestForm(data as HarvestFormData);
    case 'expense':
      return validateExpenseForm(data as ExpenseFormData);
    case 'fertigation':
      return validateFertigationForm(data as FertigationFormData);
    case 'note':
      return validateNoteForm(data as NoteFormData);
  }
}

function describeEntry(type: LogTypeId, data: AnyLogData): string {
  switch (type) {
    case 'irrigation':
      return `${(data as IrrigationFormData).duration ?? 0} hr`;
    case 'spray': {
      const d = data as SprayFormData;
      const mix = d.catalogMixName?.trim();
      if (mix) return `${mix} · ${d.waterVolume ?? 0}L`;
      const n = d.chemicals.filter((c) => c.name.trim()).length;
      return `${d.waterVolume ?? 0}L · ${n} chemical${n === 1 ? '' : 's'}`;
    }
    case 'harvest': {
      const d = data as HarvestFormData;
      return `${d.quantity ?? 0} kg · ${d.grade || '—'}`;
    }
    case 'expense': {
      const d = data as ExpenseFormData;
      return `₹${d.cost ?? 0} · ${d.type || '—'}`;
    }
    case 'fertigation': {
      const d = data as FertigationFormData;
      const n = d.fertilizers.filter((f) => f.name.trim()).length;
      return `${n} fertilizer${n === 1 ? '' : 's'}`;
    }
    case 'note':
      return (data as NoteFormData).notes?.trim() || '';
  }
}

export function ReceiptLogScreen({ farmId, onClose, delegatedContext }: ReceiptLogScreenProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Delegated mode: consultant logs on behalf of a farmer client. The farm is
  // taken from the context (no fetch); `expense` is hidden from the picker;
  // saves route through the `create_delegated_log` RPC. Identical UX to the
  // farmer's farm-details-page add log (`/log-entry/quick`).
  const isDelegatedMode = delegatedContext !== undefined;

  const liveFarmQuery = useFarm(isDelegatedMode ? undefined : (farmId ?? undefined));
  const farm = isDelegatedMode ? delegatedContext.farm : liveFarmQuery.data;

  const { data: profile } = useProfile({ enabled: false });
  const user = useAuthStore((s) => s.user);
  const preferredAreaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );
  const farmAreaAcres =
    typeof farm?.area === 'number' && Number.isFinite(farm.area) && farm.area > 0
      ? convertAreaToAcres(farm.area, preferredAreaUnit)
      : null;

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateStr = useMemo(() => toSupabaseDateString(selectedDate), [selectedDate]);

  const queryClient = useQueryClient();
  const saveLog = useSaveSingleLog();
  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();
  const deleteDailyNote = useDeleteDailyNote();
  const upsertDailyNote = useUpsertDailyNote();
  const updateWaterLevel = useUpdateFarmWaterLevel();

  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [activeType, setActiveType] = useState<LogTypeId | null>(null);
  const [draft, setDraft] = useState<AnyLogData>(() => emptyDataFor('irrigation'));
  const [saving, setSaving] = useState(false);
  // Synchronous re-entrancy guard for handleSave (the `saving` state flips a tick later).
  const savingRef = useRef(false);

  // Android Modals don't resize for the soft keyboard, so the bottom-anchored
  // entry sheet would sit behind it. Track the keyboard height and lift the
  // sheet by that amount. (iOS uses KeyboardAvoidingView padding instead.)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const openSheet = useCallback(
    (type: LogTypeId) => {
      setActiveType(type);
      // A day has a single daily-note row (keyed by farm+date). Re-opening "note"
      // edits the existing entry rather than starting a second one that the shared
      // upsert would silently overwrite on save.
      if (type === 'note') {
        const existingNote = entries.find((e) => e.type === 'note');
        setDraft(existingNote ? { notes: existingNote.summary } : emptyDataFor('note'));
      } else {
        setDraft(emptyDataFor(type));
      }
    },
    [entries],
  );

  // Every activity type now opens the in-screen sheet — including spray and
  // fertigation, which previously handed off to the full EntryForm composer.
  // FOLLOW-UP (PHI): catalog-mix sprays need the harvest-safety check
  // (usePhiComputation + the "unsafe until DATE — add anyway?" warning on Save)
  // wired into the sheet before catalog mixes are offered here. Free-text
  // sprays carry no PHI and save cleanly.
  const handlePickType = openSheet;

  const closeSheet = useCallback(() => {
    setActiveType(null);
  }, []);

  const draftValid = activeType ? isDataValid(activeType, draft) : false;

  const handleSave = useCallback(async () => {
    // Guard with a ref, not the `saving` state: state updates are async, so two
    // taps in the same render frame would both pass a `saving` check and submit
    // duplicate records (and race the same water snapshot).
    if (!activeType || !farm || !draftValid || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const savedType = activeType;
    try {
      let result: SaveSingleLogResult;
      if (isDelegatedMode && delegatedContext && savedType !== 'expense') {
        // Delegated (consultant-on-behalf-of farmer) save. The expense chip
        // is hidden in delegated mode; this guard is defensive in case a save
        // somehow captures an expense type.
        const delegatedType = savedType as DelegatedLogType;
        // A single farm+date carries exactly one daily note. If the consultant
        // already logged one today, re-saving the note updates the same row
        // instead of failing the unique-constraint on `daily_notes`.
        const existingNote =
          savedType === 'note' ? entries.find((e) => e.type === 'note') : undefined;
        const payload = buildDelegatedLogPayload(
          {
            type: delegatedType,
            data: draft as DelegatedLogFormInput['data'],
          } as DelegatedLogFormInput,
          { area: farm.area ?? 0 },
        );
        let recordId: number | null;
        if (existingNote?.recordId != null) {
          const noteText = (draft as NoteFormData).notes ?? '';
          await updateDelegatedLog('note', existingNote.recordId, noteText);
          recordId = existingNote.recordId;
        } else {
          const rpcResult = await createDelegatedLog({
            organizationId: delegatedContext.organizationId,
            clientUserId: delegatedContext.clientUserId,
            farmId: farm.id ?? 0,
            recordType: delegatedType,
            date: dateStr,
            payload,
          });
          // The RPC returns `to_jsonb(<table>.*)` — `id` is the new row's pk.
          const rawId = (rpcResult as { id?: unknown } | null | undefined)?.id;
          if (typeof rawId !== 'number') {
            // Without a numeric pk the entry can't be deleted later (the delete
            // path requires recordId != null), so treat a missing id as a hard
            // save failure rather than silently persisting an orphan row.
            throw new Error('Delegated log save returned no record id');
          }
          recordId = rawId;
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.professionalWorkspace.all });
        result = {
          type: savedType,
          recordId,
          farmId: farm.id ?? 0,
          previousDailyNote: undefined,
        };
      } else {
        result = await saveLog({
          type: savedType,
          data: draft,
          farm,
          dateStr,
          preferredAreaUnit,
        });
      }
      setEntries((prev) => {
        const newEntry: SavedEntry = {
          key: nextKey(),
          type: savedType,
          recordId: result.recordId,
          farmId: result.farmId,
          summary: describeEntry(savedType, draft),
          savedDateStr: dateStr,
          waterDelta: result.waterDelta,
          previousDailyNote: result.previousDailyNote,
        };
        // Notes are one-per-day (shared farm+date row). If a note row already
        // exists this session, replace it in place — keeping its original key and
        // pre-session snapshot — instead of appending a second row that the upsert
        // already silently merged into the same DB record.
        if (savedType === 'note') {
          const idx = prev.findIndex((e) => e.type === 'note');
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = {
              ...newEntry,
              key: prev[idx].key,
              previousDailyNote: prev[idx].previousDailyNote,
            };
            return next;
          }
        }
        return [...prev, newEntry];
      });
      try {
        telemetry.capture('record_created', {
          record_type: savedType,
          created_from: 'manual',
          farm_id: result.farmId,
        });
        telemetry.capture('meaningful_action', {
          action_type: 'record_created',
          feature_name: savedType,
        });
      } catch {
        // telemetry is best-effort
      }
      guidedTourEmit('guidedTour.logCreated', {
        farmId: result.farmId,
        recordType: savedType,
      });
      triggerHapticSuccess();
      setActiveType(null);
    } catch (error) {
      Alert.alert(
        t('common.error', { defaultValue: 'Something went wrong' }),
        error instanceof Error
          ? error.message
          : t('common.errors.failedToSaveLogs', { defaultValue: 'Could not save. Please retry.' }),
      );
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [
    activeType,
    farm,
    draftValid,
    saveLog,
    draft,
    dateStr,
    preferredAreaUnit,
    t,
    isDelegatedMode,
    delegatedContext,
    entries,
    queryClient,
  ]);

  const handleRemove = useCallback(
    async (entry: SavedEntry) => {
      // Optimistically drop the row; the record is already persisted, so removing
      // means deleting it.
      let originalIndex = -1;
      setEntries((prev) => {
        originalIndex = prev.findIndex((e) => e.key === entry.key);
        return prev.filter((e) => e.key !== entry.key);
      });
      try {
        // Delegated path: single-call RPC delete, no water-level undo, no
        // per-table split. Mirrors the create path's RPC simplicity.
        if (isDelegatedMode && entry.recordId != null && entry.type !== 'expense') {
          await deleteDelegatedLog(entry.type as DelegatedLogType, entry.recordId);
          await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.professionalWorkspace.all });
          return;
        }
        if (entry.recordId == null) {
          if (entry.type === 'note') {
            if (entry.previousDailyNote) {
              await upsertDailyNote.mutateAsync({
                farm_id: entry.farmId,
                date: entry.savedDateStr,
                notes: entry.previousDailyNote.notes ?? null,
              });
            } else {
              // No previous note — delete the newly created record by farm+date
              // (id is 0 because notes' recordId is always null here; the mutation
              // handles this by falling back to the farm_id+date key).
              await deleteDailyNote.mutateAsync({
                id: 0,
                farmId: entry.farmId,
                date: entry.savedDateStr,
              });
            }
          }
          return;
        }
        const id = entry.recordId;
        switch (entry.type) {
          case 'irrigation':
            await deleteIrrigation.mutateAsync({ id, farmId: entry.farmId });
            if (entry.waterDelta != null && entry.waterDelta !== 0) {
              // Subtract this irrigation's contribution from the *current* tank
              // level (read fresh from cache — each save writes it via setQueryData)
              // so removing an earlier irrigation doesn't wipe out later ones.
              const liveFarm = queryClient.getQueryData<Farm>(queryKeys.farms.detail(entry.farmId));
              const current = liveFarm?.remaining_water ?? 0;
              const capacity = liveFarm?.total_tank_capacity ?? undefined;
              let target = current - entry.waterDelta;
              if (target < 0) target = 0;
              if (capacity != null && target > capacity) target = capacity;
              await updateWaterLevel.mutateAsync({
                farmId: entry.farmId,
                remainingWater: target,
              });
            }
            break;
          case 'spray':
            await deleteSpray.mutateAsync({ id, farmId: entry.farmId });
            break;
          case 'harvest':
            await deleteHarvest.mutateAsync({ id, farmId: entry.farmId });
            break;
          case 'expense':
            await deleteExpense.mutateAsync({ id, farmId: entry.farmId });
            break;
          case 'fertigation':
            await deleteFertigation.mutateAsync({ id, farmId: entry.farmId });
            break;
          case 'note':
            if (entry.previousDailyNote) {
              await upsertDailyNote.mutateAsync({
                farm_id: entry.farmId,
                date: entry.savedDateStr,
                notes: entry.previousDailyNote.notes ?? null,
              });
            } else {
              await deleteDailyNote.mutateAsync({
                id,
                farmId: entry.farmId,
                date: entry.savedDateStr,
              });
            }
            break;
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      } catch {
        // Restore the row at its original position so the list order is unchanged.
        setEntries((prev) => {
          if (prev.some((e) => e.key === entry.key)) return prev;
          const idx =
            originalIndex >= 0 && originalIndex <= prev.length ? originalIndex : prev.length;
          return [...prev.slice(0, idx), entry, ...prev.slice(idx)];
        });
        Alert.alert(
          t('common.error', { defaultValue: 'Something went wrong' }),
          t('common.errors.failedToDelete', { defaultValue: 'Could not remove that entry.' }),
        );
      }
    },
    [
      queryClient,
      deleteIrrigation,
      deleteSpray,
      deleteHarvest,
      deleteExpense,
      deleteFertigation,
      deleteDailyNote,
      upsertDailyNote,
      updateWaterLevel,
      t,
      isDelegatedMode,
    ],
  );

  const activeLogType = activeType ? LOG_TYPES.find((lt) => lt.id === activeType) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[3],
          backgroundColor: m3.surface.s100,
          borderBottomWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.xl, fontWeight: '700', color: m3.colorScheme.onSurface }}
            numberOfLines={1}
          >
            {isDelegatedMode && delegatedContext
              ? `${delegatedContext.clientName} · ${farm?.name ?? t('receiptLog.title', { defaultValue: 'Add activity' })}`
              : (farm?.name ?? t('receiptLog.title', { defaultValue: 'Add activity' }))}
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('receiptLog.selectDate', { defaultValue: 'Select date' })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}
          >
            <AppIcon
              name="calendar"
              size={13}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)}
            />
            <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
              {formatDate(selectedDate)}
            </Text>
            <AppIcon
              name="chevron-down"
              size={13}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
          <AppIcon
            name="close-circle"
            size={26}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          />
        </Pressable>
      </View>

      {/* iOS: spinner picker inside a bottom-sheet modal with a Done button
          (matches the rest of the app). Android: native date dialog. */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={() => setShowDatePicker(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: m3.colorScheme.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                padding: spacing[4],
                paddingBottom: spacing[6] + insets.bottom,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[2],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: '700',
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t('receiptLog.selectDate', { defaultValue: 'Select date' })}
                </Text>
                <Pressable onPress={() => setShowDatePicker(false)} hitSlop={8}>
                  <AppIcon
                    name="close-circle"
                    size={24}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                maximumDate={new Date()}
                display="spinner"
                textColor={m3.colorScheme.onSurface}
                onChange={(_event, date) => {
                  if (date) setSelectedDate(date);
                }}
                style={{ height: 200 }}
              />
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={{
                  marginTop: spacing[2],
                  paddingVertical: spacing[3],
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: m3.colorScheme.primary,
                }}
              >
                <Text style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                  {t('entryForm.done')}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={new Date()}
          display="default"
          onChange={(_event, date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Receipt list */}
        {entries.length > 0 && (
          <View style={{ marginBottom: spacing[5] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: m3.colorScheme.onSurfaceVariant,
                marginBottom: spacing[2],
              }}
            >
              {t('receiptLog.loggedToday', { defaultValue: 'Logged today' })} · {entries.length}
            </Text>
            <View style={{ gap: spacing[2] }}>
              {entries.map((entry) => {
                const lt = LOG_TYPES.find((l) => l.id === entry.type);
                return (
                  <View
                    key={entry.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      backgroundColor: m3.surface.s100,
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1),
                      borderRadius: borderRadius.lg,
                      padding: spacing[3],
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: lt ? `${lt.color}1f` : m3.surface.s50,
                      }}
                    >
                      <Symbol
                        name={resolveSymbolIconName(
                          ICON_REGISTRY[entry.type as keyof typeof ICON_REGISTRY] ??
                            ICON_REGISTRY.note,
                        )}
                        size={16}
                        color={lt?.color ?? m3.colorScheme.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: '600',
                          color: m3.colorScheme.onSurface,
                        }}
                      >
                        {lt ? t(lt.labelKey) : entry.type}
                      </Text>
                      {entry.summary ? (
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                        >
                          {entry.summary}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleRemove(entry)}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <AppIcon
                        name="close"
                        size={18}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Activity picker */}
        <Text
          style={{
            fontSize: fontSize.xs,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: spacing[3],
          }}
        >
          {entries.length > 0
            ? t('receiptLog.addAnother', { defaultValue: 'Add another' })
            : t('receiptLog.whatDidYouDo', { defaultValue: 'What did you do?' })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {LOG_TYPES.filter((lt) => !(isDelegatedMode && lt.id === 'expense')).map(
            (lt: LogType) => (
              <Pressable
                key={lt.id}
                onPress={() => handlePickType(lt.id as LogTypeId)}
                accessibilityRole="button"
                accessibilityLabel={t(lt.labelKey)}
                style={{
                  width: '31.5%',
                  minHeight: 84,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                  borderRadius: borderRadius.lg,
                  paddingVertical: spacing[3],
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${lt.color}1f`,
                  }}
                >
                  <Symbol name={resolveSymbolIconName(lt.icon)} size={20} color={lt.color} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t(lt.labelKey)}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </ScrollView>

      {/* Footer — only shown when no sheet is open */}
      {activeType === null && (
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: Math.max(spacing[4], insets.bottom),
            backgroundColor: m3.surface.s100,
            borderTopWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              paddingVertical: 14,
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              backgroundColor: entries.length > 0 ? m3.colorScheme.primary : m3.surface.s50,
              borderWidth: entries.length > 0 ? 0 : 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color:
                  entries.length > 0 ? m3.colorScheme.onPrimary : m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('receiptLog.done', { defaultValue: 'Done' })}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Entry sheet */}
      <Modal
        visible={activeType !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeSheet}
            style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.45) }}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: m3.colorScheme.background,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                maxHeight: screenHeight - insets.top,
                marginBottom: keyboardHeight,
              }}
            >
              {/* Sheet header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingTop: spacing[4],
                  paddingBottom: spacing[2],
                }}
              >
                {activeLogType ? (
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${activeLogType.color}1f`,
                    }}
                  >
                    <Symbol
                      name={resolveSymbolIconName(activeLogType.icon)}
                      size={18}
                      color={activeLogType.color}
                    />
                  </View>
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    fontSize: fontSize.lg,
                    fontWeight: '700',
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {activeLogType ? t(activeLogType.labelKey) : ''}
                </Text>
                <Pressable onPress={closeSheet} hitSlop={8} style={{ padding: 4 }}>
                  <AppIcon
                    name="close-circle"
                    size={24}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}
                keyboardShouldPersistTaps="handled"
              >
                {activeType === 'irrigation' && (
                  <IrrigationForm
                    data={draft as IrrigationFormData}
                    onChange={setDraft}
                    farmArea={farm?.area ?? undefined}
                    systemDischarge={farm?.system_discharge ?? undefined}
                    showHeader={false}
                  />
                )}
                {activeType === 'spray' && (
                  <SprayForm
                    data={draft as SprayFormData}
                    onChange={setDraft}
                    areaAcres={farmAreaAcres}
                    compact
                  />
                )}
                {activeType === 'harvest' && (
                  <HarvestForm data={draft as HarvestFormData} onChange={setDraft} compact />
                )}
                {activeType === 'expense' && (
                  <ExpenseForm data={draft as ExpenseFormData} onChange={setDraft} compact />
                )}
                {activeType === 'fertigation' && (
                  <FertigationForm
                    data={draft as FertigationFormData}
                    onChange={setDraft}
                    areaAcres={farmAreaAcres}
                    compact
                  />
                )}
                {activeType === 'note' && (
                  <NoteForm data={draft as NoteFormData} onChange={setDraft} />
                )}
              </ScrollView>

              {/* Sheet CTA — saves this entry and returns to the receipt list */}
              <View
                style={{
                  paddingHorizontal: spacing[4],
                  paddingTop: spacing[2],
                  paddingBottom: Math.max(spacing[4], insets.bottom),
                }}
              >
                <Pressable
                  disabled={!draftValid || saving}
                  onPress={handleSave}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !draftValid || saving }}
                  accessibilityLabel={
                    activeLogType
                      ? t('receiptLog.saveType', {
                          defaultValue: 'Save {{type}}',
                          type: t(activeLogType.labelKey),
                        })
                      : t('receiptLog.save', { defaultValue: 'Save' })
                  }
                  style={{
                    paddingVertical: 14,
                    borderRadius: borderRadius.xl,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor:
                      draftValid && !saving ? m3.colorScheme.primary : m3.surface.s50,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={m3.colorScheme.onSurfaceVariant} />
                  ) : (
                    <AppIcon
                      name="checkmark-circle"
                      size={20}
                      color={
                        draftValid
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)
                      }
                    />
                  )}
                  <Text
                    style={{
                      fontWeight: '700',
                      color:
                        draftValid && !saving
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
                    }}
                  >
                    {saving
                      ? t('common.saving', { defaultValue: 'Saving…' })
                      : activeLogType
                        ? t('receiptLog.saveType', {
                            defaultValue: 'Save {{type}}',
                            type: t(activeLogType.labelKey),
                          })
                        : t('receiptLog.save', { defaultValue: 'Save' })}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
