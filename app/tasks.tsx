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

type FilterType = 'all' | 'pending' | 'overdue' | 'completed';

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
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

  const [filter, setFilter] = useState<FilterType>('all');
  const farmIdValue = farmId ? parseInt(farmId, 10) : undefined;

  // Get farm name by ID
  const getFarmName = (farmId: number) => {
    const farm = farms?.find((f) => f.id === farmId);
    return farm?.name || t('tasks.unknownFarm');
  };

  // Filter and count tasks
  const { filteredTasks, counts } = useMemo(() => {
    const scopedTasks =
      tasks && farmIdValue !== undefined ? tasks.filter((t) => t.farm_id === farmIdValue) : tasks;

    if (!scopedTasks)
      return { filteredTasks: [], counts: { all: 0, pending: 0, overdue: 0, completed: 0 } };

    const todayMidnight = startOfDay(new Date());

    const overdueTasks = scopedTasks.filter(
      (t) => !t.completed && t.due_date && new Date(t.due_date) < todayMidnight,
    );
    const pendingTasks = scopedTasks.filter((t) => !t.completed);
    const completedTasks = scopedTasks.filter((t) => t.completed);

    const counts = {
      all: scopedTasks.length,
      pending: pendingTasks.length,
      overdue: overdueTasks.length,
      completed: completedTasks.length,
    };

    let filtered: TaskReminder[];
    switch (filter) {
      case 'pending':
        filtered = pendingTasks;
        break;
      case 'overdue':
        filtered = overdueTasks;
        break;
      case 'completed':
        filtered = completedTasks;
        break;
      default:
        filtered = scopedTasks;
    }

    return { filteredTasks: filtered, counts };
  }, [tasks, filter, farmIdValue]);

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
            // Cancel any pending notifications for this task
            const schedule = taskSchedules[task.id!];
            if (schedule?.notificationIds?.length) {
              void Promise.allSettled(schedule.notificationIds.map(cancelNotification)).then(() =>
                removeTaskSchedule(String(task.id!)),
              );
            }

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
            // Cancel any pending notifications for this task
            const schedule = taskSchedules[task.id!];
            if (schedule?.notificationIds?.length) {
              void Promise.allSettled(schedule.notificationIds.map(cancelNotification)).then(() =>
                removeTaskSchedule(String(task.id!)),
              );
            }
            deleteMutation.mutate(task.id!);
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
        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', marginBottom: spacing[4], gap: spacing[2] }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.xl,
              padding: spacing[3],
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
              }}
            >
              {counts.pending}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
              {t('tasks.statusSummary.pending')}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colorWithOpacity(colors.warning, 0.12),
              borderRadius: borderRadius.xl,
              padding: spacing[3],
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: colors.warning,
              }}
            >
              {counts.overdue}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colorWithOpacity(colors.warning, 0.8) }}>
              {t('tasks.statusSummary.overdue')}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colorWithOpacity(colors.success, 0.12),
              borderRadius: borderRadius.xl,
              padding: spacing[3],
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: colors.success,
              }}
            >
              {counts.completed}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colorWithOpacity(colors.success, 0.8) }}>
              {t('tasks.statusSummary.completed')}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
          style={{ marginBottom: spacing[4] }}
        >
          {(['all', 'pending', 'overdue', 'completed'] as FilterType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setFilter(type)}
              style={{
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.full,
                backgroundColor: filter === type ? m3.colorScheme.primary : colors.surface[100],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: filter === type ? m3.colorScheme.onPrimary : colors.surface[600],
                }}
              >
                {t(`tasks.filters.${type}`)} (
                {formatNumber(counts[type], { maximumFractionDigits: 0 })})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
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
              {filter === 'all'
                ? t('tasks.empty.subtitleAll')
                : t('tasks.empty.subtitleFiltered', {
                    filter: t(`tasks.filters.${filter}`),
                  })}
            </Text>
            {filter === 'all' && (
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
            )}
          </View>
        ) : (
          filteredTasks.map((task) => (
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
          ))
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
