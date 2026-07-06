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
  ActivityIndicator,
  type TextInputProps,
  Keyboard,
  Platform,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { AppIcon } from '@/components/ui/app-icon';
import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient as _LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { useM3 } from '@/styles/use-theme';
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
import {
  PendingLogs,
  type PendingLog,
  type PendingLogFailure,
} from '@/components/screens/entry-form/PendingLogs';
import { Tabs, type EntryTab } from '@/components/screens/entry-form/Tabs';
import { LogForm } from '@/components/screens/entry-form/LogForm';
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
  type SprayQuickAddItem,
  type FertigationQuickAddItem,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
  type NoteFormData,
} from '@/components/forms';
import {
  LOG_TYPES,
  type LogTypeId,
  HARVEST_GRADES,
  CHEMICAL_UNITS,
} from '@/constants/calculator-models';
import { resolveFertigationPrefill, resolveFertigationUnit } from '@/constants/fertilizer-units';
import { fertigationChipForEntry } from '@/components/forms/fertigation-unit-chips';
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
  useUpdateFarmWaterLevel,
  useFarms,
  useFarmAreaAcres,
  useWarehouseItems,
  useRecentSprayChemicals,
  useRecentFertigationItems,
  useUpsertDailyNote,
  useDeleteDailyNote,
  useFarmSeasonStatus,
  useChemicalMixSearch,
  usePhiComputation,
  useFertilizerPlan,
  useMasterProducts,
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
import { mapExpenseRecordTypeToTypeId } from '@/utils/expense-type';
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
import { isPhiConflict } from '@/services/phi-service';
import { supabase } from '@/lib/supabase';

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

function isValidChemicalUnit(unit: string): unit is SprayFormData['chemicals'][number]['unit'] {
  return CHEMICAL_UNITS.includes(unit as SprayFormData['chemicals'][number]['unit']);
}

// Fertigation unit resolution goes through the quantity kernel
// (`resolveFertigationUnit` / `resolveFertigationPrefill` in
// `@/constants/fertilizer-units`) — unknown unit strings stay verbatim and are
// never coerced to kg (issue #192).

function inferWarehouseFertilizerQuantityBasis(
  unit: string | null | undefined,
): 'per_acre' | undefined {
  if (typeof unit !== 'string') return undefined;
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.includes('/acre') || normalized.includes('per acre') ? 'per_acre' : undefined;
}

function normalizeSprayDoseUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (
    normalized === 'gm/liter' ||
    normalized === 'gm/litre' ||
    normalized === 'gm/l' ||
    normalized === 'g/l'
  ) {
    return 'gm/L';
  }
  if (normalized === 'ml/liter' || normalized === 'ml/litre' || normalized === 'ml/l') {
    return 'ml/L';
  }
  if (normalized === 'gm/acre') return 'gram';
  if (normalized === 'ml/acre') return 'ml';
  return unit.trim();
}

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

