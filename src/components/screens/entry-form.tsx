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
  UIManager,
  findNodeHandle,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { AppIcon } from '@/components/ui/app-icon';
import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHapticSuccess } from '@/utils/haptics';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { getFarmErrorMeta, shouldCaptureFarmErrorInSentry } from '@/utils/farm-error-utils';

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
  FERTILIZER_UNITS,
} from '@/constants/calculator-models';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpdateFarmWaterLevel,
  useFarms,
  useWarehouseItems,
  useRecentSprayChemicals,
  useRecentFertigationItems,
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
import { useNotificationStore } from '@/stores';
import { mapExpenseRecordTypeToTypeId } from '@/utils/expense-type';
import { getExpenseIconName } from '@/utils/expense-icons';
import { submitEntryPendingLog } from '@/utils/entry-log-submission';
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

type EntryTab = 'log' | 'task';

interface EntryFormProps {
  visible?: boolean;
  onClose: () => void;
  tabs?: EntryTab[];
  initialTab?: EntryTab;
  farm?: Farm;
  initialFarmId?: number | null;
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

interface PendingLog {
  id: string;
  type: LogTypeId;
  data:
    | IrrigationFormData
    | SprayFormData
    | HarvestFormData
    | ExpenseFormData
    | FertigationFormData;
  displayDescription: string;
  isSourceTaskLog?: boolean;
}

const ACTIVITY_TYPES = LOG_TYPES.filter((lt) => lt.id !== 'note');

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

function isValidFertilizerUnit(
  unit: string,
): unit is FertigationFormData['fertilizers'][number]['unit'] {
  return FERTILIZER_UNITS.includes(unit as FertigationFormData['fertilizers'][number]['unit']);
}

function normalizeFertigationDoseUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'litre/acre') return 'liter/acre';
  if (normalized === 'litre') return 'liter';
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
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(
    farm?.id ?? initialFarmId ?? null,
  );
  const [showLogFarmPicker, setShowLogFarmPicker] = useState(false);
  const [showTaskFarmPicker, setShowTaskFarmPicker] = useState(false);

  const activeFarm = farm ?? farms?.find((f) => f.id === selectedFarmId) ?? null;
  const logFarmId = activeFarm?.id;
  const { data: sprayWarehouseItems } = useWarehouseItems('spray');
  const { data: fertilizerWarehouseItems } = useWarehouseItems('fertilizer');
  const { data: recentSprayChemicals } = useRecentSprayChemicals(logFarmId ?? undefined);
  const { data: recentFertigationItems } = useRecentFertigationItems(logFarmId ?? undefined);

  useEffect(() => {
    if (!isVisible) return;
    setActiveTab(defaultTab);
    if (farm?.id) {
      setSelectedFarmId(farm.id);
      return;
    }
    if (initialFarmId) {
      setSelectedFarmId(initialFarmId);
      return;
    }
    if (!selectedFarmId && farms && farms.length > 0 && farms[0].id) {
      setSelectedFarmId(farms[0].id);
    }
  }, [isVisible, defaultTab, farm?.id, farms, initialFarmId, selectedFarmId]);

  // Log state
  const [selectedDate, setSelectedDate] = useState<Date>(() => parsedInitialLogDate ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<LogTypeId | null>(null);
  const [showLogFormModal, setShowLogFormModal] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [isSubmittingLogs, setIsSubmittingLogs] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const logFormScrollViewRef = useRef<ScrollView>(null);
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

  const fertigationQuickAddItems = useMemo<FertigationQuickAddItem[]>(() => {
    const byWarehouse = (fertilizerWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: normalizeFertigationDoseUnit(item.unit),
      quantity: null,
      quantityBasis: undefined,
      warehouseItemId: item.id ?? null,
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
            const normalizedUnit = item.unit?.trim();
            const unit =
              normalizedUnit && isValidChemicalUnit(normalizedUnit) ? normalizedUnit : 'gm/L';
            return {
              id: `chem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: item.name,
              quantity: item.quantity ?? undefined,
              unit,
            };
          }),
        });
      }
      if (initialLogType === 'fertigation' && initialLogPrefill?.fertigationItems?.length) {
        setFertigationData({
          waterVolume: undefined,
          fertilizers: initialLogPrefill.fertigationItems.map((item) => {
            const normalizedUnit = item.unit?.trim();
            const unit =
              normalizedUnit && isValidFertilizerUnit(normalizedUnit) ? normalizedUnit : 'kg/acre';
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              name: item.name,
              quantity: item.quantity ?? 0,
              unit,
            };
          }),
        });
      }
    }
  }, [isVisible, initialLogType, initialLogPrefill]);

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
          ? sprayPrefill.chemicals.map((item, index) => ({
              id: createPrefillId('chem', index),
              name: item.name ?? '',
              quantity: item.quantity ?? undefined,
              unit:
                item.unit && CHEMICAL_UNITS.includes(item.unit as (typeof CHEMICAL_UNITS)[number])
                  ? (item.unit as (typeof CHEMICAL_UNITS)[number])
                  : 'gm/L',
            }))
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
          ? fertigationPrefill.fertilizers.map((item) => ({
              name: item.name ?? '',
              quantity: item.quantity ?? undefined,
              unit:
                item.unit &&
                FERTILIZER_UNITS.includes(item.unit as (typeof FERTILIZER_UNITS)[number])
                  ? (item.unit as (typeof FERTILIZER_UNITS)[number])
                  : 'kg/acre',
            }))
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

  const getLogDescription = useCallback((type: LogTypeId, data: unknown): string => {
    switch (type) {
      case 'irrigation':
        return `${(data as IrrigationFormData).duration} hours`;
      case 'spray': {
        const spray = data as SprayFormData;
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

    let data: PendingLog['data'];
    switch (selectedLogType) {
      case 'irrigation':
        data = { ...irrigationData };
        setIrrigationData({ duration: undefined });
        break;
      case 'spray':
        data = { ...sprayData };
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

    const newLog: PendingLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: selectedLogType,
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
  ]);

  const removeLogFromSession = useCallback((id: string) => {
    setPendingLogs((prev) => prev.filter((log) => log.id !== id));
  }, []);

  const saveAllLogs = async () => {
    if (pendingLogs.length === 0 || !activeFarm?.id) return;

    setIsSubmittingLogs(true);
    const dateStr = toSupabaseDateString(selectedDate);
    const farmId = activeFarm.id;
    if (!farmId) {
      setIsSubmittingLogs(false);
      return;
    }

    try {
      const saveLog = async (
        log: (typeof pendingLogs)[number],
      ): Promise<{ pendingLogId: string; type: LogTypeId; recordId: number | null }> => {
        return submitEntryPendingLog({
          log,
          dateStr,
          farm: {
            id: farmId,
            area: activeFarm.area,
            total_tank_capacity: activeFarm.total_tank_capacity,
            system_discharge: activeFarm.system_discharge,
            remaining_water: activeFarm.remaining_water,
            date_of_pruning: activeFarm.date_of_pruning,
          },
          submitters: {
            createIrrigation: async (payload) => createIrrigation.mutateAsync(payload),
            createSpray: async (payload) => createSpray.mutateAsync(payload),
            createHarvest: async (payload) => createHarvest.mutateAsync(payload),
            createExpense: async (payload) => createExpense.mutateAsync(payload),
            createFertigation: async (payload) => createFertigation.mutateAsync(payload),
            updateWaterLevel: async (payload) => updateWaterLevel.mutateAsync(payload),
          },
        });
      };

      const results = await Promise.allSettled(pendingLogs.map((log) => saveLog(log)));
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
        const createdFrom = entrySource === 'voice_ai' ? 'voice_ai' : 'manual';
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
            } catch {
              // Ignore telemetry errors
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
        unit: item.unit ?? 'kg/acre',
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

  const removeTaskPlannedInput = useCallback((index: number) => {
    setTaskPlannedInputs((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const addCustomTaskPlannedInput = useCallback(() => {
    const quantityValue = plannedItemQty.trim() ? Number(plannedItemQty) : null;
    addTaskPlannedInput({
      name: plannedItemName.trim(),
      unit: plannedItemUnit.trim() || (type === 'spray' ? 'gm/L' : 'kg/acre'),
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

  const renderTabs = () => {
    if (resolvedTabs.length < 2) return null;
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View
          style={{
            backgroundColor: colors.surface[100],
            borderRadius: 999,
            padding: 4,
            flexDirection: 'row',
          }}
        >
          {resolvedTabs.map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'log' ? t('entryForm.tabs.log') : t('entryForm.tabs.task');
            const iconName = tab === 'log' ? 'document-text' : 'checkbox-outline';
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  { flex: 1, borderRadius: 999, overflow: 'hidden' },
                  { marginHorizontal: 2 },
                ]}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[
                      colorWithOpacity(m3.colorScheme.primary, 0.95),
                      colorWithOpacity(m3.colorScheme.primary, 0.7),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: '100%',
                      borderRadius: 999,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name={iconName} size={16} color={m3.colorScheme.onPrimary} />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                        { color: m3.colorScheme.onPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={{
                      width: '100%',
                      borderRadius: 999,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name={iconName} size={16} color={m3.colorScheme.onSurfaceVariant} />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                        { color: m3.colorScheme.onSurfaceVariant },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLogTypeSelector = () => (
    <View
      style={{
        backgroundColor: colors.surface[100],
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        selectable
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: m3.colorScheme.onSurface,
          marginBottom: 12,
        }}
      >
        {t('entryForm.activityType')}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ACTIVITY_TYPES.map((logType) => {
          const isSelected = selectedLogType === logType.id;
          return (
            <Pressable
              key={logType.id}
              onPress={() => {
                setSelectedLogType(logType.id as LogTypeId);
                setShowLogFormModal(true);
              }}
              style={{
                width: '18%',
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                  : colors.surface[50],
                borderColor: isSelected
                  ? colorWithOpacity(m3.colorScheme.primary, 0.25)
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                  backgroundColor: isSelected ? `${logType.color}20` : `${logType.color}12`,
                }}
              >
                <AppIcon name={logType.icon} size={16} color={logType.color} />
              </View>
              <Text
                selectable
                style={[
                  { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
                  { color: isSelected ? m3.colorScheme.primary : m3.colorScheme.onSurface },
                ]}
                numberOfLines={2}
              >
                {t(logType.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderLogForm = () => {
    if (!selectedLogType) return null;
    return (
      <View style={{ backgroundColor: colors.surface[100], borderRadius: 16, padding: 16 }}>
        {selectedLogType === 'irrigation' && (
          <IrrigationForm
            data={irrigationData}
            onChange={setIrrigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'spray' && (
          <SprayForm
            data={sprayData}
            onChange={setSprayData}
            onInputFocus={scrollToFocusedInput}
            quickAddItems={sprayQuickAddItems}
          />
        )}
        {selectedLogType === 'harvest' && (
          <HarvestForm
            data={harvestData}
            onChange={setHarvestData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'expense' && (
          <ExpenseForm
            data={expenseData}
            onChange={setExpenseData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'fertigation' && (
          <FertigationForm
            data={fertigationData}
            onChange={setFertigationData}
            onInputFocus={scrollToFocusedInput}
            quickAddItems={fertigationQuickAddItems}
          />
        )}

        <Pressable
          onPress={addLogToSession}
          disabled={!isLogFormValid || !activeFarm}
          style={[
            {
              marginTop: 16,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            },
            {
              backgroundColor:
                isLogFormValid && activeFarm
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            },
          ]}
        >
          <AppIcon
            name="add-circle"
            size={20}
            color={
              isLogFormValid
                ? m3.colorScheme.onPrimary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
            }
          />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600' },
              {
                color: isLogFormValid
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
              {renderLogForm()}
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
          disabled={!isLogFormValid || !activeFarm}
          style={[
            {
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            },
            {
              backgroundColor:
                isLogFormValid && activeFarm
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
            },
          ]}
        >
          <AppIcon
            name="add-circle"
            size={20}
            color={
              isLogFormValid && activeFarm
                ? m3.colorScheme.onPrimary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
            }
          />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600', fontSize: 16 },
              {
                color:
                  isLogFormValid && activeFarm
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

  const renderPendingLogs = () => {
    if (pendingLogs.length === 0) return null;
    return (
      <View
        style={{
          backgroundColor: colors.surface[100],
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text
          selectable
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: m3.colorScheme.onSurface,
            marginBottom: 12,
          }}
        >
          {t('entryForm.pendingLogs', { count: pendingLogs.length })}
        </Text>
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
          const iconName =
            log.type === 'expense'
              ? getExpenseIconName(
                  (log.data as ExpenseFormData | undefined)?.type,
                  resolveSymbolIconName(logType?.icon),
                )
              : resolveSymbolIconName(logType?.icon);
          return (
            <View
              key={log.id}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                },
                { backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.1) },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${logType?.color}15`,
                }}
              >
                <UiSymbol
                  name={iconName}
                  size={18}
                  color={logType?.color ?? m3.colorScheme.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  selectable
                  style={{ fontSize: 14, fontWeight: '600', color: m3.colorScheme.onSurface }}
                >
                  {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                </Text>
                <Text selectable style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}>
                  {log.displayDescription}
                </Text>
              </View>
              <Pressable onPress={() => removeLogFromSession(log.id)}>
                <AppIcon name="trash-outline" size={20} color={m3.colorScheme.error} />
              </Pressable>
            </View>
          );
        })}
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
            onPress={() => setShowLogFarmPicker(!showLogFarmPicker)}
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
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={18} color={m3.colorScheme.primary} />
              <Text
                selectable
                style={{ fontSize: 16, color: m3.colorScheme.onSurface, marginLeft: 8 }}
              >
                {activeFarm?.name || t('entryForm.selectFarm')}
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

      {renderLogTypeSelector()}
      {selectedLogType === null && (
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
      )}
      {renderPendingLogs()}
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
              {taskPlanningSuggestions.map((item, index) => (
                <Pressable
                  key={`${item.name}-${item.unit ?? 'unit'}-${index}`}
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
                    {item.unit ?? (type === 'spray' ? 'gm/L' : 'kg/acre')}
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
              {taskPlannedInputs.map((item, index) => (
                <View
                  key={`${item.name}-${item.unit ?? 'unit'}-${index}`}
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
                  <Pressable onPress={() => removeTaskPlannedInput(index)}>
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

  const content = (
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                selectable
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: m3.colorScheme.onSurface,
                  textAlign: 'center',
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
              <Text
                selectable
                style={{ fontSize: 12, color: m3.colorScheme.onSurfaceVariant }}
                numberOfLines={1}
              >
                {activeFarm?.name}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={{ width: 40, alignItems: 'flex-end' }}>
              <AppIcon
                name="close-circle"
                size={26}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
              />
            </Pressable>
          </View>
        </View>

        {renderTabs()}

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
          contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          showsVerticalScrollIndicator={true}
        >
          {activeTab === 'log' ? renderLogContent() : renderTaskContent()}
        </ScrollView>

        {activeTab === 'log' && renderLogFormModal()}

        {/* Sticky Add Entry button above keyboard */}
        {activeTab === 'log' && isKeyboardVisible && !showLogFormModal && renderStickyAddButton()}

        <View
          style={{
            backgroundColor: colors.surface[100],
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderColor: colors.surface[100],
          }}
        >
          {activeTab === 'log' ? (
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
                onPress={saveAllLogs}
                disabled={pendingLogs.length === 0 || isSubmittingLogs || !activeFarm}
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
                      pendingLogs.length > 0 && !isSubmittingLogs && activeFarm
                        ? m3.colorScheme.primary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                  },
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
                        pendingLogs.length > 0
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                      }
                    />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600', flexShrink: 1 },
                        {
                          color:
                            pendingLogs.length > 0
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
