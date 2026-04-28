/**
 * TaskRow Component
 * Apple Reminders-style compact row: severity bar, checkbox, type chip, title, kebab menu, single meta pill.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Platform,
  type ViewStyle,
  type AlertButton,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { TaskReminder } from '@/types/task';
import { PRIORITY_INFO, TASK_TYPE_INFO } from '@/types/task';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { triggerHaptic, triggerHapticWarning } from '@/utils/haptics';
import { stripTaskPlanFromDescription } from '@/utils/task-plan';
import { parseDbDateToLocalDate } from '@/utils/date';

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
  const colors = useThemeColors();
  const typeInfo = TASK_TYPE_INFO[task.type];
  const priorityInfo = PRIORITY_INFO[task.priority];
  const cleanDescription = stripTaskPlanFromDescription(task.description);

  const today = startOfDay(new Date());
  const dueDate = task.due_date
    ? startOfDay(parseDbDateToLocalDate(task.due_date) ?? new Date(task.due_date))
    : null;

  const formatDueDate = (): string => {
    if (!task.due_date) return '';
    const date = parseDbDateToLocalDate(task.due_date) ?? new Date(task.due_date);
    const display = formatDate(date, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return t('tasks.dueDate.today');
    if (date.toDateString() === tomorrow.toDateString()) return t('tasks.dueDate.tomorrow');
    if (!task.completed && dueDate && dueDate < today) {
      return t('tasks.dueDate.overdue', { date: display });
    }
    return display;
  };

  const priorityTone =
    task.priority === 'high'
      ? {
          fg: colors.error,
          bg: colorWithOpacity(colors.error, 0.12),
        }
      : task.priority === 'medium'
        ? {
            fg: colors.warning,
            bg: colorWithOpacity(colors.warning, 0.18),
          }
        : {
            fg: colors.primary[500],
            bg: colorWithOpacity(colors.primary[500], 0.12),
          };

  // Dim meta pill colors when task is completed
  const metaFg = task.completed ? colorWithOpacity(priorityTone.fg, 0.5) : priorityTone.fg;
  const metaBg = task.completed ? colorWithOpacity(priorityTone.fg, 0.06) : priorityTone.bg;

  const dateText = formatDueDate();
  const priorityText = t(priorityInfo.labelKey);
  const metaText = dateText ? `${dateText} · ${priorityText}` : priorityText;

  // Build action sheet buttons. Hide kebab if no applicable actions.
  const buildActionButtons = (): AlertButton[] => {
    const buttons: AlertButton[] = [];
    if (!task.completed && onEdit) {
      buttons.push({ text: t('common.edit'), onPress: () => onEdit(task) });
    }
    if (
      !task.completed &&
      (task.type === 'spray' || task.type === 'fertigation') &&
      onLogFromTask
    ) {
      buttons.push({ text: t('tasks.logNow'), onPress: () => onLogFromTask(task) });
    }
    if (onDelete) {
      buttons.push({
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          triggerHapticWarning();
          onDelete(task);
        },
      });
    }
    if (buttons.length > 0 && !(Platform.OS === 'android' && buttons.length >= 3)) {
      buttons.push({ text: t('common.cancel'), style: 'cancel' });
    }
    return buttons;
  };

  const actionButtons = buildActionButtons();
  const hasActions = actionButtons.length > 0;

  const openActionMenu = () => {
    Alert.alert(t('tasks.actions.menuTitle'), task.title, actionButtons);
  };

  // Card with left severity bar via borderLeft, full perimeter via outer border tokens.
  const containerStyle: ViewStyle = {
    borderRadius: borderRadius.sm, // 12px
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface[100], // mist-1
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.surface[300],
    borderRightColor: colors.surface[300],
    borderBottomColor: colors.surface[300],
    borderLeftWidth: 4,
    borderLeftColor: priorityTone.fg,
  };

  return (
    <View style={containerStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Circular checkbox (22px) */}
        <Pressable
          onPress={() => {
            if (!task.completed && onComplete) {
              triggerHaptic();
              onComplete(task);
            }
          }}
          disabled={task.completed || !onComplete}
          hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.a11y.completeTask', { title: task.title })}
          style={({ pressed }) => ({
            width: 22,
            height: 22,
            borderRadius: borderRadius.full,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
            marginTop: 2,
            backgroundColor: task.completed
              ? colors.success
              : pressed
                ? colorWithOpacity(colors.surface[900], 0.12)
                : 'transparent',
            borderColor: task.completed ? colors.success : colors.surface[300],
          })}
        >
          {task.completed && <UiSymbol name="checkmark" size={12} color="#FFFFFF" />}
        </Pressable>

        <View style={{ flex: 1 }}>
          {/* Title row: type chip + title + kebab */}
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
                fontSize: 15,
                fontWeight: fontWeight.semibold,
                flex: 1,
                color: task.completed ? colors.surface[400] : colors.surface[900],
                textDecorationLine: task.completed ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </Text>
            {hasActions && (
              <Pressable
                onPress={openActionMenu}
                accessibilityRole="button"
                accessibilityLabel={t('tasks.a11y.taskActions', { title: task.title })}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: m3.shape.cornerMedium,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: spacing[1],
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                    : 'transparent',
                })}
              >
                <UiSymbol name="ellipsis" size={18} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            )}
          </View>

          {/* Description */}
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

          {/* Optional farm chip */}
          {showFarmName && farmName ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing[2],
              }}
            >
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

          {/* Single combined meta pill (date · priority) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              paddingHorizontal: spacing[2] + 2,
              paddingVertical: 2,
              borderRadius: borderRadius.sm,
              backgroundColor: metaBg,
              marginTop: spacing[2],
            }}
          >
            <Text
              style={{
                color: metaFg,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
              }}
            >
              {metaText}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
