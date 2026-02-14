import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, shadows, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskStatus = 'overdue' | 'due' | 'upcoming';

interface TaskItem {
  id: string;
  name: string;
  dueLabel: string;
  status: TaskStatus;
  accentColor: string;
}

export interface TaskSummaryWidgetProps extends BaseWidgetProps {
  /** Override the demo task list (optional). */
  tasks?: TaskItem[];
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
    name: 'Irrigation - Block A',
    dueLabel: 'Due today',
    status: 'due',
    accentColor: ACTIVITY_COLORS.irrigation,
  },
  {
    id: '2',
    name: 'Spray - Fungicide',
    dueLabel: 'Overdue',
    status: 'overdue',
    accentColor: ACTIVITY_COLORS.spray,
  },
  {
    id: '3',
    name: 'Fertigation Round 3',
    dueLabel: 'Tomorrow',
    status: 'upcoming',
    accentColor: ACTIVITY_COLORS.fertigation,
  },
  {
    id: '4',
    name: 'Harvest Sampling',
    dueLabel: 'In 3 days',
    status: 'upcoming',
    accentColor: ACTIVITY_COLORS.harvest,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  overdue: { label: 'Overdue', icon: 'alert-circle' },
  due: { label: 'Due today', icon: 'time-outline' },
  upcoming: { label: 'Upcoming', icon: 'calendar-outline' },
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

  return (
    <View
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityLabel={`Status: ${config.label}`}
    >
      <Ionicons name={config.icon} size={12} color={text} />
      <Text style={[styles.pillText, { color: text }]}>{config.label}</Text>
    </View>
  );
};

const TaskRow: React.FC<{ task: TaskItem; isLast: boolean }> = ({ task, isLast }) => {
  const m3 = useM3();

  return (
    <View
      style={[
        styles.taskRow,
        { borderLeftColor: task.accentColor },
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: m3.colorScheme.outlineVariant,
        },
      ]}
      accessibilityLabel={`${task.name}, ${task.dueLabel}, ${STATUS_CONFIG[task.status].label}`}
      accessibilityRole="text"
    >
      <View style={styles.taskInfo}>
        <Text style={[styles.taskName, { color: m3.colorScheme.onSurface }]} numberOfLines={1}>
          {task.name}
        </Text>
        <Text style={[styles.taskDue, { color: m3.colorScheme.onSurfaceVariant }]}>
          {task.dueLabel}
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
}) => {
  const m3 = useM3();

  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;

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
          <Text style={[styles.headerTitle, { color: m3.colorScheme.onSurface }]}>
            Upcoming Tasks
          </Text>
        </View>

        <View style={styles.headerBadges}>
          {overdueCount > 0 && (
            <View
              style={[
                styles.badge,
                { backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12) },
              ]}
              accessibilityLabel={`${overdueCount} overdue`}
            >
              <Text style={[styles.badgeText, { color: m3.colorScheme.error }]}>
                {overdueCount} overdue
              </Text>
            </View>
          )}
          <View
            style={[
              styles.badge,
              { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12) },
            ]}
            accessibilityLabel={`${tasks.length} total tasks`}
          >
            <Text style={[styles.badgeText, { color: m3.colorScheme.primary }]}>
              {tasks.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Task list */}
      <View style={styles.list}>
        {tasks.map((task, index) => (
          <TaskRow key={task.id} task={task} isLast={index === tasks.length - 1} />
        ))}
      </View>
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
