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
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticSuccess } from '@/utils/haptics';
import { getFarmErrorMeta, shouldCaptureFarmErrorInSentry } from '@/utils/farm-error-utils';
import { androidTextPadding, spacing, borderRadius, fontWeight } from '@/styles/theme';
import { LogTypeSelector } from '@/components/screens/entry-form/LogTypeSelector';
import { PendingLogs, type PendingLog } from '@/components/screens/entry-form/PendingLogs';
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
  createEmptySprayFormData,
  createEmptyHarvestFormData,
  createEmptyExpenseFormData,
  createEmptyFertigationFormData,
  type SprayQuickAddItem,
  type FertigationQuickAddItem,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
} from '@/components/forms';
import {
  LOG_TYPES,
  type LogTypeId,
  HARVEST_GRADES,
  CHEMICAL_UNITS,
  type FertilizerUnit,
  ACTIVITY_TYPES as _ACTIVITY_TYPES,
} from '@/constants/calculator-models';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpdateFarmWaterLevel,
  useFarms,
  useProfile,
  useWarehouseItems,
  useRecentSprayChemicals,
  useRecentFertigationItems,
  useFarmSeasonStatus,
  useChemicalMixSearch,
  usePhiComputation,
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
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';
import type { VoiceLogFormPrefill } from '@/types/voice-log';
import { telemetry } from '@/services/telemetry';
import { useAuthStore, useNotificationStore } from '@/stores';
import { mapExpenseRecordTypeToTypeId } from '@/utils/expense-type';
import { isGrapeCrop } from '@/utils/crop';
import {
  submitEntryPendingLog,
  type EntryLogFarmContext,
  type EntryLogSubmitters,
} from '@/utils/entry-log-submission';
import { resolveAreaUnitPreference } from '@/utils/preferences';
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

interface EntryFormProps {
  visible?: boolean;
  onClose: () => void;
  tabs?: EntryTab[];
  initialTab?: EntryTab;
  farm?: Farm;
  initialFarmId?: number | null;
  initialApplyToAllFarms?: boolean;
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
  onTaskSaveSuccess?: () => void;
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

function normalizeFertigationDoseUnit(unit: string | null | undefined): 'kg/acre' | 'liter/acre' {
  if (typeof unit !== 'string') return 'kg/acre';
  const trimmed = unit.trim();
  if (!trimmed) return 'kg/acre';
  const normalized = trimmed.toLowerCase();
  if (normalized === 'kg' || normalized === 'kg/acre' || normalized === 'kg per acre') {
    return 'kg/acre';
  }
  if (
    normalized === 'liter' ||
    normalized === 'litre' ||
    normalized === 'l' ||
    normalized === 'liter/acre' ||
    normalized === 'litre/acre' ||
    normalized === 'l/acre' ||
    normalized === 'liter per acre' ||
    normalized === 'litre per acre'
  ) {
    return 'liter/acre';
  }
  if (normalized === 'ppm') return 'kg/acre';
  return 'kg/acre';
}

function normalizeWarehouseFertilizerUnit(unit: string | null | undefined): FertilizerUnit {
  if (typeof unit !== 'string') return 'kg';
  const trimmed = unit.trim();
  if (!trimmed) return 'kg';
  const normalized = trimmed.toLowerCase();
  if (normalized === 'kg' || normalized === 'kg/acre' || normalized === 'kg per acre') {
    return 'kg';
  }
  if (
    normalized === 'liter' ||
    normalized === 'litre' ||
    normalized === 'l' ||
    normalized === 'liter/acre' ||
    normalized === 'litre/acre' ||
    normalized === 'l/acre' ||
    normalized === 'liter per acre' ||
    normalized === 'litre per acre'
  ) {
    return 'liter';
  }
  if (normalized === 'gram' || normalized === 'gm' || normalized === 'gram/acre') {
    return 'gram';
  }
  if (normalized === 'ml' || normalized === 'ml/acre') {
    return 'ml';
  }
  return 'kg';
}

function inferWarehouseFertilizerQuantityBasis(
  unit: string | null | undefined,
): 'per_acre' | undefined {
  if (typeof unit !== 'string') return undefined;
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.includes('/acre') || normalized.includes('per acre') ? 'per_acre' : undefined;
}

function resolveFertigationPrefill(
  unit: string | null | undefined,
): Pick<FertigationFormData['fertilizers'][number], 'unit' | 'quantityBasis'> {
  const normalized = normalizeFertigationDoseUnit(unit);
  if (normalized === 'liter/acre') return { unit: 'liter', quantityBasis: 'per_acre' };
  if (normalized === 'kg/acre') return { unit: 'kg', quantityBasis: 'per_acre' };
  return {
    unit: 'kg',
    quantityBasis: 'per_acre',
  };
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
  const colors = useThemeColors();
  const m3 = useM3();
  const { data: profile } = useProfile({ enabled: false });
  const user = useAuthStore((state) => state.user);
  const preferredAreaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );

