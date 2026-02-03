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
  Platform,
  type TextInputProps,
  Keyboard,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/app-icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { m3 } from '@/styles/theme';

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
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpdateFarmWaterLevel,
  useFarms,
  queryKeys,
} from '@/hooks';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import {
  TaskReminder,
  TaskType,
  TaskPriority,
  TaskTemplate,
  TASK_TYPE_INFO,
  PRIORITY_INFO,
} from '@/types/task';
import { TASK_TEMPLATES } from '@/constants/task-templates';
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';
import { telemetry } from '@/services/telemetry';
import { useNotificationStore } from '@/stores';
import {
  ensureNotificationPermissions,
  scheduleTaskDueReminder,
  cancelNotification,
} from '@/services/notifications';

type EntryTab = 'log' | 'task';

interface EntryFormProps {
  visible?: boolean;
  onClose: () => void;
  tabs?: EntryTab[];
  initialTab?: EntryTab;
  farm?: Farm;
  initialFarmId?: number | null;
  initialLogType?: LogTypeId | null;
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

export function EntryForm({
  visible,
  onClose,
  tabs,
  initialTab,
  farm,
  initialFarmId,
  initialLogType,
  editingTask,
  onLogSaveSuccess,
  onTaskSaveSuccess,
  presentation = 'modal',
}: EntryFormProps) {
  const { t } = useTranslation();

  const isVisible = visible ?? true;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isIOS = Platform.OS === 'ios';
  const resolvedTabs = useMemo<EntryTab[]>(
    () => (tabs && tabs.length > 0 ? tabs : ['log', 'task']),
    [tabs],
  );
  const defaultTab = resolvedTabs.includes(initialTab || 'log')
    ? initialTab || resolvedTabs[0]
    : resolvedTabs[0];
  const [activeTab, setActiveTab] = useState<EntryTab>(defaultTab);

  const { data: farms } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(
    farm?.id ?? initialFarmId ?? null,
  );
  const [showLogFarmPicker, setShowLogFarmPicker] = useState(false);
  const [showTaskFarmPicker, setShowTaskFarmPicker] = useState(false);

  const activeFarm = farm ?? farms?.find((f) => f.id === selectedFarmId) ?? null;

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
  const [selectedDate, setSelectedDate] = useState(new Date());
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
    }
  }, [isVisible, initialLogType]);

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
        return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''}`;
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
    };

    setPendingLogs((prev) => [...prev, newLog]);
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
      const saveLog = async (log: (typeof pendingLogs)[number]) => {
        switch (log.type) {
          case 'irrigation': {
            const data = log.data as IrrigationFormData;
            await createIrrigation.mutateAsync({
              farm_id: farmId,
              date: dateStr,
              duration: data.duration!,
              area: activeFarm.area ?? 0,
              growth_stage: '',
              moisture_status: '',
              system_discharge: activeFarm.system_discharge ?? 0,
              date_of_pruning: activeFarm.date_of_pruning,
            });

            if (
              activeFarm.total_tank_capacity &&
              activeFarm.system_discharge &&
              activeFarm.total_tank_capacity > 0 &&
              activeFarm.system_discharge > 0
            ) {
              const waterAdded = data.duration! * activeFarm.system_discharge;
              const currentWater = activeFarm.remaining_water ?? 0;
              const newWaterLevel = Math.min(
                activeFarm.total_tank_capacity,
                currentWater + waterAdded,
              );
              await updateWaterLevel.mutateAsync({
                farmId,
                remainingWater: newWaterLevel,
              });
            }
            break;
          }
          case 'spray': {
            const data = log.data as SprayFormData;
            const chemicalStr = data.chemicals
              .map((c) => `${c.name} (${c.quantity} ${c.unit})`)
              .join(', ');
            await createSpray.mutateAsync({
              farm_id: farmId,
              date: dateStr,
              chemical: chemicalStr,
              dose: `Water: ${data.waterVolume}L`,
              area: activeFarm.area ?? 0,
              weather: '',
              operator: '',
              date_of_pruning: activeFarm.date_of_pruning,
            });
            break;
          }
          case 'harvest': {
            const data = log.data as HarvestFormData;
            await createHarvest.mutateAsync({
              farm_id: farmId,
              date: dateStr,
              quantity: data.quantity!,
              grade: data.grade,
              price: data.price || undefined,
              buyer: data.buyer || undefined,
              date_of_pruning: activeFarm.date_of_pruning,
            });
            break;
          }
          case 'expense': {
            const data = log.data as ExpenseFormData;
            await createExpense.mutateAsync({
              farm_id: farmId,
              date: dateStr,
              type: data.type,
              cost: data.cost!,
              date_of_pruning: activeFarm.date_of_pruning,
              remarks: data.remarks || undefined,
            });
            break;
          }
          case 'fertigation': {
            const data = log.data as FertigationFormData;
            await createFertigation.mutateAsync({
              farm_id: farmId,
              date: dateStr,
              fertilizers: data.fertilizers.map((f) => ({
                name: f.name,
                unit: f.unit,
                quantity: f.quantity!,
              })),
              area: activeFarm.area ?? 0,
              date_of_pruning: activeFarm.date_of_pruning,
            });
            break;
          }
        }
      };

      const results = await Promise.allSettled(pendingLogs.map((log) => saveLog(log)));
      const successfulIds = pendingLogs
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((log) => log.id);
      const failedCount = results.filter((result) => result.status === 'rejected').length;

      if (successfulIds.length > 0) {
        // Track telemetry for successfully created records
        pendingLogs
          .filter((log) => successfulIds.includes(log.id))
          .forEach((log) => {
            try {
              telemetry.capture('record_created', {
                record_type: log.type,
                created_from: 'manual',
                farm_id: farmId,
              });
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
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        onLogSaveSuccess?.();
      }

      if (failedCount > 0) {
        Alert.alert(
          t('entryForm.partialSuccess.title'),
          failedCount === 1
            ? t('entryForm.partialSuccess.body_one', { count: failedCount })
            : t('entryForm.partialSuccess.body_other', { count: failedCount }),
        );
        return;
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

  const resetTaskForm = () => {
    setTitle('');
    setDescription('');
    setType('note');
    setPriority('medium');
    setDueDate('');
    setShowDueDatePicker(false);
    setShowTypePicker(false);
    setShowPriorityPicker(false);
    setShowTemplates(false);
  };

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
        setDescription(editingTask.description || '');
        setType(editingTask.type);
        setPriority(editingTask.priority);
        setTaskFarmId(editingTask.farm_id);
        setDueDate(editingTask.due_date || '');
      } else {
        resetTaskForm();
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
  }, [isVisible, editingTask, farms, initialFarmId, farm?.id]);

  const applyTemplate = (template: TaskTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setType(template.type);
    setPriority(template.priority);
    setShowTemplates(false);
  };

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

    const taskData = {
      farm_id: resolvedFarmId,
      title: title.trim(),
      description: description.trim() || null,
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

      try {
        if (existing?.notificationId) {
          await cancelNotification(existing.notificationId);
          removeTaskSchedule(taskId);
        }

        if (taskRemindersEnabled && savedTask.due_date) {
          const granted = await ensureNotificationPermissions();
          if (granted) {
            const notificationId = await scheduleTaskDueReminder(taskId, savedTask.due_date);
            if (notificationId) {
              upsertTaskSchedule(taskId, { notificationId, dueDate: savedTask.due_date });
            }
          }
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

  const handleClose = () => {
    const hasUnsavedTaskChanges =
      activeTab === 'task' && (title.trim() || description.trim() || dueDate);

    if (pendingLogs.length > 0 || hasUnsavedTaskChanges) {
      Alert.alert(
        t('entryForm.discardChanges.title'),
        hasUnsavedTaskChanges && pendingLogs.length === 0
          ? t('entryForm.discardChanges.taskOnly')
          : pendingLogs.length > 0 && !hasUnsavedTaskChanges
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
  };

  const renderTabs = () => {
    if (resolvedTabs.length < 2) return null;
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View
          style={{
            backgroundColor: '#ffffff',
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
                    colors={['#3B7E57', '#58A376']}
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
                    <AppIcon name={iconName} size={16} color="#FFFFFF" />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                        { color: '#FFFFFF' },
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
                    <AppIcon name={iconName} size={16} color="#6B7280" />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontSize: 14, fontWeight: '600' },
                        { color: '#6B7280' },
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
    <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <Text
        selectable
        style={{ fontSize: 16, fontWeight: '600', color: '#2c2c2e', marginBottom: 12 }}
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
                backgroundColor: isSelected ? '#f0f5f2' : '#f2f2f7',
                borderColor: isSelected ? '#c3d6cc' : '#f2f2f7',
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
                  { color: isSelected ? '#1F4D36' : '#374151' },
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
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16 }}>
        {selectedLogType === 'irrigation' && (
          <IrrigationForm
            data={irrigationData}
            onChange={setIrrigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'spray' && (
          <SprayForm data={sprayData} onChange={setSprayData} onInputFocus={scrollToFocusedInput} />
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
              backgroundColor: isLogFormValid && activeFarm ? '#408059' : '#E5E7EB',
            },
          ]}
        >
          <AppIcon name="add-circle" size={20} color={isLogFormValid ? '#FFFFFF' : '#9CA3AF'} />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600' },
              { color: isLogFormValid ? '#FFFFFF' : '#9CA3AF' },
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
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderColor: '#ffffff',
                paddingHorizontal: 16,
                paddingBottom: 12,
                paddingTop: 8 + insets.top,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ fontSize: 18, fontWeight: '600', color: '#2c2c2e' }}>
                    {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                  </Text>
                  <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
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
                  <AppIcon name="close-circle" size={26} color="#9CA3AF" />
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
          backgroundColor: '#ffffff',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderColor: '#ffffff',
          shadowColor: '#000',
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
              backgroundColor: isLogFormValid && activeFarm ? '#408059' : '#E5E7EB',
            },
          ]}
        >
          <AppIcon
            name="add-circle"
            size={20}
            color={isLogFormValid && activeFarm ? '#FFFFFF' : '#9CA3AF'}
          />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600', fontSize: 16 },
              { color: isLogFormValid && activeFarm ? '#FFFFFF' : '#9CA3AF' },
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
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <Text
          selectable
          style={{ fontSize: 16, fontWeight: '600', color: '#2c2c2e', marginBottom: 12 }}
        >
          {t('entryForm.pendingLogs', { count: pendingLogs.length })}
        </Text>
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
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
                { backgroundColor: '#F3F4F6' },
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
                <AppIcon name={logType?.icon ?? 'document-text'} size={18} color={logType?.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text selectable style={{ fontSize: 14, fontWeight: '600', color: '#2c2c2e' }}>
                  {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                </Text>
                <Text selectable style={{ fontSize: 12, color: '#8e8e93' }}>
                  {log.displayDescription}
                </Text>
              </View>
              <Pressable onPress={() => removeLogFromSession(log.id)}>
                <AppIcon name="trash-outline" size={20} color="#EF4444" />
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
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#ffffff',
          }}
        >
          <Text
            selectable
            style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
          >
            {t('entryForm.farmLabel')}
          </Text>
          <Pressable
            onPress={() => setShowLogFarmPicker(!showLogFarmPicker)}
            style={{
              backgroundColor: '#f2f2f7',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#f2f2f7',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={18} color="#408059" />
              <Text selectable style={{ fontSize: 16, color: '#2c2c2e', marginLeft: 8 }}>
                {activeFarm?.name || t('entryForm.selectFarm')}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={18} color="#9CA3AF" />
          </Pressable>
          {showLogFarmPicker && farms && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                marginTop: 8,
                borderWidth: 1,
                borderColor: '#f2f2f7',
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
                    borderColor: '#ffffff',
                    backgroundColor: activeFarm?.id === f.id ? '#f0f5f2' : '#ffffff',
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: activeFarm?.id === f.id ? '#2d5c3f' : '#48484a',
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
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#ffffff',
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
              backgroundColor: '#ffffff',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <AppIcon name="calendar" size={18} color="#408059" />
            <Text
              selectable
              style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: '#2c2c2e' }}
            >
              {formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </Pressable>

          {pendingLogs.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#e1ebe5',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <AppIcon name="document-text" size={14} color="#408059" />
              <Text
                selectable
                style={{ marginLeft: 4, fontSize: 12, fontWeight: '600', color: '#2d5c3f' }}
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
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#ffffff',
          }}
        >
          <Text selectable style={{ fontSize: 14, color: '#636366' }}>
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
            backgroundColor: '#f0f5f2',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <AppIcon name="flash" size={20} color="#408059" />
          <Text selectable style={{ color: '#2d5c3f', fontWeight: '500', marginLeft: 8, flex: 1 }}>
            {t('entryForm.useTemplate')}
          </Text>
          <AppIcon name={showTemplates ? 'chevron-up' : 'chevron-down'} size={20} color="#408059" />
        </Pressable>
      )}

      {showTemplates && (
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#f2f2f7',
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
                    borderColor: '#ffffff',
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
                    <Text selectable style={{ fontSize: 14, fontWeight: '500', color: '#2c2c2e' }}>
                      {template.title}
                    </Text>
                    <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
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
            style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
          >
            {t('entryForm.farmLabel')}
          </Text>
          <Pressable
            onPress={() => setShowTaskFarmPicker(!showTaskFarmPicker)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#f2f2f7',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="leaf" size={20} color="#408059" />
              <Text selectable style={{ fontSize: 16, color: '#2c2c2e', marginLeft: 8 }}>
                {selectedTaskFarm?.name || t('entryForm.selectFarm')}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={20} color="#9CA3AF" />
          </Pressable>
          {showTaskFarmPicker && farms && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                marginTop: 8,
                borderWidth: 1,
                borderColor: '#f2f2f7',
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
                    borderColor: '#ffffff',
                    backgroundColor: taskFarmId === f.id ? '#f0f5f2' : '#ffffff',
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: taskFarmId === f.id ? '#2d5c3f' : '#48484a',
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
          style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
        >
          {t('entryForm.taskForm.titleLabel')}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('entryForm.taskForm.titlePlaceholder')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: '#2c2c2e',
            borderWidth: 1,
            borderColor: '#f2f2f7',
          }}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text
          selectable
          style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
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
            backgroundColor: '#ffffff',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: '#2c2c2e',
            borderWidth: 1,
            borderColor: '#f2f2f7',
            minHeight: 80,
            textAlignVertical: 'top' as const,
          }}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
          >
            {t('entryForm.taskForm.typeLabel')}
          </Text>
          <Pressable
            onPress={() => setShowTypePicker(true)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#f2f2f7',
              height: 48,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon
                name={TASK_TYPE_INFO[type].icon}
                size={16}
                color={TASK_TYPE_INFO[type].color}
              />
              <Text selectable style={{ fontSize: 14, color: '#2c2c2e', marginLeft: 8 }}>
                {t(TASK_TYPE_INFO[type].labelKey)}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
          >
            {t('entryForm.taskForm.priorityLabel')}
          </Text>
          <Pressable
            onPress={() => setShowPriorityPicker(true)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#f2f2f7',
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
            <AppIcon name="chevron-down" size={16} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text
          selectable
          style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
        >
          {t('entryForm.taskForm.dueDateLabel')}
        </Text>
        <Pressable
          onPress={() => setShowDueDatePicker(true)}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: '#f2f2f7',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <AppIcon name="calendar" size={18} color={dueDate ? '#408059' : '#9CA3AF'} />
            <Text
              selectable
              style={[{ marginLeft: 8, fontSize: 16 }, { color: dueDate ? '#111827' : '#9CA3AF' }]}
            >
              {dueDate
                ? formatDate(new Date(dueDate), {
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
              <AppIcon name="close-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </Pressable>
        {showDueDatePicker && (
          <Modal
            transparent
            visible={showDueDatePicker}
            onRequestClose={() => setShowDueDatePicker(false)}
            animationType="fade"
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
              }}
              onPress={() => setShowDueDatePicker(false)}
            >
              <View
                style={{
                  backgroundColor: '#ffffff',
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
                  <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                    {t('entryForm.taskForm.selectDueDateTitle')}
                  </Text>
                  <Pressable onPress={() => setShowDueDatePicker(false)}>
                    <AppIcon name="close" size={24} color="#9CA3AF" />
                  </Pressable>
                </View>
                <DateTimePicker
                  value={dueDate ? new Date(dueDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    if (date) setDueDate(date.toISOString().split('T')[0]);
                  }}
                  style={{ height: 200 }}
                  textColor="#2c2c2e"
                />
                <Pressable
                  onPress={() => setShowDueDatePicker(false)}
                  style={[
                    { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                    { backgroundColor: '#408059' },
                  ]}
                >
                  <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>
                    {t('entryForm.done')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
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
            backgroundColor: '#ffffff',
            borderBottomWidth: 1,
            borderColor: '#ffffff',
            paddingHorizontal: 16,
            paddingBottom: 12,
            paddingTop: 8 + insets.top,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 48, height: 6, borderRadius: 999, backgroundColor: '#f2f2f7' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                selectable
                style={{ fontSize: 18, fontWeight: '600', color: '#2c2c2e' }}
                numberOfLines={1}
              >
                {activeTab === 'log'
                  ? t('entryForm.addLog')
                  : isEditingTask
                    ? t('entryForm.editTask')
                    : t('entryForm.addTask')}
              </Text>
              <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
                {activeFarm?.name}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={{ width: 40, alignItems: 'flex-end' }}>
              <AppIcon name="close-circle" size={26} color="#9CA3AF" />
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
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 50,
            }}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
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
                <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                  {t('entryForm.selectDate')}
                </Text>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <AppIcon name="close" size={24} color="#9CA3AF" />
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) setSelectedDate(date);
                }}
              />
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={[
                  { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                  { backgroundColor: '#408059' },
                ]}
              >
                <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>
                  {t('entryForm.done')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        {showTypePicker && (
          <Pressable
            onPress={() => setShowTypePicker(false)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 60,
            }}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
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
                <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                  {t('entryForm.selectTaskType')}
                </Text>
                <Pressable onPress={() => setShowTypePicker(false)}>
                  <AppIcon name="close" size={24} color="#9CA3AF" />
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
                      borderColor: '#ffffff',
                      backgroundColor: type === taskType ? '#f0f5f2' : '#ffffff',
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
                        color: type === taskType ? '#2d5c3f' : '#48484a',
                        fontWeight: type === taskType ? '500' : '400',
                      }}
                    >
                      {t(TASK_TYPE_INFO[taskType].labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        )}

        {showPriorityPicker && (
          <Pressable
            onPress={() => setShowPriorityPicker(false)}
            style={[
              {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                zIndex: 50,
              },
              { zIndex: 60 },
            ]}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
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
                <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                  {t('entryForm.selectPriority')}
                </Text>
                <Pressable onPress={() => setShowPriorityPicker(false)}>
                  <AppIcon name="close" size={24} color="#9CA3AF" />
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
                    borderColor: '#ffffff',
                    backgroundColor: priority === p ? '#f0f5f2' : '#ffffff',
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
                      color: priority === p ? '#2d5c3f' : '#48484a',
                      fontWeight: priority === p ? '500' : '400',
                    }}
                  >
                    {t(PRIORITY_INFO[p].labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
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
            backgroundColor: '#ffffff',
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderColor: '#ffffff',
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
                  borderColor: '#f2f2f7',
                  alignItems: 'center',
                }}
              >
                <Text selectable style={{ fontWeight: '600', color: '#636366' }}>
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
                        ? '#408059'
                        : '#E5E7EB',
                  },
                ]}
              >
                {isSubmittingLogs ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon
                      name="save"
                      size={18}
                      color={pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600' },
                        { color: pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF' },
                      ]}
                    >
                      {pendingLogs.length > 0
                        ? t('entryForm.saveLogs', { count: pendingLogs.length })
                        : t('common.save')}
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
                  borderColor: '#f2f2f7',
                  alignItems: 'center',
                }}
              >
                <Text selectable style={{ fontWeight: '600', color: '#636366' }}>
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
                  { backgroundColor: isTaskValid && !isTaskSaving ? '#408059' : '#E5E7EB' },
                ]}
              >
                {isTaskSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon name="save" size={18} color={isTaskValid ? '#FFFFFF' : '#9CA3AF'} />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600' },
                        { color: isTaskValid ? '#FFFFFF' : '#9CA3AF' },
                      ]}
                    >
                      {t('entryForm.saveTask')}
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
