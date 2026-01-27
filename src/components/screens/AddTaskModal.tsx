import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
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
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface Props {
  visible?: boolean;
  onClose: () => void;
  editingTask: TaskReminder | null;
  initialFarmId?: number | null;
  onSaveSuccess?: () => void;
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

export default function AddTaskModal({
  visible,
  onClose,
  editingTask,
  initialFarmId,
  onSaveSuccess,
  presentation = 'modal',
}: Props) {
  const isVisible = visible ?? true;
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
    if (isVisible) {
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
    prevVisibleRef.current = isVisible;
    prevEditingTaskIdRef.current = editingTask?.id;
    prevEditingTaskUpdatedAtRef.current = editingTask?.updated_at;
  }, [isVisible, editingTask, farms, initialFarmId]);
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

  const content = (
    <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.surface[50] }}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.surface[200],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[3],
            paddingTop: spacing[2],
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
            <View
              style={{
                width: 48,
                height: 6,
                borderRadius: borderRadius.full,
                backgroundColor: colors.surface[200],
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable onPress={onClose} disabled={isLoading}>
              <Text style={{ color: colors.primary[600], fontSize: fontSize.base }}>Cancel</Text>
            </Pressable>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
              }}
              numberOfLines={1}
            >
              {isEditing ? 'Edit Task' : 'Add Task'}
            </Text>
            <Pressable onPress={handleSubmit} disabled={isLoading}>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: isLoading ? colors.surface[400] : colors.primary[600],
                }}
              >
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Templates Button */}
          {!isEditing && (
            <Pressable
              onPress={() => setShowTemplates(!showTemplates)}
              style={{
                backgroundColor: colors.primary[50],
                borderRadius: borderRadius.xl,
                padding: spacing[4],
                marginBottom: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Symbol name="bolt.fill" size={20} color="#408059" />
              <Text
                style={{
                  color: colors.primary[700],
                  fontWeight: fontWeight.medium,
                  marginLeft: spacing[2],
                  flex: 1,
                }}
              >
                Use Template
              </Text>
              <Symbol
                name={showTemplates ? 'chevron.up' : 'chevron.down'}
                size={20}
                color="#408059"
              />
            </Pressable>
          )}

          {/* Templates List */}
          {showTemplates && (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: colors.surface[200],
                overflow: 'hidden',
              }}
            >
              <ScrollView style={{ maxHeight: 300 }}>
                {TASK_TEMPLATES.slice(0, 8).map((template) => {
                  const typeInfo = TASK_TYPE_INFO[template.type];
                  return (
                    <Pressable
                      key={template.id}
                      onPress={() => applyTemplate(template)}
                      style={{
                        padding: spacing[4],
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surface[100],
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: borderRadius.lg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: `${typeInfo.color}20`,
                        }}
                      >
                        <Symbol name={typeInfo.icon} size={16} color={typeInfo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing[3] }}>
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.medium,
                            color: colors.surface[900],
                          }}
                        >
                          {template.title}
                        </Text>
                        <Text
                          style={{ fontSize: fontSize.xs, color: colors.surface[500] }}
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

          {/* Farm Selector */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[700],
                marginBottom: spacing[2],
              }}
            >
              Farm *
            </Text>
            <Pressable
              onPress={() => setShowFarmPicker(!showFarmPicker)}
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Symbol name="leaf.fill" size={20} color="#408059" />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    color: colors.surface[900],
                    marginLeft: spacing[2],
                  }}
                >
                  {selectedFarm?.name || 'Select farm'}
                </Text>
              </View>
              <Symbol name="chevron.down" size={20} color="#9CA3AF" />
            </Pressable>
            {showFarmPicker && farms && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                  overflow: 'hidden',
                }}
              >
                {farms.map((farm) => (
                  <Pressable
                    key={farm.id}
                    onPress={() => {
                      if (farm.id) setFarmId(farm.id);
                      setShowFarmPicker(false);
                    }}
                    style={{
                      padding: spacing[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[100],
                      backgroundColor: farmId === farm.id ? colors.primary[50] : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: farmId === farm.id ? colors.primary[700] : colors.surface[700],
                        fontWeight: farmId === farm.id ? fontWeight.medium : fontWeight.normal,
                      }}
                    >
                      {farm.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Title */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[700],
                marginBottom: spacing[2],
              }}
            >
              Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter task title"
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: colors.surface[900],
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[700],
                marginBottom: spacing[2],
              }}
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
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: colors.surface[900],
                borderWidth: 1,
                borderColor: colors.surface[200],
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Type & Priority */}
          <View style={{ flexDirection: 'row', marginBottom: spacing[4], gap: spacing[3] }}>
            {/* Type */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.surface[700],
                  marginBottom: spacing[2],
                }}
              >
                Type
              </Text>
              <Pressable
                onPress={() => setShowTypePicker(!showTypePicker)}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Symbol
                    name={TASK_TYPE_INFO[type].icon}
                    size={16}
                    color={TASK_TYPE_INFO[type].color}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    {TASK_TYPE_INFO[type].label}
                  </Text>
                </View>
                <Symbol name="chevron.down" size={16} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Priority */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.surface[700],
                  marginBottom: spacing[2],
                }}
              >
                Priority
              </Text>
              <Pressable
                onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
              >
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.sm,
                    backgroundColor: PRIORITY_INFO[priority].bgColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: PRIORITY_INFO[priority].color,
                    }}
                  >
                    {PRIORITY_INFO[priority].label}
                  </Text>
                </View>
                <Symbol name="chevron.down" size={16} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>

          {/* Type Picker */}
          {showTypePicker && (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: colors.surface[200],
                overflow: 'hidden',
              }}
            >
              {TASK_TYPES.map((taskType) => (
                <Pressable
                  key={taskType}
                  onPress={() => {
                    setType(taskType);
                    setShowTypePicker(false);
                  }}
                  style={{
                    padding: spacing[4],
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor: type === taskType ? colors.primary[50] : 'transparent',
                  }}
                >
                  <Symbol
                    name={TASK_TYPE_INFO[taskType].icon}
                    size={18}
                    color={TASK_TYPE_INFO[taskType].color}
                  />
                  <Text
                    style={{
                      marginLeft: spacing[3],
                      color: type === taskType ? colors.primary[700] : colors.surface[700],
                      fontWeight: type === taskType ? fontWeight.medium : fontWeight.normal,
                    }}
                  >
                    {TASK_TYPE_INFO[taskType].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Priority Picker */}
          {showPriorityPicker && (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: colors.surface[200],
                overflow: 'hidden',
              }}
            >
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPriority(p);
                    setShowPriorityPicker(false);
                  }}
                  style={{
                    padding: spacing[4],
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[100],
                    backgroundColor: priority === p ? colors.primary[50] : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: PRIORITY_INFO[p].bgColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.bold,
                        color: PRIORITY_INFO[p].color,
                      }}
                    >
                      {p.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={{
                      marginLeft: spacing[3],
                      color: priority === p ? colors.primary[700] : colors.surface[700],
                      fontWeight: priority === p ? fontWeight.medium : fontWeight.normal,
                    }}
                  >
                    {PRIORITY_INFO[p].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Due Date */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[700],
                marginBottom: spacing[2],
              }}
            >
              Due Date
            </Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD (e.g., 2024-01-25)"
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: colors.surface[900],
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
              placeholderTextColor="#9CA3AF"
            />
            <Text
              style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: spacing[1] }}
            >
              Enter date in YYYY-MM-DD format
            </Text>
          </View>
        </ScrollView>
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
