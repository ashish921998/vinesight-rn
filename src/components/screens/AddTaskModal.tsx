import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';

import { useFarms } from '../../hooks';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import {
  TaskReminder,
  TaskType,
  TaskPriority,
  TaskTemplate,
  TASK_TYPE_INFO,
  PRIORITY_INFO,
} from '../../types/task';
import { TASK_TEMPLATES } from '../../constants/taskTemplates';

interface Props {
  visible: boolean;
  onClose: () => void;
  editingTask: TaskReminder | null;
  initialFarmId?: number | null;
  onSaveSuccess?: () => void;
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

export default function AddTaskModal({
  visible,
  onClose,
  editingTask,
  initialFarmId,
  onSaveSuccess,
}: Props) {
  const { data: farms } = useFarms();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('note');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [farmId, setFarmId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const isEditing = !!editingTask;

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(false);
  const prevEditingTaskIdRef = useRef<number | null | undefined>(undefined);
  const prevEditingTaskUpdatedAtRef = useRef<string | undefined>(undefined);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('note');
    setPriority('medium');
    setDueDate('');
    setShowTypePicker(false);
    setShowPriorityPicker(false);
    setShowFarmPicker(false);
    setShowTemplates(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Update when modal becomes visible, editingTask changes, or task data is updated
    if (visible) {
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
          setFarmId(editingTask.farm_id);
          setDueDate(editingTask.due_date || '');
        } else {
          resetForm();
          // Set initial farm if provided, otherwise use first farm
          if (initialFarmId) {
            setFarmId(initialFarmId);
          } else if (farms && farms.length > 0 && farms[0].id) {
            setFarmId(farms[0].id);
          }
        }
      }
    }
    prevVisibleRef.current = visible;
    prevEditingTaskIdRef.current = editingTask?.id;
    prevEditingTaskUpdatedAtRef.current = editingTask?.updated_at;
  }, [visible, editingTask, farms, initialFarmId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const applyTemplate = (template: TaskTemplate) => {
    setTitle(template.title);
    setDescription(template.description);
    setType(template.type);
    setPriority(template.priority);
    setShowTemplates(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }
    if (!farmId) {
      Alert.alert('Error', 'Please select a farm');
      return;
    }

    const taskData = {
      farm_id: farmId,
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
      if (isEditing && editingTask?.id) {
        await updateMutation.mutateAsync({
          id: editingTask.id,
          updates: taskData,
        });
      } else {
        await createMutation.mutateAsync(taskData);
      }
      onSaveSuccess?.();
      onClose();
    } catch (_error) {
      Alert.alert('Error', 'Failed to save task. Please try again.');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const selectedFarm = farms?.find((f) => f.id === farmId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-surface-50">
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-surface-50"
        >
          {/* Header */}
          <View className="bg-white border-b border-surface-200 px-4 pb-3 pt-2">
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 rounded-full bg-surface-200" />
            </View>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={onClose} disabled={isLoading}>
                <Text className="text-primary-600 text-base">Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-surface-900" numberOfLines={1}>
                {isEditing ? 'Edit Task' : 'Add Task'}
              </Text>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
                <Text
                  className={`text-base font-semibold ${
                    isLoading ? 'text-surface-400' : 'text-primary-600'
                  }`}
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {/* Templates Button */}
            {!isEditing && (
              <TouchableOpacity
                onPress={() => setShowTemplates(!showTemplates)}
                className="bg-primary-50 rounded-xl p-4 mb-4 flex-row items-center"
              >
                <Symbol name="bolt.fill" size={20} color="#408059" />
                <Text className="text-primary-700 font-medium ml-2 flex-1">Use Template</Text>
                <Symbol
                  name={showTemplates ? 'chevron.up' : 'chevron.down'}
                  size={20}
                  color="#408059"
                />
              </TouchableOpacity>
            )}

            {/* Templates List */}
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
                          <Symbol name={typeInfo.icon} size={16} color={typeInfo.color} />
                        </View>
                        <View className="flex-1 ml-3">
                          <Text className="text-sm font-medium text-surface-900">
                            {template.title}
                          </Text>
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

            {/* Farm Selector */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-surface-700 mb-2">Farm *</Text>
              <TouchableOpacity
                onPress={() => setShowFarmPicker(!showFarmPicker)}
                className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
              >
                <View className="flex-row items-center">
                  <Symbol name="leaf.fill" size={20} color="#408059" />
                  <Text className="text-base text-surface-900 ml-2">
                    {selectedFarm?.name || 'Select farm'}
                  </Text>
                </View>
                <Symbol name="chevron.down" size={20} color="#9CA3AF" />
              </TouchableOpacity>
              {showFarmPicker && farms && (
                <View className="bg-white rounded-xl mt-2 border border-surface-200 overflow-hidden">
                  {farms.map((farm) => (
                    <TouchableOpacity
                      key={farm.id}
                      onPress={() => {
                        if (farm.id) setFarmId(farm.id);
                        setShowFarmPicker(false);
                      }}
                      className={`p-4 border-b border-surface-100 ${
                        farmId === farm.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <Text
                        className={
                          farmId === farm.id ? 'text-primary-700 font-medium' : 'text-surface-700'
                        }
                      >
                        {farm.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Title */}
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

            {/* Description */}
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

            {/* Type & Priority */}
            <View className="flex-row mb-4" style={{ gap: 12 }}>
              {/* Type */}
              <View className="flex-1">
                <Text className="text-sm font-medium text-surface-700 mb-2">Type</Text>
                <TouchableOpacity
                  onPress={() => setShowTypePicker(!showTypePicker)}
                  className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
                >
                  <View className="flex-row items-center">
                    <Symbol
                      name={TASK_TYPE_INFO[type].icon}
                      size={16}
                      color={TASK_TYPE_INFO[type].color}
                    />
                    <Text className="text-sm text-surface-900 ml-2">
                      {TASK_TYPE_INFO[type].label}
                    </Text>
                  </View>
                  <Symbol name="chevron.down" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Priority */}
              <View className="flex-1">
                <Text className="text-sm font-medium text-surface-700 mb-2">Priority</Text>
                <TouchableOpacity
                  onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                  className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
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
                  <Symbol name="chevron.down" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Type Picker */}
            {showTypePicker && (
              <View className="bg-white rounded-xl mb-4 border border-surface-200 overflow-hidden">
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
                    <Symbol
                      name={TASK_TYPE_INFO[taskType].icon}
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
              </View>
            )}

            {/* Priority Picker */}
            {showPriorityPicker && (
              <View className="bg-white rounded-xl mb-4 border border-surface-200 overflow-hidden">
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
                      className="w-6 h-6 rounded items-center justify-center"
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
            )}

            {/* Due Date */}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
