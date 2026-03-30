import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Symbol as SFSymbol } from '@/components/ui/symbol';
import { useFarms } from '../src/hooks';
import { useAllTasks, useCompleteTask, useDeleteTask } from '../src/hooks/use-tasks';
import { TaskReminder } from '../src/types/task';
import { useModalStore, useNotificationStore } from '@/stores';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { cancelNotification } from '@/services/notifications';
import { TaskRow } from '@/components/cards';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { decodeTaskPlanFromDescription } from '@/utils/task-plan';

// Cellar Ledger: Task due date status type
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

// Cellar Ledger: Get task due date status
const getTaskDueStatus = (task: TaskReminder): TaskDueStatus => {
  if (task.completed) return 'done';
  if (!task.due_date) return 'upcoming';

  const today = startOfDay(new Date());
  const dueDate = startOfDay(new Date(task.due_date));

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
      const dueDate = startOfDay(new Date(task.due_date));
      if (dueDate < today) {
        overdue++;
      } else if (dueDate.getTime() === today.getTime()) {
        dueToday++;
      }
    }
  });

  return { pending, dueToday, overdue };
};

export default function TasksScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();
  const { data: tasks, isLoading, refetch, isRefetching } = useAllTasks();
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const removeTaskSchedule = useNotificationStore((s) => s.removeTaskSchedule);

  const [completedExpanded, setCompletedExpanded] = useState(false);
  const farmIdValue = farmId ? parseInt(farmId, 10) : undefined;

  // Get farm name by ID
  const getFarmName = (farmId: number) => {
    const farm = farms?.find((f) => f.id === farmId);
    return farm?.name || t('tasks.unknownFarm');
  };

  // Filter and count tasks - Cellar Ledger design
  const { pendingTasks, completedTasks } = useMemo(() => {
    const scopedTasks =
      tasks && farmIdValue !== undefined ? tasks.filter((t) => t.farm_id === farmIdValue) : tasks;

    if (!scopedTasks) return { pendingTasks: [], completedTasks: [] };

    const pending = scopedTasks.filter((t) => !t.completed);
    const completed = scopedTasks.filter((t) => t.completed);

    return { pendingTasks: pending, completedTasks: completed };
  }, [tasks, farmIdValue]);

  // Group pending tasks by due date status for section headers
  const { dueTodayTasks, thisWeekTasks, upcomingTasks } = useMemo(() => {
    const today = startOfDay(new Date());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7); // This week = next 7 days

    const dueToday: TaskReminder[] = [];
    const thisWeek: TaskReminder[] = [];
    const upcoming: TaskReminder[] = [];

    pendingTasks.forEach((task) => {
      const status = getTaskDueStatus(task);
      if (status === 'overdue' || status === 'today') {
        dueToday.push(task);
      } else if (task.due_date) {
        const dueDate = startOfDay(new Date(task.due_date));
        if (dueDate <= endOfWeek) {
          thisWeek.push(task);
        } else {
          upcoming.push(task);
        }
      } else {
        upcoming.push(task);
      }
    });

    return { dueTodayTasks: dueToday, thisWeekTasks: thisWeek, upcomingTasks: upcoming };
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
              const dueDate = startOfDay(new Date(task.due_date));
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

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack.Screen options={{ title: t('tasks.title') }} />
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          {t('common.loading')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen
        options={{
          title: t('tasks.title'),
          headerRight: () => (
            <Pressable
              onPress={() => {
                setAddEntry({ tabs: ['task'], initialTab: 'task' });
                router.push({
                  pathname: '/add-entry',
                  params: { tabs: 'task', initialTab: 'task' },
                });
              }}
              style={{ marginRight: spacing[4] }}
            >
              <SFSymbol name="plus.circle.fill" size={28} color={m3.colorScheme.primary} />
            </Pressable>
          ),
        }}
      />

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
          const summary = computeSummaryCounts(tasks);
          return (
            <View
              style={{
                marginBottom: spacing[4],
                paddingVertical: spacing[2],
                paddingHorizontal: spacing[4],
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.xs,
                borderWidth: 1,
                borderColor: colors.surface[300],
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: fontWeight.medium,
                  color: colors.surface[900],
                }}
              >
                {formatNumber(summary.pending, { maximumFractionDigits: 0 })} pending
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.surface[400],
                  marginHorizontal: spacing[3],
                }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: fontWeight.medium,
                  color: colors.warning,
                }}
              >
                {formatNumber(summary.dueToday, { maximumFractionDigits: 0 })} due today
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.surface[400],
                  marginHorizontal: spacing[3],
                }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: fontWeight.medium,
                  color: colors.error,
                }}
              >
                {formatNumber(summary.overdue, { maximumFractionDigits: 0 })} overdue
              </Text>
            </View>
          );
        })()}

        {/* Task List - Pending Tasks */}
        {dueTodayTasks.length === 0 && thisWeekTasks.length === 0 && upcomingTasks.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface[100],
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
                color: colors.surface[600],
                marginTop: spacing[4],
                textAlign: 'center',
              }}
            >
              {t('tasks.empty.title')}
            </Text>
            <Text
              style={{
                color: colors.surface[500],
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
            {/* Due Today Section */}
            {dueTodayTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[400],
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: spacing[2],
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
            {thisWeekTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[400],
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
            {upcomingTasks.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[400],
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
            {completedTasks.length > 0 && (
              <View style={{ marginTop: spacing[6] }}>
                {/* Section Header */}
                <Pressable
                  onPress={() => setCompletedExpanded(!completedExpanded)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing[3],
                    paddingHorizontal: spacing[2],
                    backgroundColor: colors.surface[100],
                    borderRadius: borderRadius.md,
                    borderWidth: 1,
                    borderColor: colors.surface[300],
                  }}
                >
                  {/* Toggle Arrow */}
                  <SFSymbol
                    name={completedExpanded ? 'chevron.down' : 'chevron.right'}
                    size={16}
                    color={colors.surface[500]}
                    style={{ marginRight: spacing[2] }}
                  />
                  {/* Completed Label */}
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[700],
                      flex: 1,
                    }}
                  >
                    {t('tasks.sections.completed')}
                  </Text>
                  {/* Count Badge */}
                  <View
                    style={{
                      backgroundColor: colors.surface[200],
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.pill,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: fontWeight.medium,
                        color: colors.surface[600],
                      }}
                    >
                      {completedTasks.length}
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
          shadowColor: m3.colorScheme.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <SFSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
      </Pressable>

      {/* Add Task handled via route */}
    </SafeAreaView>
  );
}
