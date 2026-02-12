/**
 * TaskRow Component
 * M3-styled compact list item for tasks.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { TaskReminder } from '@/types/task';
import { PRIORITY_INFO, TASK_TYPE_INFO } from '@/types/task';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { triggerHaptic, triggerHapticWarning } from '@/utils/haptics';
import { stripTaskPlanFromDescription } from '@/utils/task-plan';

interface TaskRowProps {
  task: TaskReminder;
  farmName?: string;
  showFarmName?: boolean;
  onComplete?: (task: TaskReminder) => void;
  onEdit?: (task: TaskReminder) => void;
  onDelete?: (task: TaskReminder) => void;
  onLogFromTask?: (task: TaskReminder) => void;
}

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export function TaskRow({
  task,
  farmName,
  showFarmName = false,
  onComplete,
  onEdit,
  onDelete,
  onLogFromTask,
}: TaskRowProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const typeInfo = TASK_TYPE_INFO[task.type];
  const priorityInfo = PRIORITY_INFO[task.priority];
  const cleanDescription = stripTaskPlanFromDescription(task.description);

  const today = startOfDay(new Date());
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = !task.completed && dueDate ? dueDate < today : false;

  const formatDueDate = () => {
    if (!task.due_date) return t('tasks.dueDate.none');
    const date = new Date(task.due_date);
    const display = formatDate(date, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return t('tasks.dueDate.today');
    if (date.toDateString() === tomorrow.toDateString()) return t('tasks.dueDate.tomorrow');
    if (date < today) return t('tasks.dueDate.overdue', { date: display });
    return display;
  };

  const priorityTone =
    task.priority === 'high'
      ? {
          fg: m3.colorScheme.error,
          bg: m3.colorScheme.errorContainer,
        }
      : task.priority === 'medium'
        ? {
            fg: m3.colorScheme.warning,
            bg: colorWithOpacity(m3.colorScheme.warning, 0.18),
          }
        : {
            fg: m3.colorScheme.primary,
            bg: colorWithOpacity(m3.colorScheme.primary, 0.12),
          };

  return (
    <View
      style={{
        borderRadius: m3.shape.cornerLarge,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        backgroundColor: m3.surface.surfaceContainerLow,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
        opacity: task.completed ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable
          onPress={() => {
            if (!task.completed && onComplete) {
              triggerHaptic();
              onComplete(task);
            }
          }}
          disabled={task.completed || !onComplete}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.a11y.completeTask', { title: task.title })}
          style={({ pressed }) => ({
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
            marginTop: 2,
            backgroundColor: task.completed
              ? m3.colorScheme.primary
              : pressed
                ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                : 'transparent',
            borderColor: task.completed ? m3.colorScheme.primary : m3.colorScheme.outlineVariant,
          })}
        >
          {task.completed && (
            <UiSymbol name="checkmark" size={16} color={m3.colorScheme.onPrimary} />
          )}
        </Pressable>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: borderRadius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing[2],
                backgroundColor: colorWithOpacity(typeInfo.color, 0.14),
              }}
            >
              <UiSymbol
                name={resolveSymbolIconName(typeInfo.icon)}
                size={14}
                color={typeInfo.color}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                flex: 1,
                color: task.completed ? m3.colorScheme.onSurfaceVariant : m3.colorScheme.onSurface,
                textDecorationLine: task.completed ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </Text>
          </View>

          {cleanDescription && (
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                marginTop: spacing[1],
              }}
              numberOfLines={2}
            >
              {cleanDescription}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: spacing[2],
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {showFarmName && farmName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol
                  name="leaf.fill"
                  size={12}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)}
                />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    marginLeft: spacing[1],
                  }}
                >
                  {farmName}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
                borderRadius: borderRadius.sm,
                backgroundColor: overdue
                  ? m3.colorScheme.errorContainer
                  : m3.surface.surfaceContainerHigh,
              }}
            >
              <UiSymbol
                name="calendar"
                size={12}
                color={overdue ? m3.colorScheme.error : m3.colorScheme.onSurfaceVariant}
              />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  marginLeft: spacing[1],
                  color: overdue ? m3.colorScheme.error : m3.colorScheme.onSurfaceVariant,
                  fontWeight: overdue ? fontWeight.medium : fontWeight.normal,
                }}
              >
                {formatDueDate()}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: priorityTone.bg,
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
                borderRadius: borderRadius.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: priorityTone.fg,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                }}
              >
                {t(priorityInfo.labelKey)}
              </Text>
            </View>

            {!task.completed &&
            (task.type === 'spray' || task.type === 'fertigation') &&
            onLogFromTask ? (
              <Pressable
                onPress={() => onLogFromTask(task)}
                style={{
                  marginTop: spacing[2],
                  alignSelf: 'flex-start',
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: m3.colorScheme.primary,
                  }}
                >
                  {t('tasks.logNow')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          {!task.completed && onEdit && (
            <Pressable
              onPress={() => onEdit(task)}
              accessibilityRole="button"
              accessibilityLabel={t('tasks.a11y.editTask', { title: task.title })}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: m3.shape.cornerMedium,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              })}
            >
              <UiSymbol name="pencil" size={16} color={m3.colorScheme.primary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={() => {
                triggerHapticWarning();
                onDelete(task);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('tasks.a11y.deleteTask', { title: task.title })}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: m3.shape.cornerMedium,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              })}
            >
              <UiSymbol name="trash" size={16} color={m3.colorScheme.error} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
