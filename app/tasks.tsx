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

import { Stack, useRouter } from 'expo-router';
import { Symbol as SFSymbol } from '@/components/ui/symbol';
import { useFarms } from '../src/hooks';
import { useAllTasks, useCompleteTask, useDeleteTask } from '../src/hooks/use-tasks';
import { TaskReminder } from '../src/types/task';
import { useModalStore } from '@/stores';
import { colors, spacing, borderRadius, fontSize, fontWeight, m3 } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { TaskRow } from '@/components/cards';

type FilterType = 'all' | 'pending' | 'overdue' | 'completed';

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export default function TasksScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const { setAddEntry } = useModalStore();
  const { data: farms } = useFarms();
  const { data: tasks, isLoading, refetch, isRefetching } = useAllTasks();
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();

  const [filter, setFilter] = useState<FilterType>('all');

  // Get farm name by ID
  const getFarmName = (farmId: number) => {
    const farm = farms?.find((f) => f.id === farmId);
    return farm?.name || t('tasks.unknownFarm');
  };

  // Filter and count tasks
  const { filteredTasks, counts } = useMemo(() => {
    if (!tasks)
      return { filteredTasks: [], counts: { all: 0, pending: 0, overdue: 0, completed: 0 } };

    const todayMidnight = startOfDay(new Date());

    const overdueTasks = tasks.filter(
      (t) => !t.completed && t.due_date && new Date(t.due_date) < todayMidnight,
    );
    const pendingTasks = tasks.filter((t) => !t.completed);
    const completedTasks = tasks.filter((t) => t.completed);

    const counts = {
      all: tasks.length,
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
        filtered = tasks;
    }

    return { filteredTasks: filtered, counts };
  }, [tasks, filter]);

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
          onPress: () => deleteMutation.mutate(task.id!),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack.Screen options={{ title: t('tasks.title') }} />
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
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
                  <SFSymbol name="plus.circle.fill" size={28} color="#408059" />
                </Pressable>
              ),
            }}
          />

          <ScrollView
            contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[24] }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#408059" />
            }
          >
            {/* Stats Cards */}
            <View style={{ flexDirection: 'row', marginBottom: spacing[4], gap: spacing[2] }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.white,
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
                  backgroundColor: '#FFFBEB',
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: '#B45309',
                  }}
                >
                  {counts.overdue}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#D97706' }}>
                  {t('tasks.statusSummary.overdue')}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#ECFDF3',
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: '#15803D',
                  }}
                >
                  {counts.completed}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#16A34A' }}>
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
                    backgroundColor: filter === type ? colors.primary[600] : colors.white,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: filter === type ? colors.white : colors.surface[600],
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
                  backgroundColor: colors.white,
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[8],
                  alignItems: 'center',
                }}
              >
                <SFSymbol name="square" size={48} color="#9CA3AF" />
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
                      backgroundColor: colors.primary[600],
                      paddingHorizontal: spacing[6],
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius.xl,
                    }}
                  >
                    <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>
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
              backgroundColor: colors.primary[600],
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <SFSymbol name="plus" size={28} color="white" />
          </Pressable>

          {/* Add Task handled via route */}
        </View>
      </View>
    </>
  );
}
