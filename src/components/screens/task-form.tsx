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
  Platform,
} from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';

import { useFarms } from '../../hooks';
import { useCreateTask, useUpdateTask } from '../../hooks/use-tasks';
import {
  TaskReminder,
  TaskType,
  TaskPriority,
  TaskTemplate,
  TASK_TYPE_INFO,
  PRIORITY_INFO,
} from '../../types/task';
import { TASK_TEMPLATES } from '../../constants/task-templates';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useNotificationStore } from '@/stores';
import {
  decodeTaskPlanFromDescription,
  encodeTaskPlanInDescription,
  stripTaskPlanFromDescription,
} from '@/utils/task-plan';
import {
  ensureNotificationPermissions,
  scheduleTaskDueReminder,
  cancelNotification,
} from '@/services/notifications';
import { useTranslation } from 'react-i18next';

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

export default function TaskForm({
  visible,
  onClose,
  editingTask,
  initialFarmId,
  onSaveSuccess,
  presentation = 'modal',
}: Props) {
  const { t } = useTranslation();
  const m3 = useM3();

  const isVisible = visible ?? true;
  const { data: farms } = useFarms();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  const taskRemindersEnabled = useNotificationStore((s) => s.taskRemindersEnabled);
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const upsertTaskSchedule = useNotificationStore((s) => s.upsertTaskSchedule);
  const removeTaskSchedule = useNotificationStore((s) => s.removeTaskSchedule);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('note');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [farmId, setFarmId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [dueDateError, setDueDateError] = useState<string | null>(null);
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
          setDescription(stripTaskPlanFromDescription(editingTask.description || ''));
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
    if (isVisible && !editingTask && !farmId && farms && farms.length > 0 && farms[0]?.id) {
      setFarmId(farms[0].id);
    }
    prevVisibleRef.current = isVisible;
    prevEditingTaskIdRef.current = editingTask?.id;
    prevEditingTaskUpdatedAtRef.current = editingTask?.updated_at;
  }, [isVisible, editingTask, farms, initialFarmId, farmId]);
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
      Alert.alert(t('common.error'), t('tasks.form.errors.missingTitle'));
      return;
    }
    if (!farmId) {
      Alert.alert(t('common.error'), t('tasks.form.errors.missingFarm'));
      return;
    }
    if (dueDate) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(dueDate)) {
        setDueDateError(t('tasks.form.dueDateErrors.format'));
        return;
      }
      const [yearStr, monthStr, dayStr] = dueDate.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      const candidate = new Date(year, month - 1, day);
      const isValidDate =
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day;
      if (!isValidDate) {
        setDueDateError(t('tasks.form.dueDateErrors.invalidDate'));
        return;
      }
    }
    setDueDateError(null);

    const cleanedDescription = stripTaskPlanFromDescription(description).trim();
    const existingPlannedInputs =
      editingTask?.planned_inputs && editingTask.planned_inputs.length > 0
        ? editingTask.planned_inputs
        : decodeTaskPlanFromDescription(editingTask?.description);
    const shouldPreservePlan =
      Boolean(editingTask?.id) &&
      (type === 'spray' || type === 'fertigation') &&
      existingPlannedInputs.length > 0;
    const nextDescription = shouldPreservePlan
      ? encodeTaskPlanInDescription(cleanedDescription, existingPlannedInputs)
      : cleanedDescription || null;

    const taskData = {
      farm_id: farmId,
      title: title.trim(),
      description: nextDescription,
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

    let saved: TaskReminder | null = null;
    try {
      if (isEditing && editingTask?.id) {
        saved = await updateMutation.mutateAsync({
          id: editingTask.id,
          updates: taskData,
        });
      } else {
        saved = await createMutation.mutateAsync(taskData);
      }
    } catch (_error) {
      Alert.alert(t('common.error'), t('tasks.form.errors.failedToSave'));
      return;
    }

    // Task notifications (localized) are scheduled locally - handle separately from save errors
    if (saved?.id) {
      const taskId = String(saved.id);
      const existing = taskSchedules[taskId];

      try {
        if (existing?.notificationIds?.length) {
          await Promise.allSettled(existing.notificationIds.map((id) => cancelNotification(id)));
          removeTaskSchedule(taskId);
        }

        if (taskRemindersEnabled && saved.due_date) {
          const granted = await ensureNotificationPermissions();
          if (granted) {
            const notificationIds = await scheduleTaskDueReminder(taskId, saved.due_date);
            if (notificationIds.length > 0) {
              upsertTaskSchedule(taskId, { notificationIds, dueDate: saved.due_date });
            }
          }
        }
      } catch (notificationError) {
        if (__DEV__) {
          console.error('Failed to schedule task notification:', notificationError);
        }
      }
    }

    onSaveSuccess?.();
    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const selectedFarm = farms?.find((f) => f.id === farmId);

  const content = (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: '#ffffff',
            borderBottomWidth: 1,
            borderBottomColor: m3.surface.s200,
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
                backgroundColor: m3.surface.s200,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable onPress={onClose} disabled={isLoading} style={{ minWidth: 72 }}>
              <Text style={{ color: m3.primary.p600, fontSize: fontSize.base }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <View
              style={{ flex: 1, minWidth: 0, paddingHorizontal: spacing[2], alignItems: 'center' }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                  textAlign: 'center',
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isEditing ? t('tasks.form.editTitle') : t('tasks.form.addTitle')}
              </Text>
            </View>
            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={{ minWidth: 72, alignItems: 'flex-end' }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: isLoading ? m3.surface.s400 : m3.primary.p600,
                }}
              >
                {isLoading ? t('tasks.form.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Templates Button */}
          {!isEditing && (
            <Pressable
              onPress={() => setShowTemplates(!showTemplates)}
              style={{
                backgroundColor: m3.primary.p50,
                borderRadius: borderRadius.xl,
                padding: spacing[4],
                marginBottom: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <IconSymbol name="bolt.fill" size={20} color={m3.colorScheme.primary} />
              <Text
                style={{
                  color: m3.primary.p700,
                  fontWeight: fontWeight.medium,
                  marginLeft: spacing[2],
                  flex: 1,
                }}
              >
                {t('tasks.form.useTemplate')}
              </Text>
              <IconSymbol
                name={showTemplates ? 'chevron.up' : 'chevron.down'}
                size={20}
                color={m3.colorScheme.primary}
              />
            </Pressable>
          )}

          {/* Templates List */}
          {showTemplates && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: m3.surface.s200,
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
                        borderBottomColor: m3.surface.s100,
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
                        <IconSymbol name={typeInfo.icon} size={16} color={typeInfo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing[3] }}>
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.medium,
                            color: m3.surface.s900,
                          }}
                        >
                          {template.title}
                        </Text>
                        <Text
                          style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}
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
                color: m3.surface.s700,
                marginBottom: spacing[2],
              }}
            >
              {t('tasks.form.fields.farm')} *
            </Text>
            <Pressable
              onPress={() => setShowFarmPicker(!showFarmPicker)}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: m3.surface.s200,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconSymbol name="leaf.fill" size={20} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    color: m3.surface.s900,
                    marginLeft: spacing[2],
                  }}
                >
                  {selectedFarm?.name || t('tasks.form.selectFarm')}
                </Text>
              </View>
              <IconSymbol name="chevron.down" size={20} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
            {showFarmPicker && farms && (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  borderWidth: 1,
                  borderColor: m3.surface.s200,
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
                      borderBottomColor: m3.surface.s100,
                      backgroundColor: farmId === farm.id ? m3.primary.p50 : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: farmId === farm.id ? m3.primary.p700 : m3.surface.s700,
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
                color: m3.surface.s700,
                marginBottom: spacing[2],
              }}
            >
              {t('tasks.form.fields.title')} *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('tasks.form.placeholders.title')}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: m3.surface.s900,
                borderWidth: 1,
                borderColor: m3.surface.s200,
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </View>

          {/* Description */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: m3.surface.s700,
                marginBottom: spacing[2],
              }}
            >
              {t('tasks.form.fields.description')}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('tasks.form.placeholders.description')}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: m3.surface.s900,
                borderWidth: 1,
                borderColor: m3.surface.s200,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
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
                  color: m3.surface.s700,
                  marginBottom: spacing[2],
                }}
              >
                {t('tasks.form.fields.type')}
              </Text>
              <Pressable
                onPress={() => setShowTypePicker(!showTypePicker)}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: m3.surface.s200,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconSymbol
                    name={TASK_TYPE_INFO[type].icon}
                    size={16}
                    color={TASK_TYPE_INFO[type].color}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: m3.surface.s900,
                      marginLeft: spacing[2],
                    }}
                  >
                    {t(TASK_TYPE_INFO[type].labelKey)}
                  </Text>
                </View>
                <IconSymbol name="chevron.down" size={16} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            </View>

            {/* Priority */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.surface.s700,
                  marginBottom: spacing[2],
                }}
              >
                {t('tasks.form.fields.priority')}
              </Text>
              <Pressable
                onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: borderRadius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: m3.surface.s200,
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
                    {t(PRIORITY_INFO[priority].labelKey)}
                  </Text>
                </View>
                <IconSymbol name="chevron.down" size={16} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            </View>
          </View>

          {/* Type Picker */}
          {showTypePicker && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: m3.surface.s200,
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
                    borderBottomColor: m3.surface.s100,
                    backgroundColor: type === taskType ? m3.primary.p50 : 'transparent',
                  }}
                >
                  <IconSymbol
                    name={TASK_TYPE_INFO[taskType].icon}
                    size={18}
                    color={TASK_TYPE_INFO[taskType].color}
                  />
                  <Text
                    style={{
                      marginLeft: spacing[3],
                      color: type === taskType ? m3.primary.p700 : m3.surface.s700,
                      fontWeight: type === taskType ? fontWeight.medium : fontWeight.normal,
                    }}
                  >
                    {t(TASK_TYPE_INFO[taskType].labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Priority Picker */}
          {showPriorityPicker && (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                marginBottom: spacing[4],
                borderWidth: 1,
                borderColor: m3.surface.s200,
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
                    borderBottomColor: m3.surface.s100,
                    backgroundColor: priority === p ? m3.primary.p50 : 'transparent',
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
                      color: priority === p ? m3.primary.p700 : m3.surface.s700,
                      fontWeight: priority === p ? fontWeight.medium : fontWeight.normal,
                    }}
                  >
                    {t(PRIORITY_INFO[p].labelKey)}
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
                color: m3.surface.s700,
                marginBottom: spacing[2],
              }}
            >
              {t('tasks.form.fields.dueDate')}
            </Text>
            <TextInput
              value={dueDate}
              onChangeText={(value) => {
                setDueDate(value);
                if (dueDateError) {
                  setDueDateError(null);
                }
              }}
              placeholder={t('tasks.form.placeholders.dueDate')}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                fontSize: fontSize.base,
                color: m3.surface.s900,
                borderWidth: 1,
                borderColor: dueDateError ? m3.colorScheme.error : m3.surface.s200,
              }}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
            {dueDateError ? (
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.error,
                  marginTop: spacing[1],
                }}
              >
                {dueDateError}
              </Text>
            ) : null}
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: spacing[1] }}>
              {t('tasks.form.dueDateHint')}
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