function createPrefillId(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}`;
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
  const isInlineComposerMode = isScreenPresentation;
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
  const { data: sprayWarehouseItems } = useWarehouseItems('spray');
  const { data: fertilizerWarehouseItems } = useWarehouseItems('fertilizer');
  const { data: recentSprayChemicals } = useRecentSprayChemicals(logFarmId ?? undefined);
  const { data: recentFertigationItems } = useRecentFertigationItems(logFarmId ?? undefined);
  const { data: fertilizerPlan } = useFertilizerPlan(logFarmId ?? undefined);
  const { activeSeason } = useFarmSeasonStatus(logFarmId ?? undefined);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<LogTypeId | null>(null);
  const [showLogFormModal, setShowLogFormModal] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [pendingLogFailures, setPendingLogFailures] = useState<Record<string, PendingLogFailure>>(
    {},
  );
  const [isSubmittingLogs, setIsSubmittingLogs] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(112);
  const contentScrollViewRef = useRef<ScrollView>(null);
  const logFormScrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: undefined });
  // Fertilizers are mostly applied through irrigation, so the irrigation entry can optionally
  // carry a fertigation log. When on, the fertigation section (reusing `fertigationData`) is
  // shown inside the irrigation flow and saved as a linked record.
  const [irrigationIncludesFertilizers, setIrrigationIncludesFertilizers] = useState(false);
  // Fertilizer catalog for the fertigation picker's catalog section. Includes
  // biostimulants (fertigation-applied), matching the warehouse fertilizer
  // grouping; the section simply hides when the catalog has no rows. Fetched
  // only when a flow that mounts the fertigation form is active (irrigation
  // embeds it behind the include-fertilizers toggle).
  const { data: fertilizerCatalogProducts = [] } = useMasterProducts({
    inputTypes: ['fertilizer', 'biostimulant'],
    stateCode: null,
    enabled:
      selectedLogType === 'fertigation' ||
      (selectedLogType === 'irrigation' && irrigationIncludesFertilizers),
  });
  const [sprayData, setSprayData] = useState<SprayFormData>(() => createEmptySprayFormData());
  const [harvestData, setHarvestData] = useState<HarvestFormData>(() =>
    createEmptyHarvestFormData(),
  );
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(() =>
    createEmptyExpenseFormData(),
  );
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(() =>
    createEmptyFertigationFormData(),
  );
  // The irrigation flow's inline fertilizer section keeps its own draft, separate from the
  // standalone Fertigation tab's `fertigationData`, so toggling fertilizers on an irrigation
  // entry never reads or clears an in-progress standalone fertigation draft (and vice versa).
  const [irrigationFertigationData, setIrrigationFertigationData] = useState<FertigationFormData>(
    () => createEmptyFertigationFormData(),
  );
  const [noteData, setNoteData] = useState<NoteFormData>(() => createEmptyNoteFormData());
  const selectedDateIso = useMemo(() => toSupabaseDateString(selectedDate), [selectedDate]);
  const { data: sprayPhiComputation } = usePhiComputation(
    sprayData.catalogMixId ?? null,
    selectedDateIso,
  );
  const [taskPlannedInputs, setTaskPlannedInputs] = useState<PlannedInputItem[]>([]);
  const [plannedItemName, setPlannedItemName] = useState('');
  const [plannedItemQty, setPlannedItemQty] = useState('');
  const [plannedItemUnit, setPlannedItemUnit] = useState('');

  const sprayQuickAddItems = useMemo<SprayQuickAddItem[]>(() => {
    const byWarehouse = (sprayWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: undefined,
      quantity: null,
      quantityBasis: undefined,
      warehouseItemId: item.id ?? null,
      catalogProductId: item.catalog_product_id ?? null,
      composition: item.composition ?? null,
      densityKgPerL: item.density_kg_per_l ?? null,
    }));
    const byRecent = (recentSprayChemicals ?? []).map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity ?? null,
      quantityBasis: undefined,
    }));
    const deduped = new Map<string, SprayQuickAddItem>();
    [...byWarehouse, ...byRecent].forEach((item) => {
      const key = `${item.name.trim().toLowerCase()}::${(item.unit ?? '').trim().toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, item);
        return;
      }
      if (
        (existing.quantity === null || existing.quantity === undefined) &&
        item.quantity != null
      ) {
        deduped.set(key, {
          ...existing,
          quantity: item.quantity,
          quantityBasis: item.quantityBasis ?? existing.quantityBasis,
        });
      }
    });
    return Array.from(deduped.values()).slice(0, 15);
  }, [sprayWarehouseItems, recentSprayChemicals]);

  useEffect(() => {
    if (!sprayPhiComputation) return;
    setSprayData((prev) => {
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

  const fertigationQuickAddItems = useMemo<FertigationQuickAddItem[]>(() => {
    const byPlan = (fertilizerPlan?.items ?? []).map((item) => {
      // Plan doses are per-acre rates by contract: bare form units ('kg') keep
      // per_acre; unrepresentable/unknown units stay verbatim with the sniffed
      // basis (resolveFertigationPrefill — same path as plan one-tap prefill).
      const prefill = resolveFertigationPrefill(item.unit);
      return {
        name: item.name,
        unit: prefill.unit,
        quantity: item.quantity ?? null,
        quantityBasis: prefill.quantityBasis,
        warehouseItemId: null,
        catalogProductId: null,
        planItemId: item.id,
      };
    });
    const byWarehouse = (fertilizerWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: resolveFertigationUnit(item.unit).unit,
      quantity: null,
      quantityBasis: inferWarehouseFertilizerQuantityBasis(item.unit),
      warehouseItemId: item.id ?? null,
      catalogProductId: item.catalog_product_id ?? null,
      composition: item.composition ?? null,
      densityKgPerL: item.density_kg_per_l ?? null,
    }));
    const byRecent = (recentFertigationItems ?? []).map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity ?? null,
      // History carries its own basis — a total logged as bare 'kg' must not
      // re-enter as a rate (or vice versa) now that chips fuse unit + basis.
      quantityBasis: item.quantityBasis,
    }));
    const deduped = new Map<string, FertigationQuickAddItem>();
    [...byPlan, ...byWarehouse, ...byRecent].forEach((item) => {
      // Dedupe on fused chip identity (unit + basis), not the unit string —
      // 'kg total' and 'kg/acre' both store unit 'kg' but are distinct chips.
      // Outside the chip vocabulary, fall back to unit + raw basis.
      const unitKey = (item.unit ?? '').trim().toLowerCase();
      const chipKey =
        fertigationChipForEntry(item.unit ?? '', item.quantityBasis)?.key ??
        `${unitKey}::${item.quantityBasis ?? ''}`;
      const key = `${item.name.trim().toLowerCase()}::${chipKey}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, item);
        return;
      }
      if (
        (existing.quantity === null || existing.quantity === undefined) &&
        item.quantity != null
      ) {
        deduped.set(key, {
          ...existing,
          quantity: item.quantity,
          quantityBasis: item.quantityBasis ?? existing.quantityBasis,
        });
      }
    });
    return Array.from(deduped.values()).slice(0, 15);
  }, [fertilizerPlan, fertilizerWarehouseItems, recentFertigationItems]);

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
  const updateWaterLevel = useUpdateFarmWaterLevel();

  const scrollToNode = useCallback(
    (nodeHandle: number) => {
      if (!keyboardHeightRef.current) return;
      const resolvedHandle = findNodeHandle(nodeHandle) ?? nodeHandle;
      if (typeof resolvedHandle !== 'number') return;
      // In screen/inline mode the focused input lives inside the main content
      // ScrollView; in modal mode it lives inside the dedicated log-form ScrollView.
      const activeScrollView = isInlineComposerMode ? contentScrollViewRef : logFormScrollViewRef;
      UIManager.measureInWindow(resolvedHandle, (_x, y, _width, height) => {
        const keyboardTop = windowHeight - keyboardHeightRef.current;
        const inputBottom = y + height;
        const buffer = 24;
        if (inputBottom > keyboardTop - buffer) {
          const scrollBy = inputBottom - (keyboardTop - buffer);
          activeScrollView.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + scrollBy),
            animated: true,
          });
        }
      });
    },
    [windowHeight, isInlineComposerMode],
  );

  // Track keyboard visibility
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      setIsKeyboardVisible(true);
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [scrollToNode]);

  // Set initial log type if provided
  useEffect(() => {
    if (isVisible && initialLogType) {
      setSelectedLogType(initialLogType);
      setShowLogFormModal(!isInlineComposerMode);
      if (initialLogType === 'spray' && initialLogPrefill?.sprayChemicals?.length) {
        setSprayData({
          waterVolume: undefined,
          chemicals: initialLogPrefill.sprayChemicals.map((item) => {
            const normalizedUnit = item.unit ? normalizeSprayDoseUnit(item.unit) : null;
            const unit =
              normalizedUnit && isValidChemicalUnit(normalizedUnit) ? normalizedUnit : 'gm/L';
            return {
              id: `chem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: item.name,
              quantity: item.quantity ?? undefined,
              unit,
              quantityBasis:
                item.quantityBasis ??
                (item.unit?.trim().toLowerCase().includes('/acre') ? 'per_acre' : 'total'),
            };
          }),
        });
      }
      if (initialLogType === 'fertigation' && initialLogPrefill?.fertigationItems?.length) {
        setFertigationData({
          waterVolume: undefined,
          fertilizers: initialLogPrefill.fertigationItems.map((item) => {
            const { unit, quantityBasis } = resolveFertigationPrefill(item.unit);
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              name: item.name,
              quantity: item.quantity ?? 0,
              unit,
              quantityBasis,
              // plan_item_id linkage: plan one-tap prefill carries planItemId so
              // the submitted record can reference the prescription (issue #197).
              planItemId: item.planItemId ?? null,
            };
          }),
        });
      }
    }
  }, [isVisible, initialLogType, initialLogPrefill, isInlineComposerMode]);

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

  useEffect(() => {
    if (!isVisible) return;
    if (initialIrrigationDurationHours && initialIrrigationDurationHours > 0) {
      setIrrigationData((prev) => ({
        ...prev,
        duration: initialIrrigationDurationHours,
      }));
    }
  }, [isVisible, initialIrrigationDurationHours]);

  useEffect(() => {
    if (!isVisible || !initialVoiceLogPrefill) return;

    setSelectedLogType(initialVoiceLogPrefill.type);
    setShowLogFormModal(!isInlineComposerMode);

    const prefillDate = parseInitialLogDate(initialVoiceLogPrefill.date);
    if (prefillDate) {
      setSelectedDate(prefillDate);
    }

    switch (initialVoiceLogPrefill.type) {
      case 'irrigation': {
        const duration = initialVoiceLogPrefill.irrigation?.durationHours;
        if (duration && duration > 0) {
          setIrrigationData({ duration });
        }
        break;
      }
      case 'spray': {
        const sprayPrefill = initialVoiceLogPrefill.spray;
        const prefilledChemicals = sprayPrefill?.chemicals?.length
          ? sprayPrefill.chemicals.map((item, index) => {
              const normalizedUnit = item.unit ? normalizeSprayDoseUnit(item.unit) : null;
              const unit =
                normalizedUnit &&
                CHEMICAL_UNITS.includes(normalizedUnit as (typeof CHEMICAL_UNITS)[number])
                  ? (normalizedUnit as (typeof CHEMICAL_UNITS)[number])
                  : 'gm/L';
              return {
                id: createPrefillId('chem', index),
                name: item.name ?? '',
                quantity: item.quantity ?? undefined,
                unit,
                quantityBasis:
                  item.quantityBasis ??
                  (item.unit?.trim().toLowerCase().includes('/acre') ? 'per_acre' : 'total'),
              };
            })
          : createEmptySprayFormData().chemicals;

        setSprayData({
          waterVolume: sprayPrefill?.waterVolume ?? undefined,
          chemicals: prefilledChemicals,
        });
        break;
      }
      case 'harvest': {
        const harvestPrefill = initialVoiceLogPrefill.harvest;
        const grade =
          harvestPrefill?.grade &&
          HARVEST_GRADES.includes(harvestPrefill.grade as (typeof HARVEST_GRADES)[number])
            ? (harvestPrefill.grade as (typeof HARVEST_GRADES)[number])
            : '';
        setHarvestData({
          quantity: harvestPrefill?.quantity ?? undefined,
          grade,
          price: harvestPrefill?.price ?? undefined,
          buyer: harvestPrefill?.buyer ?? undefined,
        });
        break;
      }
      case 'expense': {
        const expensePrefill = initialVoiceLogPrefill.expense;
        const expenseType = mapExpenseRecordTypeToTypeId(expensePrefill?.expenseType, '');
        setExpenseData({
          type: expenseType,
          cost: expensePrefill?.cost ?? undefined,
          remarks: expensePrefill?.remarks ?? undefined,
        });
        break;
      }
      case 'fertigation': {
        const fertigationPrefill = initialVoiceLogPrefill.fertigation;
        const prefilledFertilizers = fertigationPrefill?.fertilizers?.length
          ? fertigationPrefill.fertilizers.map((item) => {
              const { unit, quantityBasis } = resolveFertigationPrefill(item.unit);
              return {
                name: item.name ?? '',
                quantity: item.quantity ?? undefined,
                unit,
                quantityBasis,
              };
            })
          : createEmptyFertigationFormData().fertilizers;

        setFertigationData({
          waterVolume: fertigationPrefill?.waterVolume ?? undefined,
          fertilizers: prefilledFertilizers,
        });
        break;
      }
    }
  }, [initialVoiceLogPrefill, isVisible, isInlineComposerMode]);

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

  const isLogFormValid = useMemo(() => {
    if (!selectedLogType) return false;
    switch (selectedLogType) {
      case 'irrigation':
        return validateIrrigationForm(irrigationData);
      case 'spray':
        return validateSprayForm(sprayData);
      case 'harvest':
        return validateHarvestForm(harvestData);
      case 'expense':
        return validateExpenseForm(expenseData);
      case 'fertigation':
        return validateFertigationForm(fertigationData);
      case 'note':
        return validateNoteForm(noteData);
      default:
        return false;
    }
  }, [
    selectedLogType,
    irrigationData,
    sprayData,
    harvestData,
    expenseData,
    fertigationData,
    noteData,
  ]);

  // Bind the inline fertilizer form to the irrigation-only draft when logging irrigation;
  // the standalone Fertigation tab keeps using `fertigationData`.
  const activeFertigationData =
    selectedLogType === 'irrigation' ? irrigationFertigationData : fertigationData;
  const handleActiveFertigationChange =
    selectedLogType === 'irrigation' ? setIrrigationFertigationData : setFertigationData;

  const hasFarmForCurrentLog = Boolean(
    activeFarm || (isAllFarmsSelected && selectedLogType === 'expense'),
  );
  const hasFarmForPendingSession = Boolean(activeFarm || isAllFarmsSelected);
  const canSubmitLog = Boolean(isLogFormValid && hasFarmForCurrentLog);
  const canSaveLogs = Boolean(
    pendingLogs.length > 0 && !isSubmittingLogs && hasFarmForPendingSession,
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
        if (mixName) {
          return `${mixName} • ${spray.waterVolume}L`;
        }
        const chemCount = spray.chemicals.length;
        return `${spray.waterVolume}L water, ${chemCount} chemical${chemCount !== 1 ? 's' : ''}`;
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
        const waterText = fert.waterVolume ? `${fert.waterVolume}L water, ` : '';
        return `${waterText}${fertCount} fertilizer${fertCount !== 1 ? 's' : ''}`;
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

  const buildSprayPendingData = useCallback(
    (input: SprayFormData): SprayFormData =>
      isGrapeFarm && input.catalogMixId && input.safeHarvestDate && input.governingPhiDays != null
        ? {
            ...input,
          }
        : {
            ...input,
            governingPhiDays: null,
            safeHarvestDate: null,
            phiBlockingComponent: null,
            phiStatus: input.phiStatus ?? (input.catalogMixId ? 'legacy_unverified' : 'unknown'),
          },
    [isGrapeFarm],
  );

  const addLogToSession = useCallback(() => {
    if (!selectedLogType || !isLogFormValid) return;
    if (!activeFarm && !isAllFarmsSelected) return;
    if (isAllFarmsSelected && selectedLogType !== 'expense') return;

    // Irrigation with attached fertilizers: enqueue both, linking the fertigation log to the
    // irrigation log so the orchestrator can stamp the irrigation record id onto it.
    if (
      selectedLogType === 'irrigation' &&
      irrigationIncludesFertilizers &&
      validateFertigationForm(irrigationFertigationData)
    ) {
      const irrigationLog = buildPendingLog('irrigation', { ...irrigationData });
      const fertigationLog = buildPendingLog(
        'fertigation',
        { ...irrigationFertigationData },
        { linkIrrigationFromPendingLogId: irrigationLog.id },
      );
      enqueuePendingLogs([irrigationLog, fertigationLog]);
      setIrrigationData({ duration: undefined });
      setIrrigationFertigationData(createEmptyFertigationFormData());
      setIrrigationIncludesFertilizers(false);
      return;
    }

    let data: PendingLog['data'];
    switch (selectedLogType) {
      case 'irrigation':
        data = { ...irrigationData };
        setIrrigationData({ duration: undefined });
        // Reset the irrigation-only fertilizer draft + toggle. This is separate state from
        // the standalone Fertigation tab's `fertigationData`, so a standalone draft is
        // never affected by adding a plain irrigation entry.
        if (irrigationIncludesFertilizers) {
          setIrrigationFertigationData(createEmptyFertigationFormData());
          setIrrigationIncludesFertilizers(false);
        }
        break;
      case 'spray':
        if (
          isGrapeFarm &&
          sprayData.catalogMixId &&
          sprayData.safeHarvestDate &&
          sprayData.governingPhiDays != null &&
          isPhiConflict({
            safeHarvestDate: sprayData.safeHarvestDate,
            targetHarvestDate: activeSeason?.target_harvest_date ?? null,
          })
        ) {
          Alert.alert(
            t('entryForm.phiErrors.conflictTitle', { defaultValue: 'Harvest safety conflict' }),
            t('entryForm.phiErrors.conflictBody', {
              defaultValue:
                'This spray blocks harvest until {{safeDate}} due to {{component}}, but target harvest is {{targetDate}}.',
              safeDate: sprayData.safeHarvestDate,
              component: sprayData.phiBlockingComponent ?? 'a component',
              targetDate: activeSeason?.target_harvest_date ?? '-',
            }),
            [
              {
                text: t('common.cancel', { defaultValue: 'Cancel' }),
                style: 'cancel',
              },
              {
                text: t('entryForm.phiErrors.overrideAction', { defaultValue: 'Add anyway' }),
                style: 'destructive',
                onPress: () => {
                  Alert.alert(
                    t('entryForm.phiErrors.conflictTitle', {
                      defaultValue: 'Harvest safety conflict',
                    }),
                    t('entryForm.phiErrors.overrideConfirmBody', {
                      defaultValue:
                        'Are you sure? This spray violates harvest safety guidance and will be marked as an override.',
                    }),
                    [
                      {
                        text: t('common.cancel', { defaultValue: 'Cancel' }),
                        style: 'cancel',
                      },
                      {
                        text: t('common.confirm', { defaultValue: 'Confirm' }),
                        style: 'destructive',
                        onPress: () => {
                          const payload = buildSprayPendingData({
                            ...sprayData,
                            phiOverride: true,
                          });
                          enqueuePendingLog('spray', payload);
                          setSprayData(createEmptySprayFormData());
                        },
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
          sprayData.phiStatus === 'unknown' &&
          (!sprayData.catalogMixId ||
            sprayData.safeHarvestDate == null ||
            sprayData.governingPhiDays == null)
        ) {
          Alert.alert(
            t('entryForm.phiErrors.computeFailedTitle', { defaultValue: 'PHI unavailable' }),
            t('entryForm.phiErrors.computeFailedBody', {
              defaultValue:
                'This spray will be saved with unknown PHI status because no verified catalog mapping was found.',
            }),
          );
        }

        data = buildSprayPendingData(sprayData);
        setSprayData(createEmptySprayFormData());
        break;
      case 'harvest':
        data = { ...harvestData };
        setHarvestData(createEmptyHarvestFormData());
        break;
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
    irrigationData,
    sprayData,
    harvestData,
    expenseData,
    fertigationData,
    irrigationFertigationData,
    noteData,
    isGrapeFarm,
    activeSeason?.target_harvest_date,
    buildSprayPendingData,
    buildPendingLog,
    enqueuePendingLog,
    enqueuePendingLogs,
    irrigationIncludesFertilizers,
    t,
  ]);

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
        const { data, error } = await supabase
          .from(TABLES.DAILY_NOTES)
          .select('*')
          .eq('farm_id', farmId)
          .eq('date', date)
          .maybeSingle();
        if (error) throw error;
        return (data ?? null) as DailyNoteRecord | null;
      },
      updateWaterLevel: async (payload) => updateWaterLevel.mutateAsync(payload),
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
  const [dueDate, setDueDate] = useState('');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
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
    setShowDueDatePicker(false);
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
        presentationStyle="fullScreen"
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
                paddingTop: 8 + insets.top,
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
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {selectedLogType === 'spray' ? (
                <View
                  style={{
                    marginTop: 16,
                    marginBottom: 4,
                    padding: 12,
                    borderRadius: radius.md,
                    backgroundColor: colorWithOpacity(m3.colorScheme.secondaryContainer, 0.5),
                  }}
                >
                  <Text
                    style={{
                      color: m3.colorScheme.onSurfaceVariant,
                      ...m3.typography.labelSmall,
                    }}
                  >
                    {isGrapeFarm
                      ? t('entryForm.phiScope.grapeOnlyEnabled', {
                          defaultValue:
                            'PHI safety checks are currently available for grape sprays.',
                        })
                      : t('entryForm.phiScope.grapeOnlyDisabled', {
                          defaultValue:
                            'PHI safety validation is currently available for grape sprays only.',
                        })}
                  </Text>
                </View>
              ) : null}
              <LogForm
                selectedLogType={selectedLogType}
                irrigationData={irrigationData}
                sprayData={sprayData}
                harvestData={harvestData}
                expenseData={expenseData}
                fertigationData={activeFertigationData}
                noteData={noteData}
                onIrrigationChange={setIrrigationData}
                onSprayChange={setSprayData}
                onHarvestChange={setHarvestData}
                onExpenseChange={setExpenseData}
                onFertigationChange={handleActiveFertigationChange}
                onNoteChange={setNoteData}
                onInputFocus={scrollToFocusedInput}
                onAdd={addLogToSession}
                isValid={isLogFormValid}
                hasFarm={hasFarmForCurrentLog}
                sprayQuickAddItems={sprayQuickAddItems}
                fertigationQuickAddItems={fertigationQuickAddItems}
                includeFertilizersWithIrrigation={irrigationIncludesFertilizers}
                onIncludeFertilizersWithIrrigationChange={setIrrigationIncludesFertilizers}
                sprayCatalogMixes={catalogMixes}
                sprayHistoryItems={recentSprayChemicals ?? []}
                sprayPlanItems={fertilizerPlan?.items ?? []}
                fertigationHistoryItems={recentFertigationItems ?? []}
                fertigationPlanItems={fertilizerPlan?.items ?? []}
                fertigationCatalogProducts={fertilizerCatalogProducts}
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

  const renderInlineLogComposerForm = () => {
    if (!isInlineComposerMode || !selectedLogType) return null;

    return (
      <View style={{ marginBottom: 16 }}>
        {selectedLogType === 'spray' ? (
          <View
            style={{
              marginBottom: 10,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colorWithOpacity(m3.colorScheme.secondaryContainer, 0.5),
            }}
          >
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.labelSmall,
              }}
            >
              {isGrapeFarm
                ? t('entryForm.phiScope.grapeOnlyEnabled', {
                    defaultValue: 'PHI safety checks are currently available for grape sprays.',
                  })
                : t('entryForm.phiScope.grapeOnlyDisabled', {
                    defaultValue:
                      'PHI safety validation is currently available for grape sprays only.',
                  })}
            </Text>
          </View>
        ) : null}
        <LogForm
          selectedLogType={selectedLogType}
          irrigationData={irrigationData}
          sprayData={sprayData}
          harvestData={harvestData}
          expenseData={expenseData}
          fertigationData={activeFertigationData}
          noteData={noteData}
          onIrrigationChange={setIrrigationData}
          onSprayChange={setSprayData}
          onHarvestChange={setHarvestData}
          onExpenseChange={setExpenseData}
          onFertigationChange={handleActiveFertigationChange}
          onNoteChange={setNoteData}
          onInputFocus={scrollToFocusedInput}
          onAdd={addLogToSession}
          isValid={isLogFormValid}
          hasFarm={hasFarmForCurrentLog}
          sprayQuickAddItems={sprayQuickAddItems}
          fertigationQuickAddItems={fertigationQuickAddItems}
          includeFertilizersWithIrrigation={irrigationIncludesFertilizers}
          onIncludeFertilizersWithIrrigationChange={setIrrigationIncludesFertilizers}
          sprayCatalogMixes={catalogMixes}
          sprayHistoryItems={recentSprayChemicals ?? []}
          sprayPlanItems={fertilizerPlan?.items ?? []}
          fertigationHistoryItems={recentFertigationItems ?? []}
          fertigationPlanItems={fertilizerPlan?.items ?? []}
          fertigationCatalogProducts={fertilizerCatalogProducts}
          areaAcres={activeFarmAreaAcres}
        />
      </View>
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
      {!farm && !lockFarmSelection && (
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
          {showLogFarmPicker && farms && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: radius.md,
                marginTop: 8,
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                overflow: 'hidden',
              }}
            >
              {selectedLogType === 'expense' && (
                <Pressable
                  key="all-farms"
                  onPress={() => {
                    setSelectedFarmId(ALL_FARMS_ID);
                    setShowLogFarmPicker(false);
                  }}
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderColor: m3.surface.s100,
                    backgroundColor: isAllFarmsSelected
                      ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                      : m3.surface.s100,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: isAllFarmsSelected
                        ? m3.colorScheme.primary
                        : m3.colorScheme.onSurfaceVariant,
                      fontWeight: isAllFarmsSelected ? '500' : '400',
                    }}
                  >
                    {t('entryForm.allFarms')}
                  </Text>
                </Pressable>
              )}
              {farms.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    if (f.id) setSelectedFarmId(f.id);
                    setShowLogFarmPicker(false);
                  }}
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderColor: m3.surface.s100,
                    backgroundColor:
                      activeFarm?.id === f.id
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : m3.surface.s100,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color:
                        activeFarm?.id === f.id
                          ? m3.colorScheme.primary
                          : m3.colorScheme.onSurfaceVariant,
                      fontWeight: activeFarm?.id === f.id ? '500' : '400',
                    }}
                  >
                    {f.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
            <Text
              selectable
              style={{
                fontSize: fontSize.xl,
                fontWeight: '700',
                color: m3.colorScheme.onSurface,
              }}
            >
              {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
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
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: m3.surface.s50,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <AppIcon name="calendar" size={18} color={m3.colorScheme.primary} />
            <Text
              selectable
              style={{
                marginLeft: 8,
                fontSize: fontSize.base,
                fontWeight: '600',
                color: m3.colorScheme.onSurface,
              }}
            >
              {formatDate(selectedDate, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <AppIcon
            name="chevron-forward"
            size={16}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.65)}
          />
        </Pressable>
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
            setShowLogFormModal(!isInlineComposerMode);
          }}
        />
      </GuidedTourTarget>
      {renderInlineLogComposerForm()}
      {isInlineComposerMode && pendingLogs.length === 0 && !selectedLogType && (
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

      {!farm && !lockFarmSelection && (
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
          {showTaskFarmPicker && farms && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: radius.md,
                marginTop: 8,
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                overflow: 'hidden',
              }}
            >
              {farms.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    if (f.id) setTaskFarmId(f.id);
                    setShowTaskFarmPicker(false);
                  }}
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderColor: m3.surface.s100,
                    backgroundColor:
                      taskFarmId === f.id
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : m3.surface.s100,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color:
                        taskFarmId === f.id
                          ? m3.colorScheme.primary
                          : m3.colorScheme.onSurfaceVariant,
                      fontWeight: taskFarmId === f.id ? '500' : '400',
                    }}
                  >
                    {f.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
        <Text
          selectable
          style={{
            fontSize: fontSize.sm,
            fontWeight: '500',
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: 8,
          }}
        >
          {t('entryForm.taskForm.dueDateLabel')}
        </Text>
        <Pressable
          onPress={() => setShowDueDatePicker(true)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <AppIcon
              name="calendar"
              size={18}
              color={
                dueDate
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
              }
            />
            <Text
              selectable
              style={[
                { marginLeft: 8, fontSize: fontSize.base },
                {
                  color: dueDate
                    ? m3.colorScheme.onSurface
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                },
              ]}
            >
              {dueDate
                ? formatDate(parseDbDateToLocalDate(dueDate) ?? dueDate, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : t('entryForm.taskForm.selectDueDate')}
            </Text>
          </View>
          {dueDate && (
            <Pressable onPress={() => setDueDate('')} style={{ marginLeft: 8, padding: 4 }}>
              <AppIcon
                name="close-circle"
                size={20}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          )}
        </Pressable>
        {showDueDatePicker && isIOS && (
          <Modal
            transparent
            visible={showDueDatePicker}
            onRequestClose={() => setShowDueDatePicker(false)}
            animationType="fade"
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
                justifyContent: 'flex-end',
              }}
              onPress={() => setShowDueDatePicker(false)}
            >
              <View
                style={{
                  backgroundColor: m3.surface.s100,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 16,
                  paddingBottom: 40,
                }}
                onStartShouldSetResponder={() => true}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
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
                    {t('entryForm.taskForm.selectDueDateTitle')}
                  </Text>
                  <Pressable onPress={() => setShowDueDatePicker(false)}>
                    <AppIcon
                      name="close"
                      size={24}
                      color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                    />
                  </Pressable>
                </View>
                <DateTimePicker
                  value={(() => {
                    if (!dueDate) return new Date();
                    const parsed = parseDbDateToLocalDate(dueDate);
                    return parsed ?? new Date();
                  })()}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) setDueDate(formatLocalDate(date));
                  }}
                  style={{ height: 200 }}
                  textColor={m3.colorScheme.onSurface}
                />
                <Pressable
                  onPress={() => setShowDueDatePicker(false)}
                  style={[
                    {
                      marginTop: 16,
                      paddingVertical: 12,
                      borderRadius: componentRadius.button,
                      alignItems: 'center',
                    },
                    { backgroundColor: m3.colorScheme.primary },
                  ]}
                >
                  <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                    {t('entryForm.done')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        )}
        {showDueDatePicker && !isIOS && (
          <DateTimePicker
            value={(() => {
              if (!dueDate) return new Date();
              const parsed = parseDbDateToLocalDate(dueDate);
              return parsed ?? new Date();
            })()}
            mode="date"
            display="default"
            onChange={(_, date) => {
              setShowDueDatePicker(false);
              if (date) setDueDate(formatLocalDate(date));
            }}
          />
        )}
      </View>
    </>
  );

  useEffect(() => {
    if (presentation !== 'screen' || activeTab !== 'log') return;
    guidedTourEmit('guidedTour.addLogSelectionState', {
      hasSelection: selectedLogType !== null,
      hasPendingDrafts: pendingLogs.length > 0,
      isCurrentLogValid: selectedLogType !== null ? isLogFormValid : false,
      ...(selectedLogType ? { recordType: selectedLogType } : {}),
    });
  }, [activeTab, isLogFormValid, pendingLogs.length, presentation, selectedLogType]);

  useEffect(() => {
    if (
      guidedTourStatus !== 'in_progress' ||
      guidedTourStep !== 'add_log' ||
      !showLogFormModal ||
      !selectedLogType
    ) {
      return;
    }

    const timer = setTimeout(() => {
      guidedTourEmit('guidedTour.focusLogActivityInput', { recordType: selectedLogType });
    }, 180);

    return () => clearTimeout(timer);
  }, [guidedTourStatus, guidedTourStep, showLogFormModal, selectedLogType]);

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

        {showDatePicker && !isIOS && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}
        {showDatePicker && isIOS && (
          <Pressable
            onPress={() => setShowDatePicker(false)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
              zIndex: 50,
            }}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: m3.surface.s100,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 16,
              }}
              onStartShouldSetResponder={() => true}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
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
                  {t('entryForm.selectDate')}
                </Text>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <AppIcon
                    name="close"
                    size={24}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                  />
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setSelectedDate(date);
                }}
              />
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={[
                  {
                    marginTop: 16,
                    paddingVertical: 12,
                    borderRadius: componentRadius.button,
                    alignItems: 'center',
                  },
                  { backgroundColor: m3.colorScheme.primary },
                ]}
              >
                <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                  {t('entryForm.done')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        {showTypePicker && (
          <ModalBackdrop
            visible
            onDismiss={() => setShowTypePicker(false)}
            opacity={0.4}
            zIndex={60}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: m3.surface.s100,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 16,
              }}
              onStartShouldSetResponder={() => true}
            >
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
              <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ maxHeight: 320 }}>
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
              </ScrollView>
            </View>
          </ModalBackdrop>
        )}

        {showPriorityPicker && (
          <ModalBackdrop
            visible
            onDismiss={() => setShowPriorityPicker(false)}
            opacity={0.4}
            zIndex={60}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: m3.surface.s100,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 16,
              }}
              onStartShouldSetResponder={() => true}
            >
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
          </ModalBackdrop>
        )}

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

        {activeTab === 'log' && !isInlineComposerMode && renderLogFormModal()}

        {/* Sticky Add Entry button above keyboard */}
        {activeTab === 'log' &&
          isKeyboardVisible &&
          !showLogFormModal &&
          !isInlineComposerMode &&
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
                      <ActivityIndicator size="small" color={m3.colorScheme.onPrimary} />
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
                  <ActivityIndicator size="small" color={m3.colorScheme.onPrimary} />
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
