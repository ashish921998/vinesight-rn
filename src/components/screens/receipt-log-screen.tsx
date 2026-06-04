/**
 * Receipt Add-Log screen.
 *
 * Rethink of the activity-logging UX as a "today's activities" receipt:
 * the screen is a list of what you logged, tapping an activity opens a
 * content-sized sheet with just that form, and each Save persists immediately
 * (per-entry, via {@link useSaveSingleLog}) and drops a row into the list.
 * No drafts, no "Save N logs", no stacked scroll — one short form at a time.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { triggerHapticSuccess } from '@/utils/haptics';
import { resolveAreaUnitPreference } from '@/utils/preferences';
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
import { useAuthStore } from '@/stores';
import { telemetry } from '@/services/telemetry';
import { guidedTourEmit } from '@/features/guided-tour';

interface ReceiptLogScreenProps {
  farmId?: number | null;
  onClose: () => void;
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
  /** Pre-save `remaining_water` for irrigations that updated the tank level. Used to undo the level change on remove. */
  waterLevelBefore?: number;
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

export function ReceiptLogScreen({ farmId, onClose }: ReceiptLogScreenProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const { data: farm } = useFarm(farmId ?? undefined);
  const { data: profile } = useProfile({ enabled: false });
  const user = useAuthStore((s) => s.user);
  const preferredAreaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );

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

  const openSheet = useCallback((type: LogTypeId) => {
    setActiveType(type);
    setDraft(emptyDataFor(type));
  }, []);

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
    if (!activeType || !farm || !draftValid || saving) return;
    setSaving(true);
    try {
      const result = await saveLog({
        type: activeType,
        data: draft,
        farm,
        dateStr,
        preferredAreaUnit,
      });
      setEntries((prev) => [
        ...prev,
        {
          key: nextKey(),
          type: activeType,
          recordId: result.recordId,
          farmId: result.farmId,
          summary: describeEntry(activeType, draft),
          savedDateStr: dateStr,
          waterLevelBefore: result.waterLevelBefore,
          previousDailyNote: result.previousDailyNote,
        },
      ]);
      try {
        telemetry.capture('record_created', {
          record_type: activeType,
          created_from: 'manual',
          farm_id: result.farmId,
        });
        telemetry.capture('meaningful_action', {
          action_type: 'record_created',
          feature_name: activeType,
        });
      } catch {
        // telemetry is best-effort
      }
      guidedTourEmit('guidedTour.logCreated', {
        farmId: result.farmId,
        recordType: activeType,
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
    }
  }, [activeType, farm, draftValid, saving, saveLog, draft, dateStr, preferredAreaUnit, t]);

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
            if (entry.waterLevelBefore != null) {
              await updateWaterLevel.mutateAsync({
                farmId: entry.farmId,
                remainingWater: entry.waterLevelBefore,
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
          >
            {farm?.name ?? t('receiptLog.title', { defaultValue: 'Add activity' })}
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            hitSlop={6}
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

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
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
          {LOG_TYPES.map((lt: LogType) => (
            <Pressable
              key={lt.id}
              onPress={() => handlePickType(lt.id as LogTypeId)}
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
          ))}
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
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                minHeight: screenHeight * 0.6,
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
                style={{ flex: 1 }}
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
                  <SprayForm data={draft as SprayFormData} onChange={setDraft} compact />
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
