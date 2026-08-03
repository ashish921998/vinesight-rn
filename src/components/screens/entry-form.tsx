/**
 * Add Entry Modal
 * Unified modal for creating farm logs and tasks with tabbed layout.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  type TextInputProps,
  Keyboard,
  Platform,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { BottomSheet, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { Spinner } from '@/components/ui/spinner';
import { LinearGradient as _LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { useM3 } from '@/styles/use-theme';
import { DateField } from '@/components/ui';
import { colorWithOpacity } from '@/utils/color';
import { toast } from '@/components/ui/toast';
import { getFarmErrorMeta, shouldCaptureFarmErrorInSentry } from '@/utils/farm-error-utils';
import {
  androidTextPadding,
  borderRadius,
  componentRadius,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '@/styles/theme';
import { LogTypeSelector } from '@/components/screens/entry-form/LogTypeSelector';
import { RepeatLastLog } from '@/components/screens/entry-form/RepeatLastLog';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { createStartSeasonHref } from '@/utils/add-log-navigation';
import { calculateKeyboardScrollOffset, resolveKeyboardTop } from '@/utils/keyboard-scroll';
import { useRouter } from 'expo-router';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import {
  irrigationRecordToFormData,
  sprayRecordToFormData,
  harvestRecordToFormData,
  expenseRecordToFormData,
  fertigationRecordToFormData,
  dailyNoteRecordToFormData,
} from '@/utils/record-to-form';
import {
  PendingLogs,
  type PendingLog,
  type PendingLogFailure,
} from '@/components/screens/entry-form/PendingLogs';
import { Tabs, type EntryTab } from '@/components/screens/entry-form/Tabs';
import { LogForm } from '@/components/screens/entry-form/LogForm';
import {
  QuickLogSheet,
  isQuickLogType,
  type QuickLogDraftPayload,
  type QuickLogInitialDraft,
  type QuickLogType,
} from '@/components/sheets/quick-log-sheet';
import {
  buildExpensePrefill,
  buildFertigationPlanPrefill,
  buildFertigationVoicePrefill,
  buildQuickLogInitialDraft,
} from '@/components/screens/entry-form/log-prefills';
import { ALL_FARMS_ID } from '@/constants/farm-selection';
import { guidedTourEmit, useGuidedTourStore } from '@/features/guided-tour';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';

import {
  IrrigationForm as _IrrigationForm,
  SprayForm as _SprayForm,
  HarvestForm as _HarvestForm,
  ExpenseForm as _ExpenseForm,
  FertigationForm as _FertigationForm,
  validateExpenseForm,
  validateFertigationForm,
  validateNoteForm,
  createEmptyExpenseFormData,
  createEmptyFertigationFormData,
  createEmptyNoteFormData,
  finalizeSprayFormData,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
  type NoteFormData,
} from '@/components/forms';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useDeleteIrrigationRecord,
  useDeleteSprayRecord,
  useDeleteHarvestRecord,
  useDeleteExpenseRecord,
  useDeleteFertigationRecord,
  useFarms,
  useFarmAreaAcres,
  useUpsertDailyNote,
  useDeleteDailyNote,
  useFarmSeasonStatus,
  useChemicalMixSearch,
  useSprayInputSources,
  useFertigationInputSources,
  useIrrigationRecords,
  useSprayRecords,
  useHarvestRecords,
  useExpenseRecords,
  useFertigationRecords,
  useDailyNotes,
  queryKeys,
  isIOS,
  useResponsiveHeight,
} from '@/hooks';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import {
  TaskReminder,
  TaskType,
  TaskPriority,
  TaskTemplate,
  PlannedInputItem,
  TASK_TYPE_INFO,
  PRIORITY_INFO,
} from '@/types/task';
import { TASK_TEMPLATES } from '@/constants/task-templates';
import { TABLES, toSupabaseDateString } from '@/types/database';
import type { DailyNoteRecord, Farm } from '@/types';
import type { VoiceLogFormPrefill } from '@/types/voice-log';
import { telemetry } from '@/services/telemetry';
import { useNotificationStore, useAppModeStore } from '@/stores';
import { isGrapeCrop } from '@/utils/crop';
import {
  saveEntryLogSession,
  type EntryLogRollbackFailure,
  type EntryLogSessionAdapters,
  type EntryLogSubmissionFailure,
} from '@/features/entry-log-session';
import {
  ensureNotificationPermissions,
  scheduleTaskDueReminder,
  cancelNotification,
} from '@/services/notifications';
import {
  decodeTaskPlanFromDescription,
  encodeTaskPlanInDescription,
  stripTaskPlanFromDescription,
} from '@/utils/task-plan';
import { getDataAccess } from '@/data-access';

interface EntryFormProps {
  visible?: boolean;
  onClose: () => void;
  tabs?: EntryTab[];
  initialTab?: EntryTab;
  farm?: Farm;
  initialFarmId?: number | null;
  initialApplyToAllFarms?: boolean;
  lockFarmSelection?: boolean;
  initialLogType?: LogTypeId | null;
  initialLogPrefill?: {
    sprayChemicals?: PlannedInputItem[];
    fertigationItems?: PlannedInputItem[];
  } | null;
  sourceTaskId?: number | null;
  initialIrrigationDurationHours?: number | null;
  initialLogDate?: string | null;
  initialVoiceLogPrefill?: VoiceLogFormPrefill | null;
  entrySource?: 'manual' | 'voice_ai' | null;
  editingTask?: TaskReminder | null;
  onLogSaveSuccess?: () => void;
  onTaskSaveSuccess?: (farmId?: number | null) => void;
  presentation?: 'modal' | 'screen';
}

/** Sheet wins for quick types unless it's all-farms expense (sheet takes a single farm). */
function canOpenQuickLogSheet(
  type: LogTypeId,
  { allFarmsSelected }: { allFarmsSelected: boolean },
): type is QuickLogType {
  return isQuickLogType(type) && !(allFarmsSelected && type === 'expense');
}

const TASK_TYPES: TaskType[] = [
  'irrigation',
  'spray',
  'fertigation',
  'harvest',
  'soil_test',
  'petiole_test',
  'expense',
  'note',
];

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

