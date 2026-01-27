/**
 * Add Entry Modal
 * Unified modal for creating farm logs and tasks with tabbed layout.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Pressable,
  type TextInputProps,
  Keyboard,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

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
import { LOG_TYPES, type LogTypeId } from '@/constants/calculatorModels';
import {
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpdateFarmWaterLevel,
  useFarms,
} from '@/hooks';
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import {
  TaskReminder,
  TaskType,
  TaskPriority,
  TaskTemplate,
  TASK_TYPE_INFO,
  PRIORITY_INFO,
} from '@/types/task';
import { TASK_TEMPLATES } from '@/constants/taskTemplates';
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';

type EntryTab = 'log' | 'task';

interface AddEntryModalProps {
  visible: boolean;
  onClose: () => void;
  tabs?: EntryTab[];
  initialTab?: EntryTab;
  farm?: Farm;
  initialFarmId?: number | null;
  initialLogType?: LogTypeId | null;
  editingTask?: TaskReminder | null;
  onLogSaveSuccess?: () => void;
  onTaskSaveSuccess?: () => void;
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

export function AddEntryModal({
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
}: AddEntryModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const isIOS = process.env.EXPO_OS === 'ios';
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
    if (!visible) return;
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
  }, [visible, defaultTab, farm?.id, farms, initialFarmId, selectedFarmId]);

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

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: 0 });
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
    if (visible && initialLogType) {
      setSelectedLogType(initialLogType);
      setShowLogFormModal(true);
    }
  }, [visible, initialLogType]);

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
        setIrrigationData({ duration: 0 });
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
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    try {
      for (const log of pendingLogs) {
        switch (log.type) {
          case 'irrigation': {
            const data = log.data as IrrigationFormData;
            await createIrrigation.mutateAsync({
              farm_id: activeFarm.id,
              date: dateStr,
              duration: data.duration,
              area: activeFarm.area,
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
              const waterAdded = data.duration * activeFarm.system_discharge;
              const currentWater = activeFarm.remaining_water ?? 0;
              const newWaterLevel = Math.min(
                activeFarm.total_tank_capacity,
                currentWater + waterAdded,
              );
              await updateWaterLevel.mutateAsync({
                farmId: activeFarm.id,
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
              farm_id: activeFarm.id,
              date: dateStr,
              chemical: chemicalStr,
              dose: `Water: ${data.waterVolume}L`,
              area: activeFarm.area,
              weather: '',
              operator: '',
              date_of_pruning: activeFarm.date_of_pruning,
            });
            break;
          }
          case 'harvest': {
            const data = log.data as HarvestFormData;
            await createHarvest.mutateAsync({
              farm_id: activeFarm.id,
              date: dateStr,
              quantity: data.quantity,
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
              farm_id: activeFarm.id,
              date: dateStr,
              type: data.type,
              cost: data.cost,
              date_of_pruning: activeFarm.date_of_pruning,
              remarks: data.remarks || undefined,
            });
            break;
          }
          case 'fertigation': {
            const data = log.data as FertigationFormData;
            await createFertigation.mutateAsync({
              farm_id: activeFarm.id,
              date: dateStr,
              fertilizers: data.fertilizers.map((f) => ({
                name: f.name,
                unit: f.unit,
                quantity: f.quantity,
              })),
              area: activeFarm.area,
              date_of_pruning: activeFarm.date_of_pruning,
            });
            break;
          }
        }
      }

      setPendingLogs([]);
      onLogSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving logs:', error);
      Alert.alert('Error', 'Failed to save logs. Please try again.');
    } finally {
      setIsSubmittingLogs(false);
    }
  };

  // Task state
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEditingTask = !!editingTask;
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
    if (!visible) {
      prevVisibleRef.current = visible;
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

    prevVisibleRef.current = visible;
    prevEditingTaskIdRef.current = editingTask?.id;
    prevEditingTaskUpdatedAtRef.current = editingTask?.updated_at;
  }, [visible, editingTask, farms, initialFarmId, farm?.id]);

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
      Alert.alert('Error', 'Please enter a task title');
      return;
    }
    const resolvedFarmId = farm?.id ?? taskFarmId;
    if (!resolvedFarmId) {
      Alert.alert('Error', 'Please select a farm');
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

    try {
      if (isEditingTask && editingTask?.id) {
        await updateTask.mutateAsync({
          id: editingTask.id,
          updates: taskData,
        });
      } else {
        await createTask.mutateAsync(taskData);
      }
      onTaskSaveSuccess?.();
      onClose();
    } catch (_error) {
      Alert.alert('Error', 'Failed to save task. Please try again.');
    }
  };

  const selectedTaskFarm = farms?.find((f) => f.id === taskFarmId);

  const handleClose = () => {
    const hasUnsavedTaskChanges =
      activeTab === 'task' && (title.trim() || description.trim() || dueDate);

    if (pendingLogs.length > 0 || hasUnsavedTaskChanges) {
      Alert.alert(
        'Discard Changes?',
        hasUnsavedTaskChanges && pendingLogs.length === 0
          ? 'You have unsaved task changes. Are you sure you want to close?'
          : pendingLogs.length > 0 && !hasUnsavedTaskChanges
            ? 'You have unsaved logs. Are you sure you want to close?'
            : 'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
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
            const label = tab === 'log' ? 'Farm Log' : 'Task';
            const iconName = tab === 'log' ? 'document-text' : 'checkbox-outline';
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  { flex: 1, borderRadius: 999, overflow: 'hidden' },
                  { marginHorizontal: 2 },
                ]}
                activeOpacity={0.8}
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
              </TouchableOpacity>
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
        Activity Type
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ACTIVITY_TYPES.map((logType) => {
          const isSelected = selectedLogType === logType.id;
          return (
            <TouchableOpacity
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
              activeOpacity={0.8}
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
                {logType.label}
              </Text>
            </TouchableOpacity>
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

        <TouchableOpacity
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
          activeOpacity={0.8}
        >
          <AppIcon name="add-circle" size={20} color={isLogFormValid ? '#FFFFFF' : '#9CA3AF'} />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600' },
              { color: isLogFormValid ? '#FFFFFF' : '#9CA3AF' },
            ]}
          >
            Add Entry
          </Text>
        </TouchableOpacity>
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
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : 'height'}
            keyboardVerticalOffset={isIOS ? 0 : 20}
            style={{ flex: 1, backgroundColor: '#f2f2f7' }}
          >
            <View
              style={{
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderColor: '#ffffff',
                paddingHorizontal: 16,
                paddingBottom: 12,
                paddingTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ fontSize: 18, fontWeight: '600', color: '#2c2c2e' }}>
                    {logType?.label ?? 'Add Log'}
                  </Text>
                  <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
                    {activeFarm?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowLogFormModal(false);
                    setSelectedLogType(null);
                  }}
                  style={{ width: 40, alignItems: 'flex-end' }}
                >
                  <AppIcon name="close-circle" size={26} color="#9CA3AF" />
                </TouchableOpacity>
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
        </ScrollView>
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
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        <TouchableOpacity
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
          activeOpacity={0.8}
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
            Add Entry
          </Text>
        </TouchableOpacity>
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
          Pending Logs ({pendingLogs.length})
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
                  {logType?.label}
                </Text>
                <Text selectable style={{ fontSize: 12, color: '#8e8e93' }}>
                  {log.displayDescription}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeLogFromSession(log.id)}>
                <AppIcon name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
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
            Farm *
          </Text>
          <TouchableOpacity
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
                {activeFarm?.name || 'Select farm'}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
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
                <TouchableOpacity
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
                </TouchableOpacity>
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
          <TouchableOpacity
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
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

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
                {pendingLogs.length} draft{pendingLogs.length !== 1 ? 's' : ''}
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
            Select an activity type to open the full-screen form.
          </Text>
        </View>
      )}
      {renderPendingLogs()}
    </>
  );

  const renderTaskContent = () => (
    <>
      {!isEditingTask && (
        <TouchableOpacity
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
            Use Template
          </Text>
          <AppIcon name={showTemplates ? 'chevron-up' : 'chevron-down'} size={20} color="#408059" />
        </TouchableOpacity>
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
                <TouchableOpacity
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
                </TouchableOpacity>
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
            Farm *
          </Text>
          <TouchableOpacity
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
                {selectedTaskFarm?.name || 'Select farm'}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>
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
                <TouchableOpacity
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
                </TouchableOpacity>
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
          Title *
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter task title"
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
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add details about this task"
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
            Type
          </Text>
          <TouchableOpacity
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
                {TASK_TYPE_INFO[type].label}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            selectable
            style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
          >
            Priority
          </Text>
          <TouchableOpacity
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
                {PRIORITY_INFO[priority].label}
              </Text>
            </View>
            <AppIcon name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text
          selectable
          style={{ fontSize: 14, fontWeight: '500', color: '#48484a', marginBottom: 8 }}
        >
          Due Date
        </Text>
        <TouchableOpacity
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
                ? new Date(dueDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Select due date'}
            </Text>
          </View>
          {dueDate && (
            <TouchableOpacity onPress={() => setDueDate('')} style={{ marginLeft: 8, padding: 4 }}>
              <AppIcon name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {showDueDatePicker && !isIOS && (
          <DateTimePicker
            value={dueDate ? new Date(dueDate) : new Date()}
            mode="date"
            onChange={(_, date) => {
              setShowDueDatePicker(false);
              if (date) {
                setDueDate(date.toISOString().split('T')[0]);
              }
            }}
          />
        )}
        {showDueDatePicker && isIOS && (
          <Pressable
            onPress={() => setShowDueDatePicker(false)}
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
                  Select Due Date
                </Text>
                <TouchableOpacity onPress={() => setShowDueDatePicker(false)}>
                  <AppIcon name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dueDate ? new Date(dueDate) : new Date()}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (date) setDueDate(date.toISOString().split('T')[0]);
                }}
              />
              <TouchableOpacity
                onPress={() => setShowDueDatePicker(false)}
                style={[
                  { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                  { backgroundColor: '#408059' },
                ]}
              >
                <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <KeyboardAvoidingView
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? 0 : 20}
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderBottomWidth: 1,
              borderColor: '#ffffff',
              paddingHorizontal: 16,
              paddingBottom: 12,
              paddingTop: 8,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{ width: 48, height: 6, borderRadius: 999, backgroundColor: '#f2f2f7' }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40 }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  selectable
                  style={{ fontSize: 18, fontWeight: '600', color: '#2c2c2e' }}
                  numberOfLines={1}
                >
                  {activeTab === 'log' ? 'Add Log' : isEditingTask ? 'Edit Task' : 'Add Task'}
                </Text>
                <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
                  {activeFarm?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={{ width: 40, alignItems: 'flex-end' }}>
                <AppIcon name="close-circle" size={26} color="#9CA3AF" />
              </TouchableOpacity>
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
                    Select Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <AppIcon name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={(_, date) => {
                    if (date) setSelectedDate(date);
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                    { backgroundColor: '#408059' },
                  ]}
                >
                  <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          )}

          {showTypePicker && (
            <Pressable
              onPress={() => setShowTypePicker(false)}
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
                    Select Task Type
                  </Text>
                  <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                    <AppIcon name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ maxHeight: 320 }}>
                  {TASK_TYPES.map((taskType) => (
                    <TouchableOpacity
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
                        {TASK_TYPE_INFO[taskType].label}
                      </Text>
                    </TouchableOpacity>
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
                    Select Priority
                  </Text>
                  <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                    <AppIcon name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
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
                      {PRIORITY_INFO[p].label}
                    </Text>
                  </TouchableOpacity>
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
                <TouchableOpacity
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
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
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
                        {pendingLogs.length > 0 ? `Save Logs (${pendingLogs.length})` : 'Save'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
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
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
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
                        Save Task
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </Modal>
  );
}
