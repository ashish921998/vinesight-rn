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
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  editingTask,
  onLogSaveSuccess,
  onTaskSaveSuccess,
}: AddEntryModalProps) {
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
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [isSubmittingLogs, setIsSubmittingLogs] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Track keyboard visibility
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

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
      <View className="px-4 pt-2 pb-3">
        <View className="bg-surface-100 rounded-full p-1 flex-row">
          {resolvedTabs.map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'log' ? 'Farm Log' : 'Task';
            const iconName = tab === 'log' ? 'document-text' : 'checkbox-outline';
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="flex-1 rounded-full overflow-hidden"
                style={{ marginHorizontal: 2 }}
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
                    <Ionicons name={iconName} size={16} color="#FFFFFF" />
                    <Text className="ml-2 text-sm font-semibold" style={{ color: '#FFFFFF' }}>
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
                    <Ionicons name={iconName} size={16} color="#6B7280" />
                    <Text className="ml-2 text-sm font-semibold" style={{ color: '#6B7280' }}>
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
    <View className="bg-white rounded-2xl p-4 mb-4">
      <Text className="text-base font-semibold text-surface-900 mb-3">Activity Type</Text>
      <View className="flex-row justify-between">
        {ACTIVITY_TYPES.map((logType) => {
          const isSelected = selectedLogType === logType.id;
          return (
            <TouchableOpacity
              key={logType.id}
              onPress={() => setSelectedLogType(logType.id as LogTypeId)}
              className={`items-center rounded-xl border ${
                isSelected ? 'bg-primary-50 border-primary-200' : 'bg-surface-50 border-surface-200'
              }`}
              style={{ width: '18%', paddingVertical: 10 }}
              activeOpacity={0.8}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mb-1.5"
                style={{
                  backgroundColor: isSelected ? `${logType.color}20` : `${logType.color}12`,
                }}
              >
                <Ionicons
                  name={logType.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={logType.color}
                />
              </View>
              <Text
                className="text-[10px] font-semibold text-center leading-3"
                style={{ color: isSelected ? '#1F4D36' : '#374151' }}
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
      <View className="bg-white rounded-2xl p-4">
        {selectedLogType === 'irrigation' && (
          <IrrigationForm data={irrigationData} onChange={setIrrigationData} />
        )}
        {selectedLogType === 'spray' && <SprayForm data={sprayData} onChange={setSprayData} />}
        {selectedLogType === 'harvest' && (
          <HarvestForm data={harvestData} onChange={setHarvestData} />
        )}
        {selectedLogType === 'expense' && (
          <ExpenseForm data={expenseData} onChange={setExpenseData} />
        )}
        {selectedLogType === 'fertigation' && (
          <FertigationForm data={fertigationData} onChange={setFertigationData} />
        )}

        {/* Inline Add Entry button for non-keyboard mode */}
        {!isKeyboardVisible && (
          <TouchableOpacity
            onPress={addLogToSession}
            disabled={!isLogFormValid || !activeFarm}
            className="mt-4 py-3 rounded-xl items-center flex-row justify-center"
            style={{
              backgroundColor: isLogFormValid && activeFarm ? '#408059' : '#E5E7EB',
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color={isLogFormValid ? '#FFFFFF' : '#9CA3AF'} />
            <Text
              className="ml-2 font-semibold"
              style={{ color: isLogFormValid ? '#FFFFFF' : '#9CA3AF' }}
            >
              Add Entry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render sticky add entry button above keyboard
  const renderStickyAddButton = () => {
    if (!isLogFormValid || !selectedLogType) return null;

    return (
      <View
        className="bg-white px-4 py-3 border-t border-surface-100"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <TouchableOpacity
          onPress={addLogToSession}
          disabled={!isLogFormValid || !activeFarm}
          className="py-3.5 rounded-xl items-center flex-row justify-center"
          style={{
            backgroundColor: isLogFormValid && activeFarm ? '#408059' : '#E5E7EB',
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle"
            size={20}
            color={isLogFormValid && activeFarm ? '#FFFFFF' : '#9CA3AF'}
          />
          <Text
            className="ml-2 font-semibold text-base"
            style={{ color: isLogFormValid && activeFarm ? '#FFFFFF' : '#9CA3AF' }}
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
      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="text-base font-semibold text-surface-900 mb-3">
          Pending Logs ({pendingLogs.length})
        </Text>
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
          return (
            <View
              key={log.id}
              className="flex-row items-center p-3 rounded-xl mb-2"
              style={{ backgroundColor: '#F3F4F6' }}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: `${logType?.color}15` }}
              >
                <Ionicons
                  name={logType?.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={logType?.color}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-surface-900">{logType?.label}</Text>
                <Text className="text-xs text-surface-500">{log.displayDescription}</Text>
              </View>
              <TouchableOpacity onPress={() => removeLogFromSession(log.id)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
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
        <View className="bg-white rounded-2xl p-4 mb-4 border border-surface-100">
          <Text className="text-sm font-medium text-surface-700 mb-2">Farm *</Text>
          <TouchableOpacity
            onPress={() => setShowLogFarmPicker(!showLogFarmPicker)}
            className="bg-surface-50 rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
          >
            <View className="flex-row items-center">
              <Ionicons name="leaf" size={18} color="#408059" />
              <Text className="text-base text-surface-900 ml-2">
                {activeFarm?.name || 'Select farm'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          {showLogFarmPicker && farms && (
            <View className="bg-white rounded-xl mt-2 border border-surface-200 overflow-hidden">
              {farms.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => {
                    if (f.id) setSelectedFarmId(f.id);
                    setShowLogFarmPicker(false);
                  }}
                  className={`p-4 border-b border-surface-100 ${
                    activeFarm?.id === f.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <Text
                    className={
                      activeFarm?.id === f.id ? 'text-primary-700 font-medium' : 'text-surface-700'
                    }
                  >
                    {f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View className="bg-white rounded-2xl p-4 mb-4 border border-surface-100">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center bg-surface-100 px-4 py-2 rounded-lg"
          >
            <Ionicons name="calendar" size={18} color="#408059" />
            <Text className="ml-2 text-sm font-medium text-surface-900">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {pendingLogs.length > 0 && (
            <View className="flex-row items-center bg-primary-100 px-3 py-1.5 rounded-full">
              <Ionicons name="document-text" size={14} color="#408059" />
              <Text className="ml-1 text-xs font-semibold text-primary-700">
                {pendingLogs.length} draft{pendingLogs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {renderLogTypeSelector()}
      {renderLogForm()}
      {renderPendingLogs()}
    </>
  );

  const renderTaskContent = () => (
    <>
      {!isEditingTask && (
        <TouchableOpacity
          onPress={() => setShowTemplates(!showTemplates)}
          className="bg-primary-50 rounded-xl p-4 mb-4 flex-row items-center"
        >
          <Ionicons name="flash" size={20} color="#408059" />
          <Text className="text-primary-700 font-medium ml-2 flex-1">Use Template</Text>
          <Ionicons
            name={showTemplates ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#408059"
          />
        </TouchableOpacity>
      )}

      {showTemplates && (
        <View className="bg-white rounded-xl mb-4 border border-surface-200 overflow-hidden">
          <ScrollView style={{ maxHeight: 300 }}>
            {TASK_TEMPLATES.slice(0, 8).map((template) => {
              const typeInfo = TASK_TYPE_INFO[template.type];
              return (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => applyTemplate(template)}
                  className="p-4 border-b border-surface-100 flex-row items-center"
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${typeInfo.color}20` }}
                  >
                    <Ionicons
                      name={typeInfo.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={typeInfo.color}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-medium text-surface-900">{template.title}</Text>
                    <Text className="text-xs text-surface-500" numberOfLines={1}>
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
        <View className="mb-4">
          <Text className="text-sm font-medium text-surface-700 mb-2">Farm *</Text>
          <TouchableOpacity
            onPress={() => setShowTaskFarmPicker(!showTaskFarmPicker)}
            className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
          >
            <View className="flex-row items-center">
              <Ionicons name="leaf" size={20} color="#408059" />
              <Text className="text-base text-surface-900 ml-2">
                {selectedTaskFarm?.name || 'Select farm'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          {showTaskFarmPicker && farms && (
            <View className="bg-white rounded-xl mt-2 border border-surface-200 overflow-hidden">
              {farms.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => {
                    if (f.id) setTaskFarmId(f.id);
                    setShowTaskFarmPicker(false);
                  }}
                  className={`p-4 border-b border-surface-100 ${
                    taskFarmId === f.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <Text
                    className={
                      taskFarmId === f.id ? 'text-primary-700 font-medium' : 'text-surface-700'
                    }
                  >
                    {f.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View className="mb-4">
        <Text className="text-sm font-medium text-surface-700 mb-2">Title *</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter task title"
          className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-surface-700 mb-2">Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add details about this task"
          multiline
          numberOfLines={3}
          className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
          placeholderTextColor="#9CA3AF"
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </View>

      <View className="flex-row mb-4" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="text-sm font-medium text-surface-700 mb-2">Type</Text>
          <TouchableOpacity
            onPress={() => setShowTypePicker(true)}
            className="bg-white rounded-xl px-4 flex-row items-center justify-between border border-surface-200 h-12"
          >
            <View className="flex-row items-center">
              <Ionicons
                name={TASK_TYPE_INFO[type].icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={TASK_TYPE_INFO[type].color}
              />
              <Text className="text-sm text-surface-900 ml-2">{TASK_TYPE_INFO[type].label}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className="flex-1">
          <Text className="text-sm font-medium text-surface-700 mb-2">Priority</Text>
          <TouchableOpacity
            onPress={() => setShowPriorityPicker(true)}
            className="bg-white rounded-xl px-4 flex-row items-center justify-between border border-surface-200 h-12"
          >
            <View
              className="px-2 py-0.5 rounded"
              style={{ backgroundColor: PRIORITY_INFO[priority].bgColor }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: PRIORITY_INFO[priority].color }}
              >
                {PRIORITY_INFO[priority].label}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-surface-700 mb-2">Due Date</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD (e.g., 2024-01-25)"
          className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
          placeholderTextColor="#9CA3AF"
        />
        <Text className="text-xs text-surface-500 mt-1">Enter date in YYYY-MM-DD format</Text>
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          className="flex-1 bg-surface-50"
        >
          <View className="bg-white border-b border-surface-100 px-4 pb-3 pt-2">
            <View className="items-center mb-2">
              <View className="w-12 h-1.5 rounded-full bg-surface-200" />
            </View>
            <View className="flex-row items-center">
              <View className="w-10" />
              <View className="flex-1 items-center">
                <Text className="text-lg font-semibold text-surface-900">
                  {activeTab === 'log' ? 'Add Log' : isEditingTask ? 'Edit Task' : 'Add Task'}
                </Text>
                <Text className="text-xs text-surface-500" numberOfLines={1}>
                  {activeFarm?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} className="w-10 items-end">
                <Ionicons name="close-circle" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {renderTabs()}

          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
          {showDatePicker && Platform.OS === 'ios' && (
            <Pressable
              onPress={() => setShowDatePicker(false)}
              className="absolute inset-0 bg-black/50 z-50"
            >
              <View
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4"
                onStartShouldSetResponder={() => true}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold text-surface-900">Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
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
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{ backgroundColor: '#408059' }}
                >
                  <Text className="font-semibold text-white">Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          )}

          {showTypePicker && (
            <Pressable
              onPress={() => setShowTypePicker(false)}
              className="absolute inset-0 bg-black/40 z-50"
              style={{ zIndex: 60 }}
            >
              <View
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4"
                onStartShouldSetResponder={() => true}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-bold text-surface-900">Select Task Type</Text>
                  <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <ScrollView className="max-h-80">
                  {TASK_TYPES.map((taskType) => (
                    <TouchableOpacity
                      key={taskType}
                      onPress={() => {
                        setType(taskType);
                        setShowTypePicker(false);
                      }}
                      className={`p-4 flex-row items-center border-b border-surface-100 ${
                        type === taskType ? 'bg-primary-50' : ''
                      }`}
                    >
                      <Ionicons
                        name={TASK_TYPE_INFO[taskType].icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={TASK_TYPE_INFO[taskType].color}
                      />
                      <Text
                        className={`ml-3 ${
                          type === taskType ? 'text-primary-700 font-medium' : 'text-surface-700'
                        }`}
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
              className="absolute inset-0 bg-black/40 z-50"
              style={{ zIndex: 60 }}
            >
              <View
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4"
                onStartShouldSetResponder={() => true}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-bold text-surface-900">Select Priority</Text>
                  <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => {
                      setPriority(p);
                      setShowPriorityPicker(false);
                    }}
                    className={`p-4 flex-row items-center border-b border-surface-100 ${
                      priority === p ? 'bg-primary-50' : ''
                    }`}
                  >
                    <View
                      className="w-7 h-7 rounded items-center justify-center"
                      style={{ backgroundColor: PRIORITY_INFO[p].bgColor }}
                    >
                      <Text className="text-xs font-bold" style={{ color: PRIORITY_INFO[p].color }}>
                        {p.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      className={`ml-3 ${
                        priority === p ? 'text-primary-700 font-medium' : 'text-surface-700'
                      }`}
                    >
                      {PRIORITY_INFO[p].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          )}

          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            showsVerticalScrollIndicator={true}
          >
            {activeTab === 'log' ? renderLogContent() : renderTaskContent()}
          </ScrollView>

          {/* Sticky Add Entry button above keyboard */}
          {activeTab === 'log' && isKeyboardVisible && renderStickyAddButton()}

          <View className="bg-white px-4 py-4 border-t border-surface-100">
            {activeTab === 'log' ? (
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={handleClose}
                  className="flex-1 py-3.5 rounded-xl border border-surface-200 items-center"
                >
                  <Text className="font-semibold text-surface-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveAllLogs}
                  disabled={pendingLogs.length === 0 || isSubmittingLogs || !activeFarm}
                  className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
                  style={{
                    backgroundColor:
                      pendingLogs.length > 0 && !isSubmittingLogs && activeFarm
                        ? '#408059'
                        : '#E5E7EB',
                  }}
                >
                  {isSubmittingLogs ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="save"
                        size={18}
                        color={pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF'}
                      />
                      <Text
                        className="ml-2 font-semibold"
                        style={{ color: pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF' }}
                      >
                        Save {pendingLogs.length > 0 ? `(${pendingLogs.length})` : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={handleClose}
                  className="flex-1 py-3.5 rounded-xl border border-surface-200 items-center"
                >
                  <Text className="font-semibold text-surface-600">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTaskSubmit}
                  disabled={!isTaskValid || isTaskSaving}
                  className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
                  style={{ backgroundColor: isTaskValid && !isTaskSaving ? '#408059' : '#E5E7EB' }}
                >
                  {isTaskSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="save" size={18} color={isTaskValid ? '#FFFFFF' : '#9CA3AF'} />
                      <Text
                        className="ml-2 font-semibold"
                        style={{ color: isTaskValid ? '#FFFFFF' : '#9CA3AF' }}
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
      </SafeAreaView>
    </Modal>
  );
}
