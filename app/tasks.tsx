import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAdvancedRouteGuard } from '@/components/advanced-route-guard';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Symbol as SFSymbol } from '@/components/ui/symbol';
import { useFarms } from '../src/hooks';
import { useAllTasks, useCompleteTask, useDeleteTask } from '../src/hooks/use-tasks';
import { TaskReminder } from '../src/types/task';
import { useModalStore, useNotificationStore } from '@/stores';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { cancelNotification } from '@/services/notifications';
import { TaskRow } from '@/components/cards';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { decodeTaskPlanFromDescription } from '@/utils/task-plan';
import { parseDbDateToLocalDate } from '@/utils/date';

// Cellar Ledger: Filter and due status types
type FilterType = 'pending' | 'overdue' | 'completed' | 'all';
type TaskDueStatus = 'overdue' | 'today' | 'upcoming' | 'done';

const cleanupTaskNotifications = (
  taskId: string,
  taskSchedules: Record<string, { notificationIds?: string[] }>,
  removeTaskSchedule: (taskId: string) => void,
) => {
  const schedule = taskSchedules[taskId];
  if (schedule) {
    if (schedule.notificationIds?.length) {
      void Promise.allSettled(schedule.notificationIds.map(cancelNotification)).then(() =>
        removeTaskSchedule(taskId),
      );
    } else {
      removeTaskSchedule(taskId);
    }
  }
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/** Parse a DB date string to a local midnight Date, falling back to new Date(). */
const dueDateToStartOfDay = (raw: string): Date =>
  startOfDay(parseDbDateToLocalDate(raw) ?? new Date(raw));

// Cellar Ledger: Get task due date status
const getTaskDueStatus = (task: TaskReminder): TaskDueStatus => {
  if (task.completed) return 'done';
  if (!task.due_date) return 'upcoming';

  const today = startOfDay(new Date());
  const dueDate = dueDateToStartOfDay(task.due_date);

  if (dueDate < today) return 'overdue';
  if (dueDate.getTime() === today.getTime()) return 'today';
  return 'upcoming';
};

// Cellar Ledger: Compute summary counts
const computeSummaryCounts = (tasks: TaskReminder[] | null | undefined) => {
  if (!tasks) return { pending: 0, dueToday: 0, overdue: 0 };

  const today = startOfDay(new Date());
  let pending = 0;
  let dueToday = 0;
  let overdue = 0;

  tasks.forEach((task) => {
    if (task.completed) return;
    pending++;

    if (task.due_date) {
      const dueDate = dueDateToStartOfDay(task.due_date);
      if (dueDate < today) {
        overdue++;
      } else if (dueDate.getTime() === today.getTime()) {
        dueToday++;
      }
    }
  });

  return { pending, dueToday, overdue };
};

function TasksScreen() {
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId, filter: routeFilter } = useLocalSearchParams<{
    farmId?: string;
    filter?: FilterType;
  }>();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();
  const { data: tasks, isLoading, refetch, isRefetching } = useAllTasks();
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const removeTaskSchedule = useNotificationStore((s) => s.removeTaskSchedule);

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const initialFilter: FilterType =
    routeFilter === 'pending' ||
    routeFilter === 'overdue' ||
    routeFilter === 'completed' ||
    routeFilter === 'all'
      ? routeFilter
      : 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const farmIdValue = farmId ? parseInt(farmId, 10) : undefined;

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  // Get farm name by ID
  const getFarmName = (farmId: number) => {
    const farm = farms?.find((f) => f.id === farmId);
    return farm?.name || t('tasks.unknownFarm');
  };

  // Farm-scoped tasks
  const scopedTasks = useMemo(() => {
    if (!tasks) return null;
    return farmIdValue !== undefined ? tasks.filter((t) => t.farm_id === farmIdValue) : tasks;
  }, [tasks, farmIdValue]);

  // Filter and count tasks - Cellar Ledger design
  const { pendingTasks, completedTasks } = useMemo(() => {
    if (!scopedTasks) return { pendingTasks: [], completedTasks: [] };

    const pending = scopedTasks.filter((t) => !t.completed);
    const completed = scopedTasks.filter((t) => t.completed);

    return { pendingTasks: pending, completedTasks: completed };
  }, [scopedTasks]);

  // Group pending tasks by due date status for section headers
  const { overdueTasks, dueTodayTasks, thisWeekTasks, upcomingTasks } = useMemo(() => {
    const today = startOfDay(new Date());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7); // This week = next 7 days

    const overdue: TaskReminder[] = [];
    const dueToday: TaskReminder[] = [];
    const thisWeek: TaskReminder[] = [];
    const upcoming: TaskReminder[] = [];

    pendingTasks.forEach((task) => {
      const status = getTaskDueStatus(task);
      if (status === 'overdue') {
        overdue.push(task);
      } else if (status === 'today') {
        dueToday.push(task);
      } else if (task.due_date) {
        const dueDate = dueDateToStartOfDay(task.due_date);
        if (dueDate <= endOfWeek) {
          thisWeek.push(task);
        } else {
          upcoming.push(task);
        }
      } else {
        upcoming.push(task);
      }
    });

    return {
      overdueTasks: overdue,
      dueTodayTasks: dueToday,
      thisWeekTasks: thisWeek,
      upcomingTasks: upcoming,
    };
  }, [pendingTasks]);

  const handleComplete = (task: TaskReminder) => {
    if (!task.id) return;
    Alert.alert(
      t('tasks.alerts.completeTitle'),
      t('tasks.alerts.completeBody', { title: task.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.complete'),
          onPress: () => {
            const schedule = taskSchedules[String(task.id!)];

            // Calculate due_offset_days using calendar days
            let dueOffsetDays: number | null = null;
            if (task.due_date) {
              const dueDate = dueDateToStartOfDay(task.due_date);
              const today = startOfDay(new Date());
              const dayMs = 1000 * 60 * 60 * 24;
              const diffTime = dueDate.getTime() - today.getTime();
              dueOffsetDays = Math.round(diffTime / dayMs);
            }

            completeMutation.mutate(task.id!, {
              onSuccess: () => {
                if (schedule) {
                  cleanupTaskNotifications(String(task.id!), taskSchedules, removeTaskSchedule);
                }
                telemetry.capture('task_completed', {
                  task_type: task.type,
                  priority: task.priority,
                  due_offset_days: dueOffsetDays,
                  farm_id: task.farm_id,
                });
                telemetry.capture('meaningful_action', {
                  action_type: 'task_completed',
                  feature_name: task.type,
                });
              },
            });
          },
        },
      ],
    );
  };

  const handleDelete = (task: TaskReminder) => {
    if (!task.id) return;
    Alert.alert(
      t('tasks.alerts.deleteTitle'),
      t('tasks.alerts.deleteBody', { title: task.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const schedule = taskSchedules[String(task.id!)];
            deleteMutation.mutate(task.id!, {
              onSuccess: () => {
                if (schedule) {
                  cleanupTaskNotifications(String(task.id!), taskSchedules, removeTaskSchedule);
                }
              },
            });
          },
        },
      ],
    );
  };

  const handleLogFromTask = (task: TaskReminder) => {
    if (!task.id || (task.type !== 'spray' && task.type !== 'fertigation')) return;
    const planned =
      task.planned_inputs && task.planned_inputs.length > 0
        ? task.planned_inputs
        : decodeTaskPlanFromDescription(task.description);
    setAddEntry({
      tabs: ['log'],
      initialTab: 'log',
      initialFarmId: task.farm_id,
      initialLogType: task.type,
      sourceTaskId: task.id,
      logPrefill:
        task.type === 'spray'
          ? { sprayChemicals: planned }
          : {
              fertigationItems: planned,
            },
    });
    router.push({
      pathname: '/add-entry',
      params: {
        tabs: 'log',
        initialTab: 'log',
        farmId: String(task.farm_id),
        initialLogType: task.type,
      },
    });
  };

  // Custom JS header (avoids iOS 26 native bar-button glass capsule)
  const renderHeader = () => (
    <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[2],
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: 'transparent',
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          {({ pressed }) => (
            <View
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SFSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: radius.xl,
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                      : 'transparent',
                  },
                ]}
              />
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('tasks.title')}
          </Text>
        </View>

        <View style={{ width: 44, height: 44 }} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
        }}
        edges={['left', 'right', 'bottom']}
      >
        <Stack.Screen options={{ headerShown: false }} />
        {renderHeader()}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text style={{ color: m3.surface.s600, marginTop: spacing[4] }}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      edges={['left', 'right', 'bottom']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {renderHeader()}

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[24] }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={m3.colorScheme.primary}
          />
        }
      >
        {/* Cellar Ledger: Summary Bar */}
        {(() => {
          const summary = computeSummaryCounts(scopedTasks);
          return (
            <View
              style={{
                marginBottom: spacing[4],
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[4],
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius.xs,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.surface.s900,
                }}
              >
                {formatNumber(summary.pending, { maximumFractionDigits: 0 })}{' '}
                {t('tasks.summary.pending')}
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: borderRadius.full,
                  backgroundColor: m3.surface.s400,
                  marginHorizontal: spacing[3],
                }}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.warning,
                }}
              >
                {formatNumber(summary.dueToday, { maximumFractionDigits: 0 })}{' '}
                {t('tasks.summary.dueToday')}
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: borderRadius.full,
                  backgroundColor: m3.surface.s400,
                  marginHorizontal: spacing[3],
                }}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.error,
                }}
              >
                {formatNumber(summary.overdue, { maximumFractionDigits: 0 })}{' '}
                {t('tasks.summary.overdue')}
              </Text>
            </View>
          );
        })()}

        {/* Task List - Pending Tasks */}
        {/* Apply route filter: 'overdue' shows only overdue, 'completed' shows only completed,
           'pending' shows all pending groups, 'all' shows everything */}
        {(
          filter === 'overdue'
            ? overdueTasks.length === 0
            : filter === 'completed'
              ? completedTasks.length === 0
              : filter === 'pending'
                ? overdueTasks.length === 0 &&
                  dueTodayTasks.length === 0 &&
                  thisWeekTasks.length === 0 &&
                  upcomingTasks.length === 0
                : overdueTasks.length === 0 &&
                  dueTodayTasks.length === 0 &&
                  thisWeekTasks.length === 0 &&
                  upcomingTasks.length === 0 &&
                  completedTasks.length === 0
        ) ? (
          <View
            style={{
              backgroundColor: m3.surface.s100,
              borderRadius: borderRadius['2xl'],
              padding: spacing[8],
              alignItems: 'center',
            }}
          >
            <SFSymbol
              name="square"
              size={48}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
            <Text
              style={{
                color: m3.surface.s600,
                marginTop: spacing[4],
                textAlign: 'center',
              }}
            >
              {t('tasks.empty.title')}
            </Text>
            <Text
              style={{
                color: m3.surface.s500,
                fontSize: fontSize.sm,
                marginTop: spacing[1],
                textAlign: 'center',
              }}
            >
              {t('tasks.empty.subtitleAll')}
            </Text>
            <Pressable
              onPress={() => {
                setAddEntry({ tabs: ['task'], initialTab: 'task' });
                router.push({
                  pathname: '/add-entry',
                  params: { tabs: 'task', initialTab: 'task' },
                });
              }}
              style={{
                marginTop: spacing[4],
                backgroundColor: m3.colorScheme.primary,
                paddingHorizontal: spacing[6],
                paddingVertical: spacing[3],
                borderRadius: borderRadius.xl,
              }}
            >
              <Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold }}>
                {t('tasks.cta.addTask')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {/* Overdue Section */}
            {(filter === 'all' || filter === 'pending' || filter === 'overdue') &&
              overdueTasks.length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.error,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginBottom: spacing[2],
                      paddingHorizontal: spacing[1],
                    }}
                  >
                    {t('tasks.sections.overdue')}
                  </Text>
                  {overdueTasks.map((task) => (
                    <View key={task.id} style={{ marginBottom: spacing[3] }}>
                      <TaskRow
                        task={task}
                        showFarmName
                        farmName={getFarmName(task.farm_id)}
                        onComplete={(item) => handleComplete(item)}
                        onLogFromTask={(item) => handleLogFromTask(item)}
                        onEdit={(item) => {
                          setAddEntry({
                            tabs: ['task'],
                            initialTab: 'task',
                            editingTask: item,
                          });
                          router.push({
                            pathname: '/add-entry',
                            params: { tabs: 'task', initialTab: 'task' },
                          });
                        }}
                        onDelete={(item) => handleDelete(item)}
                      />
                    </View>
                  ))}
                </>
              )}

            {/* Due Today Section */}
            {(filter === 'all' || filter === 'pending') && dueTodayTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s400,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: spacing[2],
                    marginTop: overdueTasks.length > 0 ? spacing[4] : 0,
                    paddingHorizontal: spacing[1],
                  }}
                >
                  {t('tasks.sections.dueToday')}
                </Text>
                {dueTodayTasks.map((task) => (
                  <View key={task.id} style={{ marginBottom: spacing[3] }}>
                    <TaskRow
                      task={task}
                      showFarmName
                      farmName={getFarmName(task.farm_id)}
                      onComplete={(item) => handleComplete(item)}
                      onLogFromTask={(item) => handleLogFromTask(item)}
                      onEdit={(item) => {
                        setAddEntry({
                          tabs: ['task'],
                          initialTab: 'task',
                          editingTask: item,
                        });
                        router.push({
                          pathname: '/add-entry',
                          params: { tabs: 'task', initialTab: 'task' },
                        });
                      }}
                      onDelete={(item) => handleDelete(item)}
                    />
                  </View>
                ))}
              </>
            )}

            {/* This Week Section */}
            {(filter === 'all' || filter === 'pending') && thisWeekTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s400,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginTop: spacing[4],
                    marginBottom: spacing[2],
                    paddingHorizontal: spacing[1],
                  }}
                >
                  {t('tasks.sections.thisWeek')}
                </Text>
                {thisWeekTasks.map((task) => (
                  <View key={task.id} style={{ marginBottom: spacing[3] }}>
                    <TaskRow
                      task={task}
                      showFarmName
                      farmName={getFarmName(task.farm_id)}
                      onComplete={(item) => handleComplete(item)}
                      onLogFromTask={(item) => handleLogFromTask(item)}
                      onEdit={(item) => {
                        setAddEntry({
                          tabs: ['task'],
                          initialTab: 'task',
                          editingTask: item,
                        });
                        router.push({
                          pathname: '/add-entry',
                          params: { tabs: 'task', initialTab: 'task' },
                        });
                      }}
                      onDelete={(item) => handleDelete(item)}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Upcoming Section */}
            {(filter === 'all' || filter === 'pending') && upcomingTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s400,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginTop: spacing[4],
                    marginBottom: spacing[2],
                    paddingHorizontal: spacing[1],
                  }}
                >
                  {t('tasks.sections.upcoming')}
                </Text>
                {upcomingTasks.map((task) => (
                  <View key={task.id} style={{ marginBottom: spacing[3] }}>
                    <TaskRow
                      task={task}
                      showFarmName
                      farmName={getFarmName(task.farm_id)}
                      onComplete={(item) => handleComplete(item)}
                      onLogFromTask={(item) => handleLogFromTask(item)}
                      onEdit={(item) => {
                        setAddEntry({
                          tabs: ['task'],
                          initialTab: 'task',
                          editingTask: item,
                        });
                        router.push({
                          pathname: '/add-entry',
                          params: { tabs: 'task', initialTab: 'task' },
                        });
                      }}
                      onDelete={(item) => handleDelete(item)}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Cellar Ledger: Collapsible Completed Section */}
            {(filter === 'all' || filter === 'completed') && completedTasks.length > 0 && (
              <View style={{ marginTop: spacing[6] }}>
                {/* Section Header */}
                <Pressable
                  onPress={() => setCompletedExpanded(!completedExpanded)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing[3],
                    paddingHorizontal: spacing[2],
                    backgroundColor: m3.surface.s100,
                    borderRadius: borderRadius.md,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('tasks.sections.completed')}
                  accessibilityState={{ expanded: completedExpanded }}
                >
                  {/* Toggle Arrow */}
                  <SFSymbol
                    name={completedExpanded ? 'chevron.down' : 'chevron.right'}
                    size={16}
                    color={m3.surface.s500}
                    style={{ marginRight: spacing[2] }}
                  />
                  {/* Completed Label */}
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.surface.s700,
                      flex: 1,
                    }}
                  >
                    {t('tasks.sections.completed')}
                  </Text>
                  {/* Count Badge */}
                  <View
                    style={{
                      backgroundColor: m3.surface.s200,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.pill,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color: m3.surface.s600,
                      }}
                    >
                      {formatNumber(completedTasks.length, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </Pressable>

                {/* Completed Tasks - Collapsed by default */}
                {completedExpanded && (
                  <View style={{ marginTop: spacing[3] }}>
                    {completedTasks.map((task) => (
                      <View key={task.id} style={{ marginBottom: spacing[3], opacity: 0.8 }}>
                        <TaskRow
                          task={task}
                          showFarmName
                          farmName={getFarmName(task.farm_id)}
                          onComplete={(item) => handleComplete(item)}
                          onLogFromTask={(item) => handleLogFromTask(item)}
                          onEdit={(item) => {
                            setAddEntry({
                              tabs: ['task'],
                              initialTab: 'task',
                              editingTask: item,
                            });
                            router.push({
                              pathname: '/add-entry',
                              params: { tabs: 'task', initialTab: 'task' },
                            });
                          }}
                          onDelete={(item) => handleDelete(item)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => {
          setAddEntry({ tabs: ['task'], initialTab: 'task' });
          router.push({
            pathname: '/add-entry',
            params: { tabs: 'task', initialTab: 'task' },
          });
        }}
        style={{
          position: 'absolute',
          bottom: spacing[6],
          right: spacing[6],
          width: 56,
          height: 56,
          backgroundColor: m3.colorScheme.primary,
          borderRadius: borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colorWithOpacity(m3.colorScheme.primary, 0.3),
        }}
        accessibilityRole="button"
        accessibilityLabel={t('tasks.a11y.addTask', { defaultValue: 'Add task' })}
      >
        <SFSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
      </Pressable>

      {/* Add Task handled via route */}
    </SafeAreaView>
  );
}

export default withAdvancedRouteGuard(TasksScreen);
