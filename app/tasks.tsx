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
import { TaskReminder, TASK_TYPE_INFO, PRIORITY_INFO } from '../src/types/task';
import { useModalStore } from '@/stores';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/format';

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
          onPress: () => completeMutation.mutate(task.id!),
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

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return t('tasks.dueDate.none');
    const date = new Date(dateString);
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const display = formatDate(date, { year: 'numeric', month: 'numeric', day: 'numeric' });

    if (date.toDateString() === today.toDateString()) return t('tasks.dueDate.today');
    if (date.toDateString() === tomorrow.toDateString()) return t('tasks.dueDate.tomorrow');
    if (date < today) return t('tasks.dueDate.overdue', { date: display });
    return display;
  };

  const isOverdue = (task: TaskReminder) => {
    if (task.completed || !task.due_date) return false;
    return new Date(task.due_date) < startOfDay(new Date());
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
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
      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
        <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
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
              filteredTasks.map((task) => {
                const typeInfo = TASK_TYPE_INFO[task.type];
                const priorityInfo = PRIORITY_INFO[task.priority];
                const overdue = isOverdue(task);

                return (
                  <View
                    key={task.id}
                    style={{
                      backgroundColor: colors.white,
                      borderRadius: borderRadius['2xl'],
                      padding: spacing[4],
                      marginBottom: spacing[3],
                      borderWidth: overdue ? 2 : 0,
                      borderColor: overdue ? '#FCD34D' : 'transparent',
                      opacity: task.completed ? 0.6 : 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {/* Complete Checkbox */}
                      <Pressable
                        onPress={() => !task.completed && handleComplete(task)}
                        disabled={task.completed}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: borderRadius.full,
                          borderWidth: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: spacing[3],
                          marginTop: 2,
                          backgroundColor: task.completed ? '#22C55E' : 'transparent',
                          borderColor: task.completed ? '#22C55E' : colors.surface[300],
                        }}
                      >
                        {task.completed && <SFSymbol name="checkmark" size={16} color="white" />}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        {/* Title & Type */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: borderRadius.sm,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: spacing[2],
                              backgroundColor: `${typeInfo.color}20`,
                            }}
                          >
                            <SFSymbol
                              name={
                                typeInfo.icon === 'water'
                                  ? 'drop.fill'
                                  : typeInfo.icon === 'flask'
                                    ? 'flask.fill'
                                    : typeInfo.icon === 'basket'
                                      ? 'basket.fill'
                                      : typeInfo.icon === 'cash'
                                        ? 'dollarsign.circle.fill'
                                        : typeInfo.icon === 'leaf'
                                          ? 'leaf.fill'
                                          : typeInfo.icon === 'layers'
                                            ? 'square.stack.3d.up.fill'
                                            : typeInfo.icon === 'analytics'
                                              ? 'chart.bar.fill'
                                              : typeInfo.icon === 'document-text'
                                                ? 'doc.text.fill'
                                                : 'doc.fill'
                              }
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
                              color: task.completed ? colors.surface[500] : colors.surface[900],
                              textDecorationLine: task.completed ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </Text>
                        </View>

                        {/* Description */}
                        {task.description && (
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              color: colors.surface[500],
                              marginTop: spacing[1],
                            }}
                            numberOfLines={2}
                          >
                            {task.description}
                          </Text>
                        )}

                        {/* Farm & Due Date */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: spacing[2],
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <SFSymbol name="leaf.fill" size={12} color="#6B7280" />
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                color: colors.surface[500],
                                marginLeft: spacing[1],
                              }}
                            >
                              {getFarmName(task.farm_id)}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                              borderRadius: borderRadius.sm,
                              backgroundColor: overdue ? '#FEE2E2' : colors.surface[100],
                            }}
                          >
                            <SFSymbol
                              name="calendar"
                              size={12}
                              color={overdue ? '#DC2626' : '#6B7280'}
                            />
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                marginLeft: spacing[1],
                                color: overdue ? '#DC2626' : colors.surface[500],
                                fontWeight: overdue ? fontWeight.medium : fontWeight.normal,
                              }}
                            >
                              {formatDueDate(task.due_date)}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: priorityInfo.bgColor,
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                              borderRadius: borderRadius.sm,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.medium,
                                color: priorityInfo.color,
                              }}
                            >
                              {t(priorityInfo.labelKey)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Actions */}
                      {!task.completed && (
                        <Pressable
                          onPress={() => handleDelete(task)}
                          style={{ padding: spacing[2] }}
                        >
                          <SFSymbol name="trash" size={18} color="#DC2626" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
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
