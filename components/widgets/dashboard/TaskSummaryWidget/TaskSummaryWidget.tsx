import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BaseWidgetProps, LoadingState } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'overdue' | 'due' | 'upcoming';

export interface TaskItem {
  id: string;
  nameKey: string;
  dueLabelKey: string;
  status: TaskStatus;
  accentColor: string;
}

export interface TaskSummaryWidgetProps extends BaseWidgetProps {
  /** Override the demo task list (optional). */
  tasks?: TaskItem[];
  loadingState?: LoadingState;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const ACTIVITY_COLORS = {
  irrigation: '#4d8573',
  spray: '#598d6b',
  fertigation: '#408059',
  harvest: '#669475',
} as const;

const DEMO_TASKS: TaskItem[] = [
  {
    id: '1',
    nameKey: 'widgets.taskSummary.labels.irrigationBlockA',
    dueLabelKey: 'widgets.taskSummary.labels.dueToday',
    status: 'due',
    accentColor: ACTIVITY_COLORS.irrigation,
  },
  {
    id: '2',
    nameKey: 'widgets.taskSummary.labels.sprayFungicide',
    dueLabelKey: 'widgets.taskSummary.labels.overdue',
    status: 'overdue',
    accentColor: ACTIVITY_COLORS.spray,
  },
  {
    id: '3',
    nameKey: 'widgets.taskSummary.labels.fertigationRound3',
    dueLabelKey: 'widgets.taskSummary.labels.tomorrow',
    status: 'upcoming',
    accentColor: ACTIVITY_COLORS.fertigation,
  },
  {
    id: '4',
    nameKey: 'widgets.taskSummary.labels.harvestSampling',
    dueLabelKey: 'widgets.taskSummary.labels.in3Days',
    status: 'upcoming',
    accentColor: ACTIVITY_COLORS.harvest,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TaskStatus,
  { labelKey: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  overdue: { labelKey: 'widgets.taskSummary.status.overdue', icon: 'alert-circle' },
  due: { labelKey: 'widgets.taskSummary.status.dueToday', icon: 'time-outline' },
  upcoming: { labelKey: 'widgets.taskSummary.status.upcoming', icon: 'calendar-outline' },
};

function useStatusColors(status: TaskStatus) {
  const m3 = useM3();

  switch (status) {
    case 'overdue':
      return {
        text: m3.colorScheme.error,
        bg: colorWithOpacity(m3.colorScheme.error, 0.12),
      };
    case 'due':
      return {
        text: m3.colorScheme.warning,
        bg: colorWithOpacity(m3.colorScheme.warning, 0.12),
      };
    case 'upcoming':
      return {
        text: m3.colorScheme.primary,
        bg: colorWithOpacity(m3.colorScheme.primary, 0.12),
      };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusPill: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const { text, bg } = useStatusColors(status);
  const config = STATUS_CONFIG[status];
  const { t } = useTranslation();

  return (
    <View
      testID={`status-pill-${status}`}
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityLabel={`Status: ${t(config.labelKey)}`}
    >
      <Ionicons name={config.icon} size={12} color={text} />
      <Text style={[styles.pillText, { color: text }]}>{t(config.labelKey)}</Text>
    </View>
  );
};

const TaskRow: React.FC<{ task: TaskItem; isLast: boolean }> = ({ task, isLast }) => {
  const m3 = useM3();
  const { t } = useTranslation();

  return (
    <View
      testID={`task-${task.id}`}
      style={[
        styles.taskRow,
        { borderLeftColor: task.accentColor },
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: m3.colorScheme.outlineVariant,
        },
      ]}
      accessibilityLabel={`${t(task.nameKey)}, ${t(task.dueLabelKey)}, ${t(STATUS_CONFIG[task.status].labelKey)}`}
      accessibilityRole="text"
    >
      <View style={styles.taskInfo}>
        <Text
          testID={`task-${task.id}-name`}
          style={[styles.taskName, { color: m3.colorScheme.onSurface }]}
          numberOfLines={1}
        >
          {t(task.nameKey)}
        </Text>
        <Text
          testID={`task-${task.id}-due`}
          style={[styles.taskDue, { color: m3.colorScheme.onSurfaceVariant }]}
        >
          {t(task.dueLabelKey)}
        </Text>
      </View>
      <StatusPill status={task.status} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export const TaskSummaryWidget: React.FC<TaskSummaryWidgetProps> = ({
  testID,
  accessibilityLabel = 'Upcoming tasks summary',
  style,
  tasks = DEMO_TASKS,
  loadingState = 'idle',
  onRetry,
}) => {
  const { t } = useTranslation();
  const m3 = useM3();

  const overdueCount = tasks.filter((task) => task.status === 'overdue').length;

  if (loadingState === 'loading') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Text style={[styles.message, { color: m3.colorScheme.onSurfaceVariant }]}>
          {t('widgets.common.loading')}
        </Text>
      </View>
    );
  }

  if (loadingState === 'error') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: m3.surface.surfaceContainerLow,
            borderColor: m3.colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons name="alert-circle" size={32} color={m3.colorScheme.error} style={styles.icon} />
        <Text style={[styles.message, { color: m3.colorScheme.error }]}>
          {t('widgets.common.error')}
        </Text>
        {onRetry && (
          <Pressable onPress={onRetry}>
            <Text style={[styles.retry, { color: m3.colorScheme.primary }]}>
              {t('widgets.common.retry')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: m3.surface.surfaceContainerLow,
          borderColor: m3.colorScheme.outlineVariant,
        },
        shadows.sm,
        style,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="checkbox-outline"
            size={20}
            color={m3.colorScheme.primary}
            style={styles.headerIcon}
          />
          <Text
            testID={`${testID || 'task-summary-widget'}-title`}
            style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}
          >
            {t('widgets.taskSummary.title')}
          </Text>
        </View>

        <View style={styles.headerBadges}>
          {overdueCount > 0 && (
            <View
              testID={`${testID || 'task-summary-widget'}-overdue-badge`}
              style={[
                styles.badge,
                { backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12) },
              ]}
              accessibilityLabel={`${overdueCount} overdue`}
            >
              <Text style={[styles.badgeText, { color: m3.colorScheme.error }]}>
                {t('widgets.taskSummary.overdueCount', { count: overdueCount })}
              </Text>
            </View>
          )}
          <View
            testID={`${testID || 'task-summary-widget'}-total-badge`}
            style={[
              styles.badge,
              { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
            ]}
            accessibilityLabel={`${tasks.length} total tasks`}
          >
            <Text style={[styles.badgeText, { color: m3.colorScheme.primary }]}>
              {t('widgets.taskSummary.tasksCount', { count: tasks.length })}
            </Text>
          </View>
        </View>
      </View>

      {/* Task list */}
      {tasks.length === 0 ? (
        <View style={[styles.centered, { minHeight: 100 }]}>
          <Ionicons
            name="checkbox-outline"
            size={32}
            color={m3.colorScheme.onSurfaceVariant}
            style={styles.icon}
          />
          <Text style={[styles.message, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t('widgets.taskSummary.empty')}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tasks.map((task, index) => (
            <TaskRow key={task.id} task={task} isLast={index === tasks.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6],
  },
  icon: {
    marginBottom: spacing[2],
  },
  message: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  retry: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing[3],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerIcon: {
    marginRight: spacing[2],
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // Task list
  list: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    paddingLeft: spacing[3],
    paddingVertical: spacing[3],
  },
  taskInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  taskName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  taskDue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    marginTop: 2,
  },

  // Status pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