function normalizePlannedInputs(items: PlannedInputItem[]): PlannedInputItem[] {
  const deduped = new Map<string, PlannedInputItem>();
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const unit = item.unit?.trim() || null;
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null;
    const key = `${name.toLowerCase()}::${(unit ?? '').toLowerCase()}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      name,
      unit,
      quantity,
      source: item.source ?? null,
    });
  }
  return Array.from(deduped.values());
}

function parseInitialLogDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, monthIndex, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function EntryForm({
  visible,
  onClose,
  tabs,
  initialTab,
  farm,
  initialFarmId,
  initialApplyToAllFarms,
  lockFarmSelection = false,
  initialLogType,
  initialLogPrefill,
  sourceTaskId,
  initialIrrigationDurationHours,
  initialLogDate,
  initialVoiceLogPrefill,
  entrySource = null,
  editingTask,
  onLogSaveSuccess,
  onTaskSaveSuccess,
  presentation = 'modal',
}: EntryFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const detailedMode = useAppModeStore((state) => state.detailedMode);

  const isVisible = visible ?? true;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { windowHeight } = useResponsiveHeight();
  const resolvedTabs = useMemo<EntryTab[]>(() => {
    if (!detailedMode) return ['log'];
    return tabs && tabs.length > 0 ? tabs : ['log', 'task'];
  }, [tabs, detailedMode]);
  const isScreenPresentation = presentation === 'screen';
  const defaultTab = resolvedTabs.includes(initialTab || 'log')
    ? initialTab || resolvedTabs[0]
    : resolvedTabs[0];
  const sourceTaskType: LogTypeId | null =
    sourceTaskId && (initialLogType === 'spray' || initialLogType === 'fertigation')
      ? initialLogType
      : null;
  const parsedInitialLogDate = useMemo(() => parseInitialLogDate(initialLogDate), [initialLogDate]);
  const [activeTab, setActiveTab] = useState<EntryTab>(defaultTab);

  const { data: farms } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(() => {
    if (initialApplyToAllFarms) return ALL_FARMS_ID;
    return farm?.id ?? initialFarmId ?? null;
  });
  const [showLogFarmPicker, setShowLogFarmPicker] = useState(false);
  const [showTaskFarmPicker, setShowTaskFarmPicker] = useState(false);

  const isAllFarmsSelected = selectedFarmId === ALL_FARMS_ID;
  // A caller can hand off a specific farm two ways: the resolved `farm` object
  // (farm-detail entry points) or just `initialFarmId` (deep links from a task,
  // a voice-log draft, etc. that only know the id). Either means the farm is
  // already a fact, not a choice — the picker card should stay hidden, same as
  // the `farm` prop case, rather than asking the user to reconfirm it.
  const hasCallerProvidedFarm = Boolean(farm) || initialFarmId != null;
  const activeFarm =
    farm ??
    (selectedFarmId !== null && selectedFarmId !== ALL_FARMS_ID
      ? farms?.find((f) => f.id === selectedFarmId)
      : null) ??
    null;
  // Resolve the active farm's area in canonical acres AND the user's preferred
  // area unit (used both for per-acre math here and threaded into the save
  // session below). Centralized so the resolution stays consistent across
  // screens — see `useFarmAreaAcres`.
  const { preferredAreaUnit, farmAreaAcres: activeFarmAreaAcres } = useFarmAreaAcres(
    activeFarm?.area,
  );
  const isGrapeFarm = isGrapeCrop(activeFarm?.crop, activeFarm?.crop_variety);
  const logFarmId = activeFarm?.id;
  const spraySources = useSprayInputSources(logFarmId ?? undefined);
  const { activeSeason, hasResolvedSeasons } = useFarmSeasonStatus(logFarmId ?? undefined);
  // Saved records for the selected farm — power the date field's "already
  // logged" dots and the repeat-last-log suggestion. Query keys are shared
  // with the farm detail screen, so these are usually cache hits.
  const { data: farmIrrigationRecords } = useIrrigationRecords(logFarmId ?? undefined);
  const { data: farmSprayRecords } = useSprayRecords(logFarmId ?? undefined);
  const { data: farmHarvestRecords } = useHarvestRecords(logFarmId ?? undefined);
  const { data: farmExpenseRecords } = useExpenseRecords(logFarmId ?? undefined);
  const { data: farmFertigationRecords } = useFertigationRecords(logFarmId ?? undefined);
  const { data: farmDailyNotes } = useDailyNotes(logFarmId ?? undefined);
  const { data: catalogMixes = [] } = useChemicalMixSearch('', isGrapeFarm);

  useEffect(() => {
    if (!isVisible) return;
    setActiveTab(defaultTab);
    if (farm?.id) {
      setSelectedFarmId(farm.id);
      return;
    }
    if (initialApplyToAllFarms) {
      setSelectedFarmId(ALL_FARMS_ID);
      return;
    }
    if (initialFarmId) {
      setSelectedFarmId(initialFarmId);
      return;
    }
    if (!selectedFarmId && farms && farms.length > 0 && farms[0].id) {
      setSelectedFarmId(farms[0].id);
    }
  }, [
    isVisible,
    defaultTab,
    farm?.id,
    farms,
    initialApplyToAllFarms,
    initialFarmId,
    selectedFarmId,
  ]);

  // Log state
  const [selectedDate, setSelectedDate] = useState<Date>(() => parsedInitialLogDate ?? new Date());
  const [selectedLogType, setSelectedLogType] = useState<LogTypeId | null>(null);
  const [showLogFormModal, setShowLogFormModal] = useState(false);
  // QuickLogSheet (dashboard sheet, draft mode) for the four quick types. Null
  // keeps it closed. `quickLogValid` is the sheet's live validity pulse, used to
  // feed the guided-tour coach (the sheet owns its form state, not EntryForm).
  const [quickLogType, setQuickLogType] = useState<QuickLogType | null>(null);
  const [quickLogValid, setQuickLogValid] = useState(false);
  // Prefill handed to the QuickLogSheet on open (plan/voice/duration). Held in
  // state so its reference is stable while the sheet is open — the sheet seeds
  // its drafts from it once per open.
  const [quickLogPrefill, setQuickLogPrefill] = useState<QuickLogInitialDraft | null>(null);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [pendingLogFailures, setPendingLogFailures] = useState<Record<string, PendingLogFailure>>(
    {},
  );
  const [isSubmittingLogs, setIsSubmittingLogs] = useState(false);

  // Leaving the log tab unmounts the QuickLogSheet without onClose, so
  // returning would reopen it with wiped drafts. Reset the type so the
  // sheet stays closed until the farmer taps a chip again.
  useEffect(() => {
    if (activeTab !== 'log') {
      setQuickLogType(null);
    }
  }, [activeTab]);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(112);
  const contentScrollViewRef = useRef<ScrollView>(null);
  const logFormScrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const logFormScrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);

  // Fertigation picker sources. The catalog fetch is gated on the standalone
  // Fertigation tab — the only inline flow that still mounts the form (the
  // irrigation + fertilizers rider lives in the QuickLogSheet, which fetches
  // its own sources).
  const fertigationSources = useFertigationInputSources(logFarmId ?? undefined, {
    catalogEnabled: selectedLogType === 'fertigation',
  });
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(() =>
    createEmptyExpenseFormData(),
  );
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(() =>
    createEmptyFertigationFormData(),
  );
  const [noteData, setNoteData] = useState<NoteFormData>(() => createEmptyNoteFormData());
  const selectedDateIso = useMemo(() => toSupabaseDateString(selectedDate), [selectedDate]);
  // Dates (yyyy-mm-dd) that already have any saved log on the selected farm.
  const loggedDateIsos = useMemo(() => {
    const dates = new Set<string>();
    const collect = (records?: { date: string }[]) => {
      records?.forEach((record) => {
        if (record.date) dates.add(record.date.slice(0, 10));
      });
    };
    collect(farmIrrigationRecords);
    collect(farmSprayRecords);
    collect(farmHarvestRecords);
    collect(farmExpenseRecords);
    collect(farmFertigationRecords);
    collect(farmDailyNotes);
    return dates;
  }, [
    farmIrrigationRecords,
    farmSprayRecords,
    farmHarvestRecords,
    farmExpenseRecords,
    farmFertigationRecords,
    farmDailyNotes,
  ]);
  const [taskPlannedInputs, setTaskPlannedInputs] = useState<PlannedInputItem[]>([]);
  const [plannedItemName, setPlannedItemName] = useState('');
  const [plannedItemQty, setPlannedItemQty] = useState('');
  const [plannedItemUnit, setPlannedItemUnit] = useState('');

  const sprayQuickAddItems = spraySources.quickAddItems;

  const fertigationQuickAddItems = fertigationSources.quickAddItems;

  const createIrrigation = useCreateIrrigationRecord();
  const createSpray = useCreateSprayRecord();
  const createHarvest = useCreateHarvestRecord();
  const createExpense = useCreateExpenseRecord();
  const createFertigation = useCreateFertigationRecord();
  const upsertDailyNote = useUpsertDailyNote();
  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();
  const deleteDailyNote = useDeleteDailyNote();

  const scrollToNode = useCallback((nodeHandle: number) => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop == null) return;
    const resolvedHandle = findNodeHandle(nodeHandle) ?? nodeHandle;
    if (typeof resolvedHandle !== 'number') return;
    // The focused input lives inside the composer sheet's dedicated ScrollView.
    const activeScrollView = logFormScrollViewRef;
    UIManager.measureInWindow(resolvedHandle, (_x, y, _width, height) => {
      const nextOffset = calculateKeyboardScrollOffset({
        currentOffset: logFormScrollOffsetRef.current,
        inputY: y,
        inputHeight: height,
        keyboardTop,
      });
      if (nextOffset != null) {
        activeScrollView.current?.scrollTo({
          y: nextOffset,
          animated: true,
        });
      }
    });
  }, []);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = resolveKeyboardTop({
        screenY: event.endCoordinates.screenY,
        keyboardHeight: event.endCoordinates.height,
        windowHeight,
      });
      setIsKeyboardVisible(true);
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [scrollToNode, windowHeight]);

  // Open the requested log surface on entry. Quick types go to QuickLogSheet
  // (prefills seed it via initialDraft); fertigation/note and all-farms
  // expense open the inline LogForm modal.
  useEffect(() => {
    if (!isVisible) return;
    const type = initialLogType ?? initialVoiceLogPrefill?.type ?? null;
    if (!type) return;
    setSelectedLogType(type);

    const prefillDate = parseInitialLogDate(initialVoiceLogPrefill?.date);
    if (prefillDate) {
      setSelectedDate(prefillDate);
    }

    if (canOpenQuickLogSheet(type, { allFarmsSelected: Boolean(initialApplyToAllFarms) })) {
      setQuickLogPrefill(
        buildQuickLogInitialDraft({
          type,
          planSprayChemicals: initialLogPrefill?.sprayChemicals,
          irrigationDurationHours: initialIrrigationDurationHours,
          voice: initialVoiceLogPrefill,
        }),
      );
      setQuickLogValid(false);
      setQuickLogType(type);
      return;
    }

    // Inline-modal survivors: fertigation (plan/voice prefill) and all-farms
    // expense (voice prefill).
    if (type === 'fertigation') {
      if (initialLogPrefill?.fertigationItems?.length) {
        setFertigationData(buildFertigationPlanPrefill(initialLogPrefill.fertigationItems));
      } else if (initialVoiceLogPrefill?.fertigation) {
        setFertigationData(buildFertigationVoicePrefill(initialVoiceLogPrefill.fertigation));
      }
    }
    // All-farms expense falls through the sheet's type guard; key off the
    // voice prefill (the narrowed `type` no longer overlaps 'expense' here).
    if (initialVoiceLogPrefill?.type === 'expense' && initialVoiceLogPrefill.expense) {
      setExpenseData(buildExpensePrefill(initialVoiceLogPrefill.expense));
    }
    setShowLogFormModal(true);
  }, [
    isVisible,
    initialLogType,
    initialLogPrefill,
    initialApplyToAllFarms,
    initialIrrigationDurationHours,
    initialVoiceLogPrefill,
  ]);

  useEffect(() => {
    if (selectedFarmId !== ALL_FARMS_ID) return;
    if (selectedLogType && selectedLogType !== 'expense') {
      if (farm?.id) {
        setSelectedFarmId(farm.id);
        return;
      }
      if (farms && farms.length > 0 && farms[0].id) {
        setSelectedFarmId(farms[0].id);
      }
    }
  }, [selectedFarmId, selectedLogType, farm?.id, farms]);

  useEffect(() => {
    if (!isVisible) return;
    if (parsedInitialLogDate) {
      setSelectedDate(parsedInitialLogDate);
    }
  }, [isVisible, parsedInitialLogDate]);

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

  // Only the inline-modal survivors validate here; the four quick types are
  // owned (and validated) by the QuickLogSheet.
  const isLogFormValid = useMemo(() => {
    if (!selectedLogType) return false;
    switch (selectedLogType) {
      case 'expense':
        return validateExpenseForm(expenseData);
      case 'fertigation':
        return validateFertigationForm(fertigationData);
      case 'note':
        return validateNoteForm(noteData);
      default:
        return false;
    }
  }, [selectedLogType, expenseData, fertigationData, noteData]);

  const router = useRouter();
  const hasFarmForCurrentLog = Boolean(
    activeFarm || (isAllFarmsSelected && selectedLogType === 'expense'),
  );
  const hasFarmForPendingSession = Boolean(activeFarm || isAllFarmsSelected);
  // Farmer paths require an active season before any log is saved. Blocks a
  // single resolved farm with no active season; the All-farms expense case is
  // exempt (spans farms, no single season to check). DB stays permissive — this
  // is a UX gate, not a data constraint.
  // Only block on a CONFIRMED no-season result: activeSeason is null both while
  // the query is loading and when it errors, so gating on hasResolvedSeasons
  // avoids falsely blocking a farm that does have a season on a cold cache or a
  // failed lookup.
  const isBlockedByNoSeason =
    logFarmId != null && !isAllFarmsSelected && hasResolvedSeasons && !activeSeason;
  const goStartSeason = useCallback(() => {
    if (logFarmId == null) return;
    onClose();
    router.push(createStartSeasonHref(logFarmId));
  }, [logFarmId, onClose, router]);
  const canSubmitLog = Boolean(isLogFormValid && hasFarmForCurrentLog && !isBlockedByNoSeason);
  const canSaveLogs = Boolean(
    pendingLogs.length > 0 && !isSubmittingLogs && hasFarmForPendingSession && !isBlockedByNoSeason,
  );
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showSaveGuidance =
    guidedTourStatus === 'in_progress' &&
    guidedTourStep === 'add_log' &&
    pendingLogs.length > 0 &&
    activeTab === 'log' &&
    presentation === 'screen';

  const getLogDescription = useCallback((type: LogTypeId, data: unknown): string => {
    switch (type) {
      case 'irrigation':
        return `${(data as IrrigationFormData).duration} hours`;
      case 'spray': {
        const spray = data as SprayFormData;
        const mixName = spray.catalogMixName?.trim();
        const water = spray.waterVolume;
        const waterLabel = water != null ? `${water}L` : '';
        if (mixName) {
          return waterLabel ? `${mixName} • ${waterLabel}` : mixName;
        }
        const chemCount = spray.chemicals.length;
        const chemLabel = `${chemCount} chemical${chemCount !== 1 ? 's' : ''}`;
        return waterLabel ? `${waterLabel} water, ${chemLabel}` : chemLabel;
      }
      case 'harvest': {
        const harvest = data as HarvestFormData;
        return `${harvest.quantity} kg, Grade ${harvest.grade}`;
      }
      case 'expense': {
        const expense = data as ExpenseFormData;
        return `₹${expense.cost} - ${expense.type}`;
      }
      case 'fertigation': {
        const fert = data as FertigationFormData;
        const fertCount = fert.fertilizers.length;
        return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''}`;
      }
      case 'note': {
        const note = data as NoteFormData;
        return note.notes?.trim() ?? '';
      }
      default:
        return '';
    }
  }, []);

  const buildPendingLog = useCallback(
    (
      type: LogTypeId,
      data: PendingLog['data'],
      extra?: Partial<Pick<PendingLog, 'linkIrrigationFromPendingLogId'>>,
    ): PendingLog => {
      const draftScope: PendingLog['scope'] =
        isAllFarmsSelected && type === 'expense' ? 'all_farms' : 'single_farm';
      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type,
        scope: draftScope,
        farmId: draftScope === 'all_farms' ? null : (activeFarm?.id ?? null),
        data,
        displayDescription: getLogDescription(type, data),
        isSourceTaskLog: false,
        ...extra,
      };
    },
    [activeFarm?.id, getLogDescription, isAllFarmsSelected],
  );

  const enqueuePendingLogs = useCallback(
    (newLogs: PendingLog[]) => {
      if (newLogs.length === 0) return;
      setPendingLogs((prev) => {
        let hasSourceTaskLog = prev.some((log) => log.isSourceTaskLog);
        const marked = newLogs.map((log) => {
          const shouldMark = Boolean(
            sourceTaskId && sourceTaskType && log.type === sourceTaskType && !hasSourceTaskLog,
          );
          if (shouldMark) hasSourceTaskLog = true;
          return shouldMark ? { ...log, isSourceTaskLog: true } : log;
        });
        return [...prev, ...marked];
      });
      setSelectedLogType(null);
      setShowLogFormModal(false);
      setTimeout(() => {
        contentScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 250);
    },
    [sourceTaskId, sourceTaskType],
  );

  const enqueuePendingLog = useCallback(
    (type: LogTypeId, data: PendingLog['data']) => {
      enqueuePendingLogs([buildPendingLog(type, data)]);
    },
    [buildPendingLog, enqueuePendingLogs],
  );

  // Clears PHI fields from a spray draft. PHI derives from the spray date, so a
  // copied/repeated spray must not inherit verified fields. Centralized here so
  // the add flow and the repeat-last-log flow share one rule.
  const buildSprayPendingData = useCallback(
    (input: SprayFormData): SprayFormData => finalizeSprayFormData(input, isGrapeFarm),
    [isGrapeFarm],
  );

  // "Repeat last log": the most recent logged day on this farm before the
  // selected date, with its records mapped back into draft form data.
  const repeatLastLogSuggestion = useMemo(() => {
    if (isAllFarmsSelected || !logFarmId) return null;
    let lastIso: string | null = null;
    loggedDateIsos.forEach((iso) => {
      if (iso < selectedDateIso && (!lastIso || iso > lastIso)) lastIso = iso;
    });
    if (!lastIso) return null;
    const matchesDay = (record: { date: string }) => record.date?.slice(0, 10) === lastIso;
    // A repeat draft item. `linkedIrrigationItemKey` is set on fertigation
    // items that were originally linked to an irrigation record on this day, so
    // the enqueue step can carry `linkIrrigationFromPendingLogId` forward and
    // the copied pair stays linked (the fertigation record keeps its
    // irrigation_record_id).
    interface RepeatItem {
      key: string;
      type: LogTypeId;
      data: PendingLog['data'];
      description: string;
      linkedIrrigationItemKey?: string;
    }
    const items: RepeatItem[] = [];
    const push = (key: string, type: LogTypeId, data: PendingLog['data']) => {
      items.push({ key, type, data, description: getLogDescription(type, data) });
    };
    // Index the day's irrigation records by id so linked fertigation can resolve
    // its partner suggestion item (the copy must point at the new irrigation
    // draft, not the original record id).
    const irrigationItemKeyByRecordId = new Map<number, string>();
    (farmIrrigationRecords ?? []).filter(matchesDay).forEach((record) => {
      const key = `irrigation-${record.id}`;
      if (record.id != null) irrigationItemKeyByRecordId.set(record.id, key);
      push(key, 'irrigation', irrigationRecordToFormData(record));
    });
    (farmFertigationRecords ?? []).filter(matchesDay).forEach((record) => {
      const key = `fertigation-${record.id}`;
      const data = fertigationRecordToFormData(record);
      const linkedIrrigationItemKey = record.irrigation_record_id
        ? irrigationItemKeyByRecordId.get(record.irrigation_record_id)
        : undefined;
      const item: RepeatItem = {
        key,
        type: 'fertigation',
        data,
        description: getLogDescription('fertigation', data),
      };
      if (linkedIrrigationItemKey) item.linkedIrrigationItemKey = linkedIrrigationItemKey;
      items.push(item);
    });
    (farmSprayRecords ?? []).filter(matchesDay).forEach((record) => {
      // PHI fields derive from the spray date — a copy on a new date must not
      // inherit them. Routed through buildSprayPendingData (same path as adding
      // a spray) so the rule lives in one place.
      const formData = sprayRecordToFormData(record);
      // spray records only carry catalog_mix_id; resolve the name from the
      // catalog cache (already loaded above) so the repeat description and the
      // copied draft show the mix name, not a chemical-count fallback.
      if (formData.catalogMixId != null && !formData.catalogMixName) {
        formData.catalogMixName =
          catalogMixes.find((mix) => mix.id === formData.catalogMixId)?.name ?? null;
      }
      push(`spray-${record.id}`, 'spray', buildSprayPendingData(formData));
    });
    (farmHarvestRecords ?? []).filter(matchesDay).forEach((record) => {
      push(`harvest-${record.id}`, 'harvest', harvestRecordToFormData(record));
    });
    (farmExpenseRecords ?? []).filter(matchesDay).forEach((record) => {
      push(`expense-${record.id}`, 'expense', expenseRecordToFormData(record));
    });
    (farmDailyNotes ?? []).filter(matchesDay).forEach((record) => {
      push(`note-${record.id}`, 'note', dailyNoteRecordToFormData(record));
    });
    if (items.length === 0) return null;
    return { dateIso: lastIso, date: parseDbDateToLocalDate(lastIso) ?? new Date(), items };
  }, [
    isAllFarmsSelected,
    logFarmId,
    loggedDateIsos,
    selectedDateIso,
    getLogDescription,
    buildSprayPendingData,
    farmIrrigationRecords,
    farmFertigationRecords,
    farmSprayRecords,
    farmHarvestRecords,
    farmExpenseRecords,
    farmDailyNotes,
    catalogMixes,
  ]);

  const handleRepeatLastLog = useCallback(() => {
    if (!repeatLastLogSuggestion) return;
    // Build drafts first so fertigation items can reference their partner
    // irrigation draft by its NEW pending-log id (the link points at the copy,
    // not the original record). `buildPendingLog` stamps a fresh id on each.
    const drafts = repeatLastLogSuggestion.items.map((item) =>
      buildPendingLog(item.type, item.data),
    );
    const draftIdByItemKey = new Map(
      drafts.map((draft, index) => [repeatLastLogSuggestion.items[index].key, draft.id]),
    );
    const linkedDrafts = drafts.map((draft, index) => {
      const item = repeatLastLogSuggestion.items[index];
      if (!item.linkedIrrigationItemKey) return draft;
      const partnerDraftId = draftIdByItemKey.get(item.linkedIrrigationItemKey);
      return partnerDraftId ? { ...draft, linkIrrigationFromPendingLogId: partnerDraftId } : draft;
    });
    enqueuePendingLogs(linkedDrafts);
  }, [repeatLastLogSuggestion, buildPendingLog, enqueuePendingLogs]);

  // Enqueue an irrigation draft together with its fertigation rider, linking
  // the fertigation log to the irrigation log so the orchestrator can stamp
  // the irrigation record id onto it. Used by the QuickLogSheet draft handoff.
  const enqueueIrrigationWithFertigation = useCallback(
    (irrigation: PendingLog['data'], fertigation: PendingLog['data']) => {
      const irrigationLog = buildPendingLog('irrigation', irrigation);
      const fertigationLog = buildPendingLog('fertigation', fertigation, {
        linkIrrigationFromPendingLogId: irrigationLog.id,
      });
      enqueuePendingLogs([irrigationLog, fertigationLog]);
    },
    [buildPendingLog, enqueuePendingLogs],
  );

  // Inline composer Add Entry — only fertigation, note, and all-farms expense
  // arrive here; quick types go through QuickLogSheet via handleQuickLogDraft.
  const addLogToSession = useCallback(() => {
    if (!selectedLogType || !isLogFormValid) return;
    if (!activeFarm && !isAllFarmsSelected) return;
    if (isAllFarmsSelected && selectedLogType !== 'expense') return;

    let data: PendingLog['data'];
    switch (selectedLogType) {
      case 'expense':
        data = { ...expenseData };
        setExpenseData(createEmptyExpenseFormData());
        break;
      case 'fertigation':
        data = { ...fertigationData };
        setFertigationData(createEmptyFertigationFormData());
        break;
      case 'note':
        data = { ...noteData };
        setNoteData(createEmptyNoteFormData());
        break;
      default:
        return;
    }

    enqueuePendingLog(selectedLogType, data);
  }, [
    selectedLogType,
    isLogFormValid,
    activeFarm,
    isAllFarmsSelected,
    expenseData,
    fertigationData,
    noteData,
    enqueuePendingLog,
  ]);

  // QuickLogSheet draft handoff: route the sheet's draft through the same
  // pending-log pipeline as the inline composer. Spray is finalized via
  // buildSprayPendingData (phiOverride already applied by the sheet).
  const handleQuickLogDraft = useCallback(
    (payload: QuickLogDraftPayload) => {
      if (payload.type === 'irrigation') {
        if (payload.fertigation) {
          enqueueIrrigationWithFertigation(payload.irrigation, payload.fertigation);
          return;
        }
        enqueuePendingLog('irrigation', payload.irrigation);
        return;
      }
      if (payload.type === 'spray') {
        enqueuePendingLog('spray', buildSprayPendingData(payload.spray));
        return;
      }
      if (payload.type === 'expense') {
        enqueuePendingLog('expense', payload.expense);
        return;
      }
      enqueuePendingLog('harvest', payload.harvest);
    },
    [enqueuePendingLog, enqueueIrrigationWithFertigation, buildSprayPendingData],
  );

  const removeLogFromSession = useCallback((id: string) => {
    setPendingLogFailures((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPendingLogs((prev) => prev.filter((log) => log.id !== id));
  }, []);

  const saveAllLogs = async () => {
    if (pendingLogs.length === 0) return;

    setIsSubmittingLogs(true);
    setPendingLogFailures({});
    const dateStr = toSupabaseDateString(selectedDate);
    const createdFrom = entrySource === 'voice_ai' ? 'voice_ai' : 'manual';

    const adapters: EntryLogSessionAdapters = {
      createIrrigation: async (payload) => createIrrigation.mutateAsync(payload),
      createSpray: async (payload) => createSpray.mutateAsync(payload),
      createHarvest: async (payload) => createHarvest.mutateAsync(payload),
      createExpense: async (payload) => createExpense.mutateAsync(payload),
      createFertigation: async (payload) => createFertigation.mutateAsync(payload),
      upsertDailyNote: async (payload) => upsertDailyNote.mutateAsync(payload),
      getDailyNote: async ({ farmId, date }) => {
        const { data, error } = await getDataAccess()
          .from(TABLES.DAILY_NOTES)
          .select('*')
          .eq('farm_id', farmId)
          .eq('date', date)
          .maybeSingle();
        if (error) throw error;
        return (data ?? null) as DailyNoteRecord | null;
      },
      deleteIrrigation: async (payload) => deleteIrrigation.mutateAsync(payload),
      deleteSpray: async (payload) => deleteSpray.mutateAsync(payload),
      deleteHarvest: async (payload) => deleteHarvest.mutateAsync(payload),
      deleteExpense: async (payload) => deleteExpense.mutateAsync(payload),
      deleteFertigation: async (payload) => deleteFertigation.mutateAsync(payload),
      deleteDailyNote: async (payload) => deleteDailyNote.mutateAsync(payload),
    };

    const buildPendingLogFailure = (
      error: unknown,
      existing?: PendingLogFailure,
    ): PendingLogFailure => {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : t('entryForm.saveFailed.unexpectedError', {
                defaultValue: 'Unexpected save error. Please try again.',
              });
      const errorMeta = getFarmErrorMeta(error);
      return {
        message: errorMeta.message ?? errorMessage,
        code: errorMeta.code,
        failedCount: (existing?.failedCount ?? 0) + 1,
        hasRollbackFailure: existing?.hasRollbackFailure,
      };
    };

    const reportSaveFailure = (
      failedCount: number,
      firstFailedError: unknown,
      failedLogContext: (typeof pendingLogs)[number] | null,
      failures: EntryLogSubmissionFailure[],
      rollbackFailures?: EntryLogRollbackFailure[],
    ) => {
      const errorMessage =
        firstFailedError instanceof Error
          ? firstFailedError.message
          : typeof firstFailedError === 'string'
            ? firstFailedError
            : 'An unexpected error occurred (see logs for details)';
      const errorMeta = getFarmErrorMeta(firstFailedError);
      if (shouldCaptureFarmErrorInSentry(errorMeta)) {
        Sentry.withScope((scope) => {
          scope.setTag('feature', 'entry-log');
          scope.setExtra('pendingLogId', failedLogContext?.id ?? 'unknown');
          scope.setExtra('failedCount', failedCount);
          scope.setTag('logType', failedLogContext?.type ?? 'unknown');
          scope.setExtra('errorMeta', { code: errorMeta.code ?? null });
          if (rollbackFailures && rollbackFailures.length > 0) {
            scope.setExtra('rollbackFailures', rollbackFailures);
          }
          Sentry.captureException(
            firstFailedError instanceof Error ? firstFailedError : new Error(errorMessage),
          );
        });
      }
      // Emit a standalone Sentry event for rollback failures so orphan-row
      // incidents are independently queryable.
      if (rollbackFailures && rollbackFailures.length > 0) {
        Sentry.withScope((scope) => {
          scope.setTag('feature', 'entry-log');
          scope.setTag('subFeature', 'rollback-failure');
          scope.setExtra('rollbackFailures', rollbackFailures);
          scope.setExtra('primaryErrorMeta', { code: errorMeta.code ?? null });
          Sentry.captureException(
            new Error(
              `Rollback failed for ${rollbackFailures.length} created record(s) after save failure`,
            ),
          );
        });
      }

      const nextFailures: Record<string, PendingLogFailure> = {};
      failures.forEach((failure) => {
        nextFailures[failure.pendingLogId] = buildPendingLogFailure(
          failure.error,
          nextFailures[failure.pendingLogId],
        );
        const error = failure.error;
        const errorMeta = getFarmErrorMeta(error);
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('Failed to save pending log', {
          pendingLogId: failure.pendingLogId,
          logType: failure.type,
          farmId: failure.farmId,
          errorName,
          errorCode: errorMeta.code ?? null,
          errorMessage: errorMeta.message ?? (error instanceof Error ? error.message : null),
          ...(__DEV__ ? { errorHint: errorMeta.hint ?? null } : {}),
        });
      });
      if (rollbackFailures && rollbackFailures.length > 0) {
        rollbackFailures.forEach((failure) => {
          if (__DEV__) {
            console.error('Failed to rollback created record', failure);
          }
          const existingFailure =
            nextFailures[failure.pendingLogId] ?? buildPendingLogFailure(failure.error);
          nextFailures[failure.pendingLogId] = {
            ...existingFailure,
            hasRollbackFailure: true,
          };
        });
      }
      if (Object.keys(nextFailures).length === 0 && failedLogContext) {
        nextFailures[failedLogContext.id] = buildPendingLogFailure(firstFailedError);
      }
      setPendingLogFailures(nextFailures);
    };

    try {
      const result = await saveEntryLogSession({
        pendingLogs,
        dateStr,
        currentFarm: farm ?? null,
        farms: farms ?? [],
        preferredAreaUnit,
        adapters,
      });

      if (result.status === 'blocked') {
        if (result.reason === 'mixed_scopes') {
          Alert.alert(
            t('common.error'),
            t('entryForm.mixedDraftScopes', {
              defaultValue:
                'This draft session contains both all-farms and single-farm entries. Please save or remove one scope before continuing.',
            }),
          );
          return;
        }
        if (result.reason === 'no_farms') {
          Alert.alert(t('common.error'), t('entryForm.allFarmsNoFarms'));
          return;
        }
        if (result.reason === 'all_farms_expense_only') {
          Alert.alert(t('common.error'), t('entryForm.allFarmsExpenseOnly'));
          return;
        }
        if (result.reason === 'mixed_farms') {
          Alert.alert(
            t('common.error'),
            t('entryForm.mixedDraftFarms', {
              defaultValue:
                'This draft session includes entries for multiple farms. Please save or remove entries so all drafts target one farm.',
            }),
          );
          return;
        }
        if (result.reason === 'missing_farm') {
          Alert.alert(
            t('common.error'),
            t('entryForm.missingFarm', {
              defaultValue:
                'The selected farm could not be resolved. Please choose a farm again before saving.',
            }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('entryForm.selectFarm'),
                onPress: () => {
                  setSelectedFarmId(null);
                  setShowLogFarmPicker(true);
                },
              },
            ],
          );
          return;
        }
        return;
      }

      if (result.status === 'failed') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        reportSaveFailure(
          result.failedCount,
          result.firstFailedError,
          result.firstFailedLog,
          result.failures,
          result.rollbackFailures,
        );
        return;
      }

      // All saves succeeded -- emit telemetry, update task, clear pending.
      let taskCompletionUpdateFailed = false;

      result.createdRecords.forEach((record) => {
        const log = pendingLogs.find((item) => item.id === record.pendingLogId);
        try {
          telemetry.capture('record_created', {
            record_type: record.type,
            created_from: createdFrom,
            farm_id: record.farmId,
          });
          if (entrySource === 'voice_ai' && log) {
            telemetry.capture('voice_log_submitted', {
              farm_id: record.farmId,
              record_type: record.type,
              duration_hours:
                record.type === 'irrigation'
                  ? ((log.data as IrrigationFormData).duration ?? null)
                  : null,
            });
          }
          telemetry.capture('meaningful_action', {
            action_type: 'record_created',
            feature_name: record.type,
          });
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Telemetry] failed to send:', err);
          }
        }
        guidedTourEmit('guidedTour.logCreated', {
          farmId: record.farmId,
          recordType: record.type,
        });
      });
      setPendingLogs([]);
      setPendingLogFailures({});

      if (sourceTaskId && result.sourceTaskRecord) {
        try {
          await updateTask.mutateAsync({
            id: sourceTaskId,
            updates: {
              status: 'completed',
              completed: true,
              completed_at: new Date().toISOString(),
              linked_record_type: result.sourceTaskRecord.type,
              linked_record_id: result.sourceTaskRecord.recordId,
            },
          });
        } catch (taskUpdateError) {
          taskCompletionUpdateFailed = true;
          const taskUpdateErrorMeta = getFarmErrorMeta(taskUpdateError);
          const taskUpdateErrorName =
            taskUpdateError instanceof Error ? taskUpdateError.name : 'UnknownError';
          console.error('Task completion update failed after log save', {
            errorName: taskUpdateErrorName,
            errorCode: taskUpdateErrorMeta.code ?? null,
            errorMessage:
              taskUpdateErrorMeta.message ??
              (taskUpdateError instanceof Error ? taskUpdateError.message : null),
            ...(__DEV__ ? { errorHint: taskUpdateErrorMeta.hint ?? null } : {}),
          });

          if (shouldCaptureFarmErrorInSentry(taskUpdateErrorMeta)) {
            Sentry.withScope((scope) => {
              scope.setTag('feature', 'entry-log');
              scope.setExtra('taskId', sourceTaskId);
              scope.setExtra('errorMeta', { code: taskUpdateErrorMeta.code ?? null });
              Sentry.captureException(
                taskUpdateError instanceof Error
                  ? taskUpdateError
                  : new Error('Task completion update failed'),
              );
            });
          }
        }
      }

      // Refresh the dashboard in the background so the success toast and close
      // fire immediately — the records are already written; we don't make the
      // user wait on the full dashboard refetch. A background refetch failure is
      // non-critical (each query tracks its own error state) and must not land in
      // the catch below as a misleading "failed to save" alert, so swallow it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }).catch(() => {});
      toast.success(t('entryForm.logSaved'));
      onLogSaveSuccess?.();

      if (taskCompletionUpdateFailed) {
        Alert.alert(t('common.error'), t('entryForm.taskCompletionLinkFailed'));
      }

      onClose();
    } catch (error) {
      console.error('Error saving logs:', error);
      Alert.alert(t('common.error'), t('common.errors.failedToSaveLogs'));
    } finally {
      setIsSubmittingLogs(false);
    }
  };

  // Task state
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEditingTask = !!editingTask;
  const taskRemindersEnabled = useNotificationStore((s) => s.taskRemindersEnabled);
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const upsertTaskSchedule = useNotificationStore((s) => s.upsertTaskSchedule);
  const removeTaskSchedule = useNotificationStore((s) => s.removeTaskSchedule);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('note');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskFarmId, setTaskFarmId] = useState<number | null>(null);
  // Single-farm accounts skip the farm selector cards entirely, so default
  // the task farm to the only farm (logs already auto-select via selectedFarmId).
  const isSingleFarmAccount = (farms?.length ?? 0) === 1;
  useEffect(() => {
    if (isSingleFarmAccount && !taskFarmId && farms?.[0]?.id) {
      setTaskFarmId(farms[0].id);
    }
  }, [isSingleFarmAccount, taskFarmId, farms]);
  const [dueDate, setDueDate] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const prevVisibleRef = useRef(false);
  const prevEditingTaskIdRef = useRef<number | null | undefined>(undefined);
  const prevEditingTaskUpdatedAtRef = useRef<string | undefined>(undefined);

  const resetTaskForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setType('note');
    setPriority('medium');
    setDueDate('');
    setShowTypePicker(false);
    setShowPriorityPicker(false);
    setShowTemplates(false);
    setTaskPlannedInputs([]);
    setPlannedItemName('');
    setPlannedItemQty('');
    setPlannedItemUnit('');
  }, []);

  useEffect(() => {
    if (!isVisible) {
      prevVisibleRef.current = isVisible;
      return;
    }
    const shouldUpdate =
      !prevVisibleRef.current ||
      editingTask?.id !== prevEditingTaskIdRef.current ||
      editingTask?.updated_at !== prevEditingTaskUpdatedAtRef.current;

    if (shouldUpdate) {
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(stripTaskPlanFromDescription(editingTask.description || ''));
        setType(editingTask.type);
        setPriority(editingTask.priority);
        setTaskFarmId(editingTask.farm_id);
        setDueDate(editingTask.due_date || '');
        setTaskPlannedInputs(
          editingTask.planned_inputs && editingTask.planned_inputs.length > 0
            ? editingTask.planned_inputs
            : decodeTaskPlanFromDescription(editingTask.description || ''),
        );
      } else {
        resetTaskForm();
        setTaskPlannedInputs([]);
        setPlannedItemName('');
        setPlannedItemQty('');
        setPlannedItemUnit('');
        if (farm?.id) {
          setTaskFarmId(farm.id);
        } else if (initialFarmId) {
          setTaskFarmId(initialFarmId);
        } else if (farms && farms.length > 0 && farms[0].id) {
          setTaskFarmId(farms[0].id);
        } else {
          setTaskFarmId(null);
        }
      }
    }

    prevVisibleRef.current = isVisible;
    prevEditingTaskIdRef.current = editingTask?.id;
    prevEditingTaskUpdatedAtRef.current = editingTask?.updated_at;
  }, [isVisible, editingTask, farms, initialFarmId, farm?.id, resetTaskForm]);

  const applyTemplate = (template: TaskTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setType(template.type);
    setPriority(template.priority);
    setShowTemplates(false);
  };

  useEffect(() => {
    if (type !== 'spray' && type !== 'fertigation' && taskPlannedInputs.length > 0) {
      setTaskPlannedInputs([]);
    }
  }, [type, taskPlannedInputs.length]);

  const taskPlanningSuggestions = useMemo<PlannedInputItem[]>(() => {
    if (type === 'spray') {
      return sprayQuickAddItems.map((item) => ({
        name: item.name,
        unit: item.unit ?? 'gm/L',
        quantity: item.quantity ?? null,
        source: 'recent',
      }));
    }
    if (type === 'fertigation') {
      return fertigationQuickAddItems.map((item) => ({
        name: item.name,
        unit: item.unit ?? 'kg',
        quantity: item.quantity ?? null,
        source: 'recent',
      }));
    }
    return [];
  }, [type, sprayQuickAddItems, fertigationQuickAddItems]);

  const addTaskPlannedInput = useCallback((input: PlannedInputItem) => {
    if (!input.name.trim()) return;
    setTaskPlannedInputs((prev) => {
      const key = `${input.name.trim().toLowerCase()}::${(input.unit ?? '').trim().toLowerCase()}`;
      const exists = prev.some(
        (item) =>
          `${item.name.trim().toLowerCase()}::${(item.unit ?? '').trim().toLowerCase()}` === key,
      );
      if (exists) return prev;
      return [...prev, input];
    });
  }, []);

  const removeTaskPlannedInput = useCallback((item: PlannedInputItem) => {
    setTaskPlannedInputs((prev) => {
      const key = `${item.name.trim().toLowerCase()}::${(item.unit ?? '').trim().toLowerCase()}`;
      return prev.filter(
        (i) => `${i.name.trim().toLowerCase()}::${(i.unit ?? '').trim().toLowerCase()}` !== key,
      );
    });
  }, []);

  const addCustomTaskPlannedInput = useCallback(() => {
    const quantityValue = plannedItemQty.trim() ? Number(plannedItemQty) : null;
    addTaskPlannedInput({
      name: plannedItemName.trim(),
      unit: plannedItemUnit.trim() || (type === 'spray' ? 'gm/L' : 'kg'),
      quantity: Number.isFinite(quantityValue) ? quantityValue : null,
      source: 'custom',
    });
    setPlannedItemName('');
    setPlannedItemQty('');
    setPlannedItemUnit('');
  }, [addTaskPlannedInput, plannedItemName, plannedItemQty, plannedItemUnit, type]);

  const isTaskValid = Boolean(title.trim() && (farm?.id || taskFarmId));
  const isTaskSaving = createTask.isPending || updateTask.isPending;

  const handleTaskSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('common.errors.enterTaskTitle'));
      return;
    }
    const resolvedFarmId = farm?.id ?? taskFarmId;
    if (!resolvedFarmId) {
      Alert.alert(t('common.error'), t('common.errors.selectFarm'));
      return;
    }

    const normalizedPlannedInputs =
      type === 'spray' || type === 'fertigation' ? normalizePlannedInputs(taskPlannedInputs) : [];
    const taskDescription = encodeTaskPlanInDescription(description, normalizedPlannedInputs);

    const taskData = {
      farm_id: resolvedFarmId,
      title: title.trim(),
      description: taskDescription,
      type,
      status: 'pending' as const,
      priority,
      due_date: dueDate || null,
      estimated_duration_minutes: null,
      location: null,
      completed: false,
      completed_at: null,
      assigned_to_user_id: null,
      created_by: null,
      linked_record_type: null,
      linked_record_id: null,
      planned_inputs: normalizedPlannedInputs,
    };

    let savedTask: TaskReminder | null = null;

    try {
      if (isEditingTask && editingTask?.id) {
        savedTask = await updateTask.mutateAsync({
          id: editingTask.id,
          updates: taskData,
        });
      } else {
        savedTask = await createTask.mutateAsync(taskData);
        telemetry.capture('task_created', {
          task_type: type,
          priority,
          source: 'manual',
          farm_id: resolvedFarmId,
          due_offset_days: dueDate
            ? Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
        });
      }
    } catch (_error) {
      Alert.alert(t('common.error'), t('common.errors.failedToSaveTask'));
      return;
    }

    if (savedTask?.id) {
      const taskId = String(savedTask.id);
      const existing = taskSchedules[taskId];
      const nextDueDate = savedTask.due_date ?? null;
      const hasDueDateChanged = existing?.dueDate !== nextDueDate;

      try {
        if (taskRemindersEnabled && nextDueDate && hasDueDateChanged) {
          const granted = await ensureNotificationPermissions();
          if (granted) {
            if (existing?.notificationIds?.length) {
              await Promise.allSettled(
                existing.notificationIds.map((id) => cancelNotification(id)),
              );
            }
            const notificationIds = await scheduleTaskDueReminder(taskId, nextDueDate);
            if (notificationIds.length > 0) {
              upsertTaskSchedule(taskId, { notificationIds, dueDate: nextDueDate });
            } else {
              removeTaskSchedule(taskId);
            }
          }
        }

        if (!nextDueDate && existing?.notificationIds?.length && hasDueDateChanged) {
          await Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id)));
          removeTaskSchedule(taskId);
        }
      } catch (notificationError) {
        if (__DEV__) {
          console.error('Failed to schedule task notification:', notificationError);
        }
      }
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    toast.success(t('entryForm.taskSaved'));
    onTaskSaveSuccess?.(resolvedFarmId);
    onClose();
  };

  const selectedTaskFarm = farms?.find((f) => f.id === taskFarmId);

  const handleClose = useCallback(() => {
    const hasPendingLogs = pendingLogs.length > 0;
    const hasUnsavedTaskChanges =
      activeTab === 'task' &&
      (title.trim() || description.trim() || dueDate || taskPlannedInputs.length > 0);

    if (hasPendingLogs || hasUnsavedTaskChanges) {
      Alert.alert(
        t('entryForm.discardChanges.title'),
        hasUnsavedTaskChanges && !hasPendingLogs
          ? t('entryForm.discardChanges.taskOnly')
          : !hasUnsavedTaskChanges && hasPendingLogs
            ? t('entryForm.discardChanges.logsOnly')
            : t('entryForm.discardChanges.both'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('entryForm.discardChanges.discard'),
            style: 'destructive',
            onPress: () => {
              setPendingLogs([]);
              setPendingLogFailures({});
              resetTaskForm();
              setSelectedLogType(null);
              onClose();
            },
          },
        ],
      );
    } else {
      setSelectedLogType(null);
      onClose();
    }
  }, [
    pendingLogs.length,
    activeTab,
    title,
    description,
    dueDate,
    taskPlannedInputs.length,
    resetTaskForm,
    onClose,
    t,
  ]);
  const renderLogFormModal = () => {
    if (!selectedLogType) return null;
    const logType = LOG_TYPES.find((lt) => lt.id === selectedLogType);
    return (
      <Modal
        visible={showLogFormModal}
        animationType="slide"
        // iOS page sheet: the Add Log overview stays visible behind the
        // composer and swipe-down dismisses (fires onRequestClose). Android
        // ignores presentationStyle and keeps the full-screen slide.
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowLogFormModal(false);
          setSelectedLogType(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : 'height'}
            keyboardVerticalOffset={isIOS ? 0 : 20}
            style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
          >
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderBottomWidth: 1,
                borderColor: m3.surface.s100,
                paddingHorizontal: 16,
                paddingBottom: 12,
                // Page sheets hang below the status bar on iOS, so the safe-area
                // top inset only applies on Android's full-screen fallback.
                paddingTop: isIOS ? 14 : 8 + insets.top,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    selectable
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: '600',
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                  </Text>
                  <Text
                    selectable
                    style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                    numberOfLines={1}
                  >
                    {activeFarm?.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setShowLogFormModal(false);
                    setSelectedLogType(null);
                  }}
                  style={{ width: 40, alignItems: 'flex-end' }}
                >
                  <AppIcon
                    name="close-circle"
                    size={26}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              ref={logFormScrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                logFormScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <LogForm
                selectedLogType={selectedLogType}
                expenseData={expenseData}
                fertigationData={fertigationData}
                noteData={noteData}
                onExpenseChange={setExpenseData}
                onFertigationChange={setFertigationData}
                onNoteChange={setNoteData}
                onInputFocus={scrollToFocusedInput}
                onAdd={addLogToSession}
                isValid={isLogFormValid}
                hasFarm={hasFarmForCurrentLog}
                fertigationHistoryItems={fertigationSources.historyItems}
                fertigationPlanItems={fertigationSources.planItems}
                fertigationCatalogProducts={fertigationSources.catalogProducts}
                areaAcres={activeFarmAreaAcres}
                showSaveButton={false}
              />
            </ScrollView>
            <View
              style={{
                flexShrink: 0,
                backgroundColor: m3.surface.s100,
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: Math.max(spacing[3], insets.bottom),
                borderTopWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
              }}
            >
              <GuidedTourTarget
                targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY}
                style={{ alignSelf: 'stretch' }}
              >
                <Pressable
                  onPress={addLogToSession}
                  disabled={!canSubmitLog}
                  style={{
                    paddingVertical: 14,
                    borderRadius: radius.lg,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    backgroundColor: canSubmitLog
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  }}
                >
                  <AppIcon
                    name="add-circle"
                    size={20}
                    color={
                      canSubmitLog
                        ? m3.colorScheme.onPrimary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                    }
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontWeight: '600',
                      fontSize: fontSize.base,
                      color: canSubmitLog
                        ? m3.colorScheme.onPrimary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                    }}
                  >
                    {t('entryForm.addEntry')}
                  </Text>
                </Pressable>
              </GuidedTourTarget>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  // Render sticky add entry button above keyboard
  const renderStickyAddButton = () => {
    if (!isLogFormValid || !selectedLogType) return null;

    return (
      <View
        style={{
          backgroundColor: m3.surface.s100,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderColor: m3.surface.s300,
        }}
      >
        <Pressable
          onPress={addLogToSession}
          disabled={!canSubmitLog}
          style={[
            {
              paddingVertical: 14,
              borderRadius: radius.md,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            },
            {
              backgroundColor: canSubmitLog
                ? m3.colorScheme.primary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            },
          ]}
        >
          <AppIcon
            name="add-circle"
            size={20}
            color={
              canSubmitLog
                ? m3.colorScheme.onPrimary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
            }
          />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600', fontSize: fontSize.base },
              {
                color: canSubmitLog
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
              },
            ]}
          >
            {t('entryForm.addEntry')}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderLogContent = () => (
    <>
      {/* Season gate: farmer paths must have an active season to save. Banner
          carries the Start-season CTA; Save stays disabled while blocked (see
          isBlockedByNoSeason / canSubmitLog). Single resolved farm only —
          never the All-farms expense case. */}
      {isBlockedByNoSeason ? <NoActiveSeasonBanner onStartSeason={goStartSeason} /> : null}
      {!hasCallerProvidedFarm && !lockFarmSelection && !isSingleFarmAccount && (
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: radius.lg,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
          }}
        >
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            {t('entryForm.farmLabel')}
          </Text>
          <Pressable
            disabled={pendingLogs.length > 0}
            accessibilityState={{ disabled: pendingLogs.length > 0 }}
            onPress={() => {
              if (pendingLogs.length > 0) return;
              setShowLogFarmPicker(!showLogFarmPicker);
            }}
            style={{
              backgroundColor: m3.surface.s50,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              opacity: pendingLogs.length > 0 ? 0.7 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={18} color={m3.colorScheme.primary} />
              <Text
                selectable
                style={{ fontSize: fontSize.base, color: m3.colorScheme.onSurface, marginLeft: 8 }}
              >
                {isAllFarmsSelected
                  ? t('entryForm.allFarms')
                  : activeFarm?.name || t('entryForm.selectFarm')}
              </Text>
            </View>
            <AppIcon
              name="chevron-down"
              size={18}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
          <OptionPickerSheet
            visible={showLogFarmPicker}
            onClose={() => setShowLogFarmPicker(false)}
            title={t('entryForm.selectFarm')}
            selectedKey={isAllFarmsSelected ? 'all-farms' : (activeFarm?.id?.toString() ?? null)}
            options={[
              ...(selectedLogType === 'expense'
                ? [{ key: 'all-farms', label: t('entryForm.allFarms') }]
                : []),
              ...(farms ?? [])
                .filter((f) => f.id)
                .map((f) => ({ key: String(f.id), label: f.name })),
            ]}
            onSelect={(key) => {
              setSelectedFarmId(key === 'all-farms' ? ALL_FARMS_ID : Number(key));
            }}
          />
        </View>
      )}

      <View
        style={{
          backgroundColor: m3.surface.s100,
          borderRadius: radius.lg,
          padding: 14,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              selectable
              style={{
                fontSize: fontSize.xs,
                fontWeight: '700',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: m3.colorScheme.onSurfaceVariant,
                marginBottom: 4,
              }}
            >
              {t('entryForm.loggingFor', { defaultValue: 'Logging for' })}
            </Text>
          </View>

          {pendingLogs.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.full,
              }}
            >
              <AppIcon name="document-text" size={14} color={m3.colorScheme.primary} />
              <Text
                selectable
                style={{
                  marginLeft: 6,
                  fontSize: fontSize.xs,
                  fontWeight: '700',
                  color: m3.colorScheme.primary,
                }}
              >
                {t('entryForm.drafts', { count: pendingLogs.length })}
              </Text>
            </View>
          )}
        </View>
        <DateField
          value={selectedDate}
          onChange={setSelectedDate}
          maximumDate={new Date()}
          label={t('entryForm.selectDate')}
          renderTrigger={(openPicker) => {
            const isToday = formatLocalDate(selectedDate) === formatLocalDate(new Date());
            return (
              <Pressable
                onPress={openPicker}
                accessibilityRole="button"
                accessibilityLabel={t('common.selectDate', { defaultValue: 'Select date' })}
                style={{
                  minHeight: 58,
                  paddingHorizontal: 16,
                  borderRadius: componentRadius.input,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <AppIcon name="calendar" size={20} color={m3.colorScheme.onSurface} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: fontSize.base,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {isToday
                    ? t('common.today', { defaultValue: 'Today' })
                    : formatDate(selectedDate, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                </Text>
                <AppIcon name="chevron-down" size={18} color={m3.colorScheme.onSurface} />
              </Pressable>
            );
          }}
        />
      </View>

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY}>
        <LogTypeSelector
          selectedLogType={selectedLogType}
          hasPendingDrafts={pendingLogs.length > 0}
          pendingLogTypes={pendingLogs.map((log) => log.type)}
          hintText={t('entryForm.logTypeHelper', {
            defaultValue:
              pendingLogs.length > 0
                ? 'Add more activities or review the stack below before saving.'
                : 'Tap a chip to add it to today, then save the stack together.',
          })}
          onSelect={(type) => {
            setSelectedLogType(type);
            // Sheet vs inline modal is the shared canOpenQuickLogSheet policy;
            // a manual tap never carries a prefill.
            setQuickLogPrefill(null);
            if (canOpenQuickLogSheet(type, { allFarmsSelected: isAllFarmsSelected })) {
              setQuickLogValid(false);
              setQuickLogType(type);
            } else {
              setShowLogFormModal(true);
            }
          }}
        />
      </GuidedTourTarget>
      {pendingLogs.length === 0 && !selectedLogType && repeatLastLogSuggestion && (
        <RepeatLastLog
          date={repeatLastLogSuggestion.date}
          items={repeatLastLogSuggestion.items}
          onAdd={handleRepeatLastLog}
        />
      )}
      {pendingLogs.length === 0 && !selectedLogType && !repeatLastLogSuggestion && (
        <View
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            borderRadius: radius.lg,
            paddingHorizontal: 16,
            paddingVertical: 18,
            marginBottom: 16,
            alignItems: 'center',
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.72),
          }}
        >
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '700',
              color: m3.colorScheme.onSurface,
              textAlign: 'center',
            }}
          >
            {t('entryForm.emptyStackTitle', { defaultValue: 'Tap a chip above to start' })}
          </Text>
          <Text
            selectable
            style={{
              marginTop: 4,
              fontSize: fontSize.xs,
              lineHeight: 17,
              color: m3.colorScheme.onSurfaceVariant,
              textAlign: 'center',
            }}
          >
            {t('entryForm.emptyStackBody', {
              defaultValue: 'Add one or more activities, then save them together.',
            })}
          </Text>
        </View>
      )}
      <PendingLogs
        pendingLogs={pendingLogs}
        failures={pendingLogFailures}
        onRemove={removeLogFromSession}
      />
    </>
  );

  const renderTaskContent = () => (
    <>
      {!isEditingTask && (
        <Pressable
          onPress={() => setShowTemplates(!showTemplates)}
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            borderRadius: radius.md,
            padding: 16,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <AppIcon name="flash" size={20} color={m3.colorScheme.primary} />
          <Text
            selectable
            style={{ color: m3.colorScheme.primary, fontWeight: '500', marginLeft: 8, flex: 1 }}
          >
            {t('entryForm.useTemplate')}
          </Text>
          <AppIcon
            name={showTemplates ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={m3.colorScheme.primary}
          />
        </Pressable>
      )}

      {showTemplates && (
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: radius.md,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            overflow: 'hidden',
          }}
        >
          <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ maxHeight: 300 }}>
            {TASK_TEMPLATES.slice(0, 8).map((template) => {
              const typeInfo = TASK_TYPE_INFO[template.type];
              return (
                <Pressable
                  key={template.id}
                  onPress={() => applyTemplate(template)}
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderColor: m3.surface.s100,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${typeInfo.color}20`,
                    }}
                  >
                    <AppIcon name={typeInfo.icon} size={16} color={typeInfo.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      selectable
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: '500',
                        color: m3.colorScheme.onSurface,
                      }}
                    >
                      {template.title}
                    </Text>
                    <Text
                      selectable
                      style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                      numberOfLines={1}
                    >
                      {template.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!hasCallerProvidedFarm && !lockFarmSelection && !isSingleFarmAccount && (
        <View style={{ marginBottom: 16 }}>
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            {t('entryForm.farmLabel')}
          </Text>
          <Pressable
            onPress={() => setShowTaskFarmPicker(!showTaskFarmPicker)}
            style={{
              backgroundColor: m3.surface.s100,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={20} color={m3.colorScheme.primary} />
              <Text
                selectable
                style={{ fontSize: fontSize.base, color: m3.colorScheme.onSurface, marginLeft: 8 }}
              >
                {selectedTaskFarm?.name || t('entryForm.selectFarm')}
              </Text>
            </View>
            <AppIcon
              name="chevron-down"
              size={20}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
          <OptionPickerSheet
            visible={showTaskFarmPicker}
            onClose={() => setShowTaskFarmPicker(false)}
            title={t('entryForm.selectFarm')}
            selectedKey={taskFarmId?.toString() ?? null}
            options={(farms ?? [])
              .filter((f) => f.id)
              .map((f) => ({ key: String(f.id), label: f.name }))}
            onSelect={(key) => setTaskFarmId(Number(key))}
          />
        </View>
      )}

      <View style={{ marginBottom: 16 }}>
        <Text
          selectable
          style={{
            fontSize: fontSize.sm,
            fontWeight: '500',
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: 8,
          }}
        >
          {t('entryForm.taskForm.titleLabel')}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('entryForm.taskForm.titlePlaceholder')}
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: componentRadius.input,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurface,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          }}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text
          selectable
          style={{
            fontSize: fontSize.sm,
            fontWeight: '500',
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: 8,
          }}
        >
          {t('entryForm.taskForm.descriptionLabel')}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('entryForm.taskForm.descriptionPlaceholder')}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: componentRadius.input,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: fontSize.base,
            color: m3.colorScheme.onSurface,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            minHeight: 80,
            textAlignVertical: 'top' as const,
          }}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            {t('entryForm.taskForm.typeLabel')}
          </Text>
          <Pressable
            onPress={() => setShowTypePicker(true)}
            style={{
              backgroundColor: m3.surface.s100,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              height: 48,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon
                name={TASK_TYPE_INFO[type].icon}
                size={16}
                color={TASK_TYPE_INFO[type].color}
              />
              <Text
                selectable
                style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface, marginLeft: 8 }}
              >
                {t(TASK_TYPE_INFO[type].labelKey)}
              </Text>
            </View>
            <AppIcon
              name="chevron-down"
              size={16}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            {t('entryForm.taskForm.priorityLabel')}
          </Text>
          <Pressable
            onPress={() => setShowPriorityPicker(true)}
            style={{
              backgroundColor: m3.surface.s100,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              height: 48,
            }}
          >
            <View
              style={[
                { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
                { backgroundColor: PRIORITY_INFO[priority].bgColor },
              ]}
            >
              <Text
                selectable
                style={[
                  { fontSize: fontSize.sm, fontWeight: '500' },
                  { color: PRIORITY_INFO[priority].color },
                ]}
              >
                {t(PRIORITY_INFO[priority].labelKey)}
              </Text>
            </View>
            <AppIcon
              name="chevron-down"
              size={16}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
        </View>
      </View>

      {(type === 'spray' || type === 'fertigation') && (
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: radius.md,
            padding: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          }}
        >
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '600',
              color: m3.colorScheme.onSurface,
              marginBottom: 10,
            }}
          >
            {type === 'spray'
              ? t('entryForm.plannedSprayInputs')
              : t('entryForm.plannedFertilizers')}
          </Text>

          {taskPlanningSuggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {taskPlanningSuggestions.map((item) => (
                <Pressable
                  key={`${item.name}-${item.unit ?? 'unit'}-${item.source ?? 'source'}`}
                  onPress={() => addTaskPlannedInput(item)}
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: m3.surface.s50,
                    borderWidth: 1,
                    borderColor: m3.surface.s200,
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurface }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.unit ?? (type === 'spray' ? 'gm/L' : 'kg')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              value={plannedItemName}
              onChangeText={setPlannedItemName}
              placeholder={t('entryForm.plannedItemNamePlaceholder')}
              style={{
                flex: 2,
                backgroundColor: m3.surface.s50,
                borderRadius: componentRadius.input,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: m3.surface.s200,
                color: m3.colorScheme.onSurface,
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
            <TextInput
              value={plannedItemQty}
              onChangeText={setPlannedItemQty}
              placeholder={t('entryForm.plannedItemQtyPlaceholder')}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                backgroundColor: m3.surface.s50,
                borderRadius: componentRadius.input,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: m3.surface.s200,
                color: m3.colorScheme.onSurface,
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
            <TextInput
              value={plannedItemUnit}
              onChangeText={setPlannedItemUnit}
              placeholder={type === 'spray' ? t('units.gmPerLiter') : t('units.kgPerAcre')}
              style={{
                flex: 1,
                backgroundColor: m3.surface.s50,
                borderRadius: componentRadius.input,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: m3.surface.s200,
                color: m3.colorScheme.onSurface,
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
            <Pressable
              onPress={addCustomTaskPlannedInput}
              disabled={!plannedItemName.trim()}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10,
                borderRadius: radius.md,
                backgroundColor: plannedItemName.trim()
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              }}
            >
              <AppIcon
                name="plus"
                size={16}
                color={
                  plannedItemName.trim()
                    ? m3.colorScheme.onPrimary
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                }
              />
            </Pressable>
          </View>

          {taskPlannedInputs.length > 0 && (
            <View style={{ gap: 6 }}>
              {taskPlannedInputs.map((item) => (
                <View
                  key={`${item.name}-${item.unit ?? 'unit'}-${item.source ?? 'source'}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: m3.surface.s50,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: m3.surface.s200,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                      {item.quantity ? `${item.quantity} ` : ''}
                      {item.unit ?? ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeTaskPlannedInput(item)}>
                    <AppIcon
                      name="close-circle"
                      size={18}
                      color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ marginBottom: 16 }}>
        <DateField
          value={dueDate ? (parseDbDateToLocalDate(dueDate) ?? null) : null}
          onChange={(date) => setDueDate(formatLocalDate(date))}
          label={t('entryForm.taskForm.selectDueDateTitle')}
        />
        {dueDate ? (
          <Pressable
            onPress={() => setDueDate('')}
            accessibilityRole="button"
            accessibilityLabel={t('farmForm.header.clearDate')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              marginTop: spacing[2],
              gap: spacing[1],
            }}
          >
            <AppIcon
              name="close-circle"
              size={18}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
            <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
              {t('farmForm.header.clearDate')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );

  useEffect(() => {
    if (presentation !== 'screen' || activeTab !== 'log') return;
    // When a quick type is open, the QuickLogSheet owns the form state, so its
    // validity pulse (quickLogValid) is what the tour coach needs — the inline
    // isLogFormValid reads the unused inline drafts and would stay false.
    const currentLogValid = quickLogType ? quickLogValid : isLogFormValid;
    guidedTourEmit('guidedTour.addLogSelectionState', {
      hasSelection: selectedLogType !== null,
      hasPendingDrafts: pendingLogs.length > 0,
      isCurrentLogValid: selectedLogType !== null ? currentLogValid : false,
      ...(selectedLogType ? { recordType: selectedLogType } : {}),
    });
  }, [
    activeTab,
    isLogFormValid,
    pendingLogs.length,
    presentation,
    selectedLogType,
    quickLogType,
    quickLogValid,
  ]);

  useEffect(() => {
    // Fires for whichever surface hosts the form — the inline modal or the
    // QuickLogSheet (the shared form components inside the sheet carry their
    // own focus listeners).
    if (
      guidedTourStatus !== 'in_progress' ||
      guidedTourStep !== 'add_log' ||
      (!showLogFormModal && quickLogType == null) ||
      !selectedLogType
    ) {
      return;
    }

    const timer = setTimeout(() => {
      guidedTourEmit('guidedTour.focusLogActivityInput', { recordType: selectedLogType });
    }, 180);

    return () => clearTimeout(timer);
  }, [guidedTourStatus, guidedTourStep, showLogFormModal, quickLogType, selectedLogType]);

  const content = (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={isIOS ? 0 : 20}
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      >
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderBottomWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
            paddingHorizontal: 16,
            paddingBottom: 10,
            paddingTop: (isScreenPresentation ? 2 : 6) + insets.top,
          }}
        >
          {!isScreenPresentation ? (
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <View
                style={{
                  width: 42,
                  height: 5,
                  borderRadius: radius.full,
                  backgroundColor: m3.surface.s50,
                }}
              />
            </View>
          ) : null}
          <View style={{ minHeight: 40, justifyContent: 'center', position: 'relative' }}>
            <View style={{ paddingHorizontal: 52, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                selectable
                style={{
                  fontSize: fontSize['2xl'],
                  lineHeight: 28,
                  fontWeight: '700',
                  color: m3.colorScheme.onSurface,
                  textAlign: 'center',
                  ...(Platform.OS === 'android'
                    ? {
                        includeFontPadding: true,
                        paddingBottom: androidTextPadding.bottom,
                        paddingRight: androidTextPadding.right,
                      }
                    : null),
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {activeTab === 'log'
                  ? t('entryForm.addLog')
                  : isEditingTask
                    ? t('entryForm.editTask')
                    : t('entryForm.addTask')}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon
                name="close-circle"
                size={26}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          </View>
          <View style={{ marginTop: 4, alignItems: 'center', minHeight: 20 }}>
            <Text
              selectable
              style={{
                fontSize: fontSize.sm,
                lineHeight: 18,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {activeFarm?.name ||
                (activeTab === 'log'
                  ? t('entryForm.logSubtitle', {
                      defaultValue: 'Choose a log type, then save your drafts together.',
                    })
                  : t('entryForm.taskSubtitle', {
                      defaultValue: 'Plan a task with due date, priority, and farm details.',
                    }))}
            </Text>
          </View>
        </View>

        <Tabs tabs={resolvedTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <BottomSheet
          index={showTypePicker ? 0 : -1}
          enableDynamicSizing
          enablePanDownToClose
          onClose={() => setShowTypePicker(false)}
          backgroundStyle={{ backgroundColor: m3.surface.s100 }}
        >
          <View style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                selectable
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: '700',
                  color: m3.colorScheme.onSurface,
                }}
              >
                {t('entryForm.selectTaskType')}
              </Text>
              <Pressable onPress={() => setShowTypePicker(false)}>
                <AppIcon
                  name="close"
                  size={24}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                />
              </Pressable>
            </View>
            <BottomSheetScrollView
              contentInsetAdjustmentBehavior="automatic"
              style={{ maxHeight: 320 }}
            >
              {TASK_TYPES.map((taskType) => (
                <Pressable
                  key={taskType}
                  onPress={() => {
                    setType(taskType);
                    setShowTypePicker(false);
                  }}
                  style={{
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderColor: m3.surface.s100,
                    backgroundColor:
                      type === taskType
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : m3.surface.s100,
                  }}
                >
                  <AppIcon
                    name={TASK_TYPE_INFO[taskType].icon}
                    size={18}
                    color={TASK_TYPE_INFO[taskType].color}
                  />
                  <Text
                    selectable
                    style={{
                      marginLeft: 12,
                      color:
                        type === taskType
                          ? m3.colorScheme.primary
                          : m3.colorScheme.onSurfaceVariant,
                      fontWeight: type === taskType ? '500' : '400',
                    }}
                  >
                    {t(TASK_TYPE_INFO[taskType].labelKey)}
                  </Text>
                </Pressable>
              ))}
            </BottomSheetScrollView>
          </View>
        </BottomSheet>

        <BottomSheet
          index={showPriorityPicker ? 0 : -1}
          enableDynamicSizing
          enablePanDownToClose
          onClose={() => setShowPriorityPicker(false)}
          backgroundStyle={{ backgroundColor: m3.surface.s100 }}
        >
          <View style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                selectable
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: '700',
                  color: m3.colorScheme.onSurface,
                }}
              >
                {t('entryForm.selectPriority')}
              </Text>
              <Pressable onPress={() => setShowPriorityPicker(false)}>
                <AppIcon
                  name="close"
                  size={24}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                />
              </Pressable>
            </View>
            {PRIORITIES.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  setPriority(p);
                  setShowPriorityPicker(false);
                }}
                style={{
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: 1,
                  borderColor: m3.surface.s100,
                  backgroundColor:
                    priority === p
                      ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                      : m3.surface.s100,
                }}
              >
                <View
                  style={[
                    {
                      width: 28,
                      height: 28,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    { backgroundColor: PRIORITY_INFO[p].bgColor },
                  ]}
                >
                  <Text
                    selectable
                    style={[
                      { fontSize: fontSize.xs, fontWeight: '700' },
                      { color: PRIORITY_INFO[p].color },
                    ]}
                  >
                    {p.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  selectable
                  style={{
                    marginLeft: 12,
                    color:
                      priority === p ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant,
                    fontWeight: priority === p ? '500' : '400',
                  }}
                >
                  {t(PRIORITY_INFO[p].labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </BottomSheet>

        <ScrollView
          ref={contentScrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: footerHeight + insets.bottom + 24,
          }}
          scrollIndicatorInsets={{ bottom: footerHeight + insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={true}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {activeTab === 'log' ? renderLogContent() : renderTaskContent()}
        </ScrollView>

        {activeTab === 'log' && renderLogFormModal()}

        {/* Dashboard quick-log sheet (draft mode) for irrigation/spray/harvest/
            expense — same component the dashboard home uses, opened from the log
            type chips. Fertigation + note stay on the inline modal above. */}
        {activeTab === 'log' && (
          <QuickLogSheet
            type={quickLogType}
            farm={activeFarm ?? null}
            date={{ value: selectedDate, onChange: setSelectedDate }}
            initialDraft={quickLogPrefill}
            onClose={() => {
              setQuickLogType(null);
              setQuickLogPrefill(null);
              setSelectedLogType(null);
            }}
            onSubmitDraft={handleQuickLogDraft}
            onValidityChange={setQuickLogValid}
          />
        )}

        {/* Sticky Add Entry button above keyboard */}
        {activeTab === 'log' &&
          isKeyboardVisible &&
          !showLogFormModal &&
          !quickLogType &&
          renderStickyAddButton()}

        <View
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setFooterHeight((prev) => (prev === nextHeight ? prev : nextHeight));
          }}
          style={{
            flexShrink: 0,
            backgroundColor: m3.surface.s100,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[4],
            paddingBottom: Math.max(spacing[4], insets.bottom),
            borderTopWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
          }}
        >
          {activeTab === 'log' ? (
            <>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <Pressable
                  onPress={handleClose}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: borderRadius.xl,
                    borderWidth: 1,
                    borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    alignItems: 'center',
                    backgroundColor: m3.surface.s50,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <GuidedTourTarget
                  targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE}
                  style={{ flex: 1 }}
                >
                  <Pressable
                    onPress={saveAllLogs}
                    disabled={!canSaveLogs}
                    style={[
                      {
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: borderRadius.xl,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                      },
                      {
                        backgroundColor: canSaveLogs
                          ? m3.colorScheme.primary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                      },
                      showSaveGuidance
                        ? {
                            borderWidth: 2,
                            borderColor: colorWithOpacity(m3.colorScheme.primary, 0.7),
                          }
                        : null,
                    ]}
                  >
                    {isSubmittingLogs ? (
                      <Spinner size="small" color={m3.colorScheme.onPrimary} />
                    ) : (
                      <>
                        <AppIcon
                          name="save"
                          size={18}
                          color={
                            canSaveLogs
                              ? m3.colorScheme.onPrimary
                              : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                          }
                        />
                        <Text
                          selectable
                          style={[
                            { marginLeft: 8, fontWeight: '700', flexShrink: 1 },
                            {
                              color: canSaveLogs
                                ? m3.colorScheme.onPrimary
                                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                            },
                          ]}
                        >
                          {pendingLogs.length > 0
                            ? Object.keys(pendingLogFailures).length > 0
                              ? t('entryForm.retrySaveLogs', {
                                  count: pendingLogs.length,
                                  defaultValue: `Retry save (${pendingLogs.length})`,
                                })
                              : t('entryForm.saveLogs', {
                                  count: pendingLogs.length,
                                  defaultValue: `Save ${pendingLogs.length} log${pendingLogs.length === 1 ? '' : 's'}`,
                                })
                            : t('common.save')}
                        </Text>
                        {pendingLogs.length > 1 && canSaveLogs ? (
                          <View
                            style={{
                              marginLeft: 8,
                              minWidth: 24,
                              height: 22,
                              borderRadius: radius.full,
                              paddingHorizontal: 7,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: colorWithOpacity(m3.colorScheme.onPrimary, 0.18),
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                fontWeight: '700',
                                color: m3.colorScheme.onPrimary,
                              }}
                            >
                              {pendingLogs.length}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                </GuidedTourTarget>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleClose}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  alignItems: 'center',
                }}
              >
                <Text
                  selectable
                  style={{ fontWeight: '600', color: m3.colorScheme.onSurfaceVariant }}
                >
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleTaskSubmit}
                disabled={!isTaskValid || isTaskSaving}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  },
                  {
                    backgroundColor:
                      isTaskValid && !isTaskSaving
                        ? m3.colorScheme.primary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  },
                ]}
              >
                {isTaskSaving ? (
                  <Spinner size="small" color={m3.colorScheme.onPrimary} />
                ) : (
                  <>
                    <AppIcon
                      name="save"
                      size={18}
                      color={
                        isTaskValid
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                      }
                    />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600', flexShrink: 1 },
                        {
                          color: isTaskValid
                            ? m3.colorScheme.onPrimary
                            : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                        },
                      ]}
                    >
                      {t('common.save')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  if (presentation === 'screen') {
    return content;
  }

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
      {content}
    </Modal>
  );
}