  const isVisible = visible ?? true;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { windowHeight } = useResponsiveHeight();
  const resolvedTabs = useMemo<EntryTab[]>(
    () => (tabs && tabs.length > 0 ? tabs : ['log', 'task']),
    [tabs],
  );
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
  const isGrapeFarm = isGrapeCrop(activeFarm?.crop, activeFarm?.crop_variety);
  const logFarmId = activeFarm?.id;
  const { data: sprayWarehouseItems } = useWarehouseItems('spray');
  const { data: fertilizerWarehouseItems } = useWarehouseItems('fertilizer');
  const { data: recentSprayChemicals } = useRecentSprayChemicals(logFarmId ?? undefined);
  const { data: recentFertigationItems } = useRecentFertigationItems(logFarmId ?? undefined);
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
  const allFarmsSucceededByLogRef = useRef<Map<string, Set<number>>>(new Map());
  const [isSubmittingLogs, setIsSubmittingLogs] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(112);
  const logFormScrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: undefined });
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
    const byWarehouse = (fertilizerWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: normalizeWarehouseFertilizerUnit(item.unit),
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
      quantityBasis: undefined,
    }));
    const deduped = new Map<string, FertigationQuickAddItem>();
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
  }, [fertilizerWarehouseItems, recentFertigationItems]);

  const createIrrigation = useCreateIrrigationRecord();
  const createSpray = useCreateSprayRecord();
  const createHarvest = useCreateHarvestRecord();
  const createExpense = useCreateExpenseRecord();
  const createFertigation = useCreateFertigationRecord();
  const updateWaterLevel = useUpdateFarmWaterLevel();

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
          logFormScrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + scrollBy),
            animated: true,
          });
        }
      });
    },
    [windowHeight],
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
      setShowLogFormModal(true);
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
            };
          }),
        });
      }
    }
  }, [isVisible, initialLogType, initialLogPrefill]);

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
    setShowLogFormModal(true);

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
  }, [initialVoiceLogPrefill, isVisible]);

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
      default:
        return false;
    }
  }, [selectedLogType, irrigationData, sprayData, harvestData, expenseData, fertigationData]);

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
      default:
        return '';
    }
  }, []);

  const addLogToSession = useCallback(() => {
    if (!selectedLogType || !isLogFormValid) return;
    if (!activeFarm && !isAllFarmsSelected) return;
    if (isAllFarmsSelected && selectedLogType !== 'expense') return;

    let data: PendingLog['data'];
    switch (selectedLogType) {
      case 'irrigation':
        data = { ...irrigationData };
        setIrrigationData({ duration: undefined });
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

        data =
          isGrapeFarm &&
          sprayData.catalogMixId &&
          sprayData.safeHarvestDate &&
          sprayData.governingPhiDays != null
            ? {
                ...sprayData,
              }
            : {
                ...sprayData,
                governingPhiDays: null,
                safeHarvestDate: null,
                phiBlockingComponent: null,
                phiStatus: sprayData.phiStatus ?? 'unknown',
              };
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
      default:
        return;
    }

    const draftScope: PendingLog['scope'] =
      isAllFarmsSelected && selectedLogType === 'expense' ? 'all_farms' : 'single_farm';
    const newLog: PendingLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: selectedLogType,
      scope: draftScope,
      farmId: draftScope === 'all_farms' ? null : (activeFarm?.id ?? null),
      data,
      displayDescription: getLogDescription(selectedLogType, data),
      isSourceTaskLog: false,
    };

    setPendingLogs((prev) => {
      const shouldMarkSourceTaskLog = Boolean(
        sourceTaskId &&
        sourceTaskType &&
        selectedLogType === sourceTaskType &&
        !prev.some((log) => log.isSourceTaskLog),
      );
      return [...prev, { ...newLog, isSourceTaskLog: shouldMarkSourceTaskLog }];
    });
    setSelectedLogType(null);
    setShowLogFormModal(false);
  }, [
    selectedLogType,
    isLogFormValid,
    irrigationData,
    sprayData,
    harvestData,
    expenseData,
    fertigationData,
    sourceTaskId,
    sourceTaskType,
    getLogDescription,
    activeFarm,
    isGrapeFarm,
    isAllFarmsSelected,
    activeSeason?.target_harvest_date,
    t,
  ]);

  const removeLogFromSession = useCallback((id: string) => {
    allFarmsSucceededByLogRef.current.delete(id);
    setPendingLogs((prev) => prev.filter((log) => log.id !== id));
  }, []);

  const saveAllLogs = async () => {
    if (pendingLogs.length === 0) return;

    setIsSubmittingLogs(true);
    const dateStr = toSupabaseDateString(selectedDate);
    const createdFrom = entrySource === 'voice_ai' ? 'voice_ai' : 'manual';
    const hasAllFarmsDrafts = pendingLogs.some((log) => log.scope === 'all_farms');
    const hasSingleFarmDrafts = pendingLogs.some((log) => log.scope === 'single_farm');

    const submitters: EntryLogSubmitters = {
      createIrrigation: async (payload) => createIrrigation.mutateAsync(payload),
      createSpray: async (payload) => createSpray.mutateAsync(payload),
      createHarvest: async (payload) => createHarvest.mutateAsync(payload),
      createExpense: async (payload) => createExpense.mutateAsync(payload),
      createFertigation: async (payload) => createFertigation.mutateAsync(payload),
      updateWaterLevel: async (payload) => updateWaterLevel.mutateAsync(payload),
    };

    const buildFarmContext = (farmItem: Farm): EntryLogFarmContext => ({
      id: farmItem.id ?? 0,
      area: farmItem.area,
      areaUnit: preferredAreaUnit,
      total_tank_capacity: farmItem.total_tank_capacity,
      system_discharge: farmItem.system_discharge,
      remaining_water: farmItem.remaining_water,
      date_of_pruning: farmItem.date_of_pruning,
    });

    const saveLog = async (
      log: (typeof pendingLogs)[number],
      farmContext: EntryLogFarmContext,
    ): Promise<{ pendingLogId: string; type: LogTypeId; recordId: number | null }> =>
      submitEntryPendingLog({
        log,
        dateStr,
        farm: farmContext,
        submitters,
      });

    try {
      if (hasAllFarmsDrafts && hasSingleFarmDrafts) {
        Alert.alert(
          t('common.error'),
          t('entryForm.mixedDraftScopes', {
            defaultValue:
              'This draft session contains both all-farms and single-farm entries. Please save or remove one scope before continuing.',
          }),
        );
        return;
      }

      if (hasAllFarmsDrafts) {
        const farmsToUse = (farms ?? []).filter((farmItem) => typeof farmItem.id === 'number');
        if (farmsToUse.length === 0) {
          Alert.alert(t('common.error'), t('entryForm.allFarmsNoFarms'));
          return;
        }

        const hasNonExpenseLogs = pendingLogs.some((log) => log.type !== 'expense');
        if (hasNonExpenseLogs) {
          Alert.alert(t('common.error'), t('entryForm.allFarmsExpenseOnly'));
          return;
        }

        const successfulFarmIdsByLog = new Map<string, Set<number>>();
        pendingLogs.forEach((log) => {
          successfulFarmIdsByLog.set(
            log.id,
            new Set(allFarmsSucceededByLogRef.current.get(log.id) ?? []),
          );
        });

        const submissions = farmsToUse.flatMap((farmItem) =>
          pendingLogs.flatMap((log) => {
            const farmId = farmItem.id as number;
            if (successfulFarmIdsByLog.get(log.id)?.has(farmId)) {
              return [];
            }
            return [
              {
                logId: log.id,
                logType: log.type,
                farmId,
                promise: saveLog(log, buildFarmContext(farmItem)),
              },
            ];
          }),
        );

        const results = await Promise.allSettled(
          submissions.map((submission) => submission.promise),
        );
        let failedCount = 0;
        let firstFailedError: unknown = null;
        let failedLogContext: (typeof pendingLogs)[number] | null = null;

        results.forEach((result, index) => {
          const submission = submissions[index];
          if (result.status === 'fulfilled') {
            try {
              telemetry.capture('record_created', {
                record_type: submission.logType,
                created_from: createdFrom,
                farm_id: submission.farmId,
              });
              telemetry.capture('meaningful_action', {
                action_type: 'record_created',
                feature_name: submission.logType,
              });
              if (typeof submission.farmId === 'number') {
                guidedTourEmit('guidedTour.logCreated', {
                  farmId: submission.farmId,
                  recordType: submission.logType,
                });
              }
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                console.error('[Telemetry] failed to send:', err);
              }
            }
            successfulFarmIdsByLog.get(submission.logId)?.add(submission.farmId);
            return;
          }

          failedCount += 1;
          if (!firstFailedError) {
            firstFailedError = result.reason;
            failedLogContext = pendingLogs.find((log) => log.id === submission.logId) ?? null;
          }

          const error = result.reason;
          const errorMeta = getFarmErrorMeta(error);
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          console.error('Failed to save pending log', {
            pendingLogId: submission.logId,
            logType: submission.logType,
            farmId: submission.farmId,
            errorName,
            errorCode: errorMeta.code ?? null,
            ...(__DEV__ ? { errorHint: errorMeta.hint ?? null } : {}),
          });
        });

        pendingLogs.forEach((log) => {
          const succeededFarmIds = successfulFarmIdsByLog.get(log.id);
          if (!succeededFarmIds || succeededFarmIds.size === 0) {
            allFarmsSucceededByLogRef.current.delete(log.id);
            return;
          }
          allFarmsSucceededByLogRef.current.set(log.id, new Set(succeededFarmIds));
        });

        const successfulIds = pendingLogs
          .filter((log) => {
            const succeededFarmIds = successfulFarmIdsByLog.get(log.id);
            return Boolean(succeededFarmIds && succeededFarmIds.size === farmsToUse.length);
          })
          .map((log) => log.id);

        if (successfulIds.length > 0) {
          successfulIds.forEach((id) => {
            allFarmsSucceededByLogRef.current.delete(id);
          });
          setPendingLogs((prev) => prev.filter((log) => !successfulIds.includes(log.id)));
          await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          triggerHapticSuccess();
          onLogSaveSuccess?.();
        }

        if (failedCount > 0) {
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
              scope.setTag('logType', failedLogContext?.type ?? 'unknown');
              scope.setExtra('errorMeta', { code: errorMeta.code ?? null });
              Sentry.captureException(
                firstFailedError instanceof Error ? firstFailedError : new Error(errorMessage),
              );
            });
          }

          Alert.alert(
            t('entryForm.partialSuccess.title'),
            failedCount === 1
              ? t('entryForm.partialSuccess.body_one', { count: failedCount })
              : t('entryForm.partialSuccess.body_other', { count: failedCount }),
          );
          return;
        }

        onClose();
        return;
      }

      const singleFarmIds = Array.from(
        new Set(
          pendingLogs
            .filter((log) => log.scope === 'single_farm')
            .map((log) => log.farmId)
            .filter((farmId): farmId is number => typeof farmId === 'number'),
        ),
      );
      if (singleFarmIds.length !== 1) {
        Alert.alert(
          t('common.error'),
          t('entryForm.mixedDraftFarms', {
            defaultValue:
              'This draft session includes entries for multiple farms. Please save or remove entries so all drafts target one farm.',
          }),
        );
        return;
      }
      const farmId = singleFarmIds[0] ?? null;
      const singleFarmContext =
        (farm && farm.id === farmId ? farm : null) ??
        farms?.find((farmItem) => farmItem.id === farmId) ??
        null;
      if (!farmId || !singleFarmContext) return;

      const results = await Promise.allSettled(
        pendingLogs.map((log) => saveLog(log, buildFarmContext(singleFarmContext))),
      );
      const successfulIds = pendingLogs
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((log) => log.id);
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const failedLog = pendingLogs[index];
          const error = result.reason;
          const errorMeta = getFarmErrorMeta(error);
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          console.error('Failed to save pending log', {
            pendingLogId: failedLog?.id ?? null,
            logType: failedLog?.type ?? null,
            errorName,
            errorCode: errorMeta.code ?? null,
            ...(__DEV__ ? { errorHint: errorMeta.hint ?? null } : {}),
          });
        }
      });
      const sourceTaskLogId = pendingLogs.find((log) => log.isSourceTaskLog)?.id;
      const matchingSuccessfulRecord =
        sourceTaskLogId === undefined
          ? null
          : results.find(
              (
                result,
              ): result is PromiseFulfilledResult<{
                pendingLogId: string;
                type: LogTypeId;
                recordId: number | null;
              }> => result.status === 'fulfilled' && result.value.pendingLogId === sourceTaskLogId,
            )?.value;
      let taskCompletionUpdateFailed = false;

      if (successfulIds.length > 0) {
        successfulIds.forEach((id) => {
          allFarmsSucceededByLogRef.current.delete(id);
        });
        // Track telemetry for successfully created records
        pendingLogs
          .filter((log) => successfulIds.includes(log.id))
          .forEach((log) => {
            try {
              telemetry.capture('record_created', {
                record_type: log.type,
                created_from: createdFrom,
                farm_id: farmId,
              });
              if (entrySource === 'voice_ai') {
                telemetry.capture('voice_log_submitted', {
                  farm_id: farmId,
                  record_type: log.type,
                  duration_hours:
                    log.type === 'irrigation'
                      ? ((log.data as IrrigationFormData).duration ?? null)
                      : null,
                });
              }
              // Track meaningful action for record creation
              telemetry.capture('meaningful_action', {
                action_type: 'record_created',
                feature_name: log.type,
              });
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                console.error('[Telemetry] failed to send:', err);
              }
            }
            if (typeof farmId === 'number') {
              guidedTourEmit('guidedTour.logCreated', {
                farmId,
                recordType: log.type,
              });
            }
          });
        setPendingLogs((prev) => prev.filter((log) => !successfulIds.includes(log.id)));

        if (
          sourceTaskId &&
          matchingSuccessfulRecord &&
          matchingSuccessfulRecord.recordId !== null
        ) {
          try {
            await updateTask.mutateAsync({
              id: sourceTaskId,
              updates: {
                status: 'completed',
                completed: true,
                completed_at: new Date().toISOString(),
                linked_record_type: matchingSuccessfulRecord.type,
                linked_record_id: matchingSuccessfulRecord.recordId,
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

        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        triggerHapticSuccess();
        onLogSaveSuccess?.();
      }

      if (failedCount > 0) {
        const firstFailedIndex = results.findIndex((result) => result.status === 'rejected');
        const failedLogContext = firstFailedIndex >= 0 ? pendingLogs[firstFailedIndex] : null;
        const firstFailedError =
          results[firstFailedIndex]?.status === 'rejected'
            ? (results[firstFailedIndex] as PromiseRejectedResult).reason
            : null;

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
            scope.setTag('logType', failedLogContext?.type ?? 'unknown');
            scope.setExtra('errorMeta', { code: errorMeta.code ?? null });
            Sentry.captureException(
              firstFailedError instanceof Error ? firstFailedError : new Error(errorMessage),
            );
          });
        }

        Alert.alert(
          t('entryForm.partialSuccess.title'),
          failedCount === 1
            ? t('entryForm.partialSuccess.body_one', { count: failedCount })
            : t('entryForm.partialSuccess.body_other', { count: failedCount }),
        );
        return;
      }

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
    onTaskSaveSuccess?.();
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
              allFarmsSucceededByLogRef.current.clear();
              setPendingLogs([]);
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
                backgroundColor: colors.surface[100],
                borderBottomWidth: 1,
                borderColor: colors.surface[100],
                paddingHorizontal: 16,
                paddingBottom: 12,
                paddingTop: 8 + insets.top,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    selectable
                    style={{ fontSize: 18, fontWeight: '600', color: m3.colorScheme.onSurface }}
                  >
                    {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                  </Text>
                  <Text
                    selectable
                    style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}
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
              contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
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
                    borderRadius: 12,
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
                fertigationData={fertigationData}
                onIrrigationChange={setIrrigationData}
                onSprayChange={setSprayData}
                onHarvestChange={setHarvestData}
                onExpenseChange={setExpenseData}
                onFertigationChange={setFertigationData}
                onInputFocus={scrollToFocusedInput}
                onAdd={addLogToSession}
                isValid={isLogFormValid}
                hasFarm={hasFarmForCurrentLog}
                sprayQuickAddItems={sprayQuickAddItems}
                fertigationQuickAddItems={fertigationQuickAddItems}
                sprayCatalogMixes={catalogMixes}
              />
            </ScrollView>
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
          backgroundColor: colors.surface[100],
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderColor: colors.surface[100],
          shadowColor: m3.colorScheme.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Pressable
          onPress={addLogToSession}
          disabled={!canSubmitLog}
          style={[
            {
              paddingVertical: 14,
              borderRadius: 12,
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
              { marginLeft: 8, fontWeight: '600', fontSize: 16 },
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
      {!farm && (
        <View
          style={{
            backgroundColor: colors.surface[100],
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.surface[100],
          }}
        >
          <Text
            selectable
            style={{
              fontSize: 14,
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
              backgroundColor: colors.surface[50],
              borderRadius: 12,
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
                style={{ fontSize: 16, color: m3.colorScheme.onSurface, marginLeft: 8 }}
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
                backgroundColor: colors.surface[100],
                borderRadius: 12,
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
                    borderColor: colors.surface[100],
                    backgroundColor: isAllFarmsSelected
                      ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                      : colors.surface[100],
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
                    borderColor: colors.surface[100],
                    backgroundColor:
                      activeFarm?.id === f.id
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : colors.surface[100],
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
          backgroundColor: colors.surface[100],
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.surface[100],
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface[100],
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <AppIcon name="calendar" size={18} color={m3.colorScheme.primary} />
            <Text
              selectable
              style={{
                marginLeft: 8,
                fontSize: 14,
                fontWeight: '500',
                color: m3.colorScheme.onSurface,
              }}
            >
              {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </Pressable>

          {pendingLogs.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <AppIcon name="document-text" size={14} color={m3.colorScheme.primary} />
              <Text
                selectable
                style={{
                  marginLeft: 4,
                  fontSize: 12,
                  fontWeight: '600',
                  color: m3.colorScheme.primary,
                }}
              >
                {t('entryForm.drafts', { count: pendingLogs.length })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {selectedLogType === null && guidedTourStatus === 'in_progress' ? (
        <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY}>
          <LogTypeSelector
            selectedLogType={selectedLogType}
            hasPendingDrafts={pendingLogs.length > 0}
            onSelect={(type) => {
              setSelectedLogType(type);
              setShowLogFormModal(true);
            }}
          />
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.surface[100],
            }}
          >
            <Text selectable style={{ fontSize: 14, color: m3.colorScheme.onSurfaceVariant }}>
              {t('entryForm.selectActivityTypeHint')}
            </Text>
          </View>
        </GuidedTourTarget>
      ) : (
        <LogTypeSelector
          selectedLogType={selectedLogType}
          hasPendingDrafts={pendingLogs.length > 0}
          onSelect={(type) => {
            setSelectedLogType(type);
            setShowLogFormModal(true);
          }}
        />
      )}
      <PendingLogs pendingLogs={pendingLogs} onRemove={removeLogFromSession} />
    </>
  );

  const renderTaskContent = () => (
    <>
      {!isEditingTask && (
        <Pressable
          onPress={() => setShowTemplates(!showTemplates)}
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            borderRadius: 12,
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
            backgroundColor: colors.surface[100],
            borderRadius: 12,
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
                    borderColor: colors.surface[100],
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
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
                      style={{ fontSize: 14, fontWeight: '500', color: m3.colorScheme.onSurface }}
                    >
                      {template.title}
                    </Text>
                    <Text
                      selectable
                      style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}
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

      {!farm && (
        <View style={{ marginBottom: 16 }}>
          <Text
            selectable
            style={{
              fontSize: 14,
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
              backgroundColor: colors.surface[100],
              borderRadius: 12,
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
                style={{ fontSize: 16, color: m3.colorScheme.onSurface, marginLeft: 8 }}
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
                backgroundColor: colors.surface[100],
                borderRadius: 12,
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
                    borderColor: colors.surface[100],
                    backgroundColor:
                      taskFarmId === f.id
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : colors.surface[100],
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
            fontSize: 14,
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
            backgroundColor: colors.surface[100],
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
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
            fontSize: 14,
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
            backgroundColor: colors.surface[100],
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
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
              fontSize: 14,
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
              backgroundColor: colors.surface[100],
              borderRadius: 12,
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
                style={{ fontSize: 14, color: m3.colorScheme.onSurface, marginLeft: 8 }}
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
              fontSize: 14,
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
              backgroundColor: colors.surface[100],
              borderRadius: 12,
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
                { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
                { backgroundColor: PRIORITY_INFO[priority].bgColor },
              ]}
            >
              <Text
                selectable
                style={[
                  { fontSize: 14, fontWeight: '500' },
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
            backgroundColor: colors.surface[100],
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          }}
        >
          <Text
            selectable
            style={{
              fontSize: 14,
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
                    borderRadius: 999,
                    backgroundColor: colors.surface[50],
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                  }}
                >
                  <Text style={{ fontSize: 12, color: m3.colorScheme.onSurface }}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: m3.colorScheme.onSurfaceVariant }}>
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
                backgroundColor: colors.surface[50],
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.surface[200],
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
                backgroundColor: colors.surface[50],
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.surface[200],
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
                backgroundColor: colors.surface[50],
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.surface[200],
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
                borderRadius: 10,
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
                    backgroundColor: colors.surface[50],
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 13, color: m3.colorScheme.onSurface }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}>
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
            fontSize: 14,
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
            backgroundColor: colors.surface[100],
            borderRadius: 12,
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
                { marginLeft: 8, fontSize: 16 },
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
                  backgroundColor: colors.surface[100],
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
                    style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
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
                    { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
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

  const content = (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={isIOS ? 0 : 20}
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      >
        <View
          style={{
            backgroundColor: colors.surface[100],
            borderBottomWidth: 1,
            borderColor: colors.surface[100],
            paddingHorizontal: 16,
            paddingBottom: 12,
            paddingTop: 8 + insets.top,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View
              style={{
                width: 48,
                height: 6,
                borderRadius: 999,
                backgroundColor: colors.surface[50],
              }}
            />
          </View>
          <View style={{ minHeight: 44, justifyContent: 'center', position: 'relative' }}>
            <View style={{ paddingHorizontal: 52, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                selectable
                style={{
                  fontSize: 18,
                  lineHeight: 24,
                  fontWeight: '600',
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
          <View style={{ marginTop: 2, alignItems: 'center', minHeight: 16 }}>
            <Text
              selectable
              style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}
              numberOfLines={1}
            >
              {activeFarm?.name}
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
                backgroundColor: colors.surface[100],
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
                  style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
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
                  { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
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
                backgroundColor: colors.surface[100],
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
                  style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
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
                      borderColor: colors.surface[100],
                      backgroundColor:
                        type === taskType
                          ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                          : colors.surface[100],
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
                backgroundColor: colors.surface[100],
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
                  style={{ fontSize: 18, fontWeight: '700', color: m3.colorScheme.onSurface }}
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
                    borderColor: colors.surface[100],
                    backgroundColor:
                      priority === p
                        ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                        : colors.surface[100],
                  }}
                >
                  <View
                    style={[
                      {
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      { backgroundColor: PRIORITY_INFO[p].bgColor },
                    ]}
                  >
                    <Text
                      selectable
                      style={[
                        { fontSize: 12, fontWeight: '700' },
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
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: footerHeight + insets.bottom + 24,
          }}
          scrollIndicatorInsets={{ bottom: footerHeight + insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={true}
        >
          {activeTab === 'log' ? renderLogContent() : renderTaskContent()}
        </ScrollView>

        {activeTab === 'log' && renderLogFormModal()}

        {/* Sticky Add Entry button above keyboard */}
        {activeTab === 'log' && isKeyboardVisible && !showLogFormModal && renderStickyAddButton()}

        <View
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            setFooterHeight((prev) => (prev === nextHeight ? prev : nextHeight));
          }}
          style={{
            flexShrink: 0,
            backgroundColor: colors.surface[100],
            paddingHorizontal: spacing[4],
            paddingTop: spacing[4],
            paddingBottom: Platform.OS === 'ios' ? Math.max(spacing[4], insets.bottom) : spacing[4],
            borderTopWidth: 1,
            borderColor: colors.surface[100],
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
                    borderRadius: borderRadius.lg,
                    borderWidth: 1,
                    borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    alignItems: 'center',
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
                        borderRadius: borderRadius.lg,
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
                            shadowColor: m3.colorScheme.primary,
                            shadowOpacity: 0.45,
                            shadowRadius: 14,
                            shadowOffset: { width: 0, height: spacing[1] },
                            elevation: 8,
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
                            { marginLeft: 8, fontWeight: '600', flexShrink: 1 },
                            {
                              color: canSaveLogs
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
                  borderRadius: 12,
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
                    borderRadius: 12,
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
