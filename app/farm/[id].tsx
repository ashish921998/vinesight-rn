import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { useFarm, useFarmRecords, useWeather, useDeleteFarm } from '@/hooks';
import { useTasks, useCompleteTask, useDeleteTask } from '@/hooks/useTasks';
import { StatsCard, ActivityLogCard } from '@/components/cards';
import { AddEntryModal, WaterLevelModal } from '@/components/screens';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { PRIORITY_INFO } from '@/types/task';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

// Workboard action type
interface WorkboardAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  route?: string;
}

const WORKBOARD_ACTIONS: WorkboardAction[] = [
  { id: 'warehouse', title: 'Warehouse', icon: 'cube.fill', color: '#4D857A' },
  { id: 'ai', title: 'AI', icon: 'lightbulb.fill', color: '#408059' },
  { id: 'lab', title: 'Lab', icon: 'flask.fill', color: '#598C6B' },
  { id: 'reports', title: 'Reports', icon: 'chart.bar.fill', color: '#669475' },
  { id: 'soil', title: 'Soil Moisture', icon: 'square.stack.3d.up.fill', color: '#597A61' },
];

export default function FarmDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id, 10) : undefined;

  const { data: farm, isLoading: farmLoading, refetch: refetchFarm } = useFarm(farmId);
  const {
    irrigationRecords,
    sprayRecords,
    harvestRecords,
    expenseRecords,
    fertigationRecords,
    refetch: refetchRecords,
  } = useFarmRecords(farmId);

  const { data: tasks, refetch: refetchTasks } = useTasks(farmId);
  const { data: weather } = useWeather(farm?.latitude ?? undefined, farm?.longitude ?? undefined);
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const deleteFarmMutation = useDeleteFarm();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [addEntryTab, setAddEntryTab] = useState<'log' | 'task'>('log');
  const [showWaterLevelModal, setShowWaterLevelModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'activities' | 'tasks'>('activities');

  // Calculate stats
  const totalRecords = useMemo(
    () =>
      (irrigationRecords?.length || 0) +
      (sprayRecords?.length || 0) +
      (harvestRecords?.length || 0) +
      (expenseRecords?.length || 0) +
      (fertigationRecords?.length || 0),
    [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords],
  );

  // Days since pruning
  const daysSincePruning = useMemo(() => {
    if (!farm?.date_of_pruning) return null;
    const pruningDate = new Date(farm.date_of_pruning);
    const today = new Date();
    const diffTime = today.getTime() - pruningDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, [farm]);

  // Recent activity logs - combine and sort
  const recentLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';
      date: string;
      data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
    }> = [];

    irrigationRecords?.forEach((r) =>
      logs.push({
        id: `irrigation-${r.id}`,
        type: 'irrigation',
        date: r.date,
        data: r,
      }),
    );
    sprayRecords?.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        data: r,
      }),
    );
    harvestRecords?.forEach((r) =>
      logs.push({
        id: `harvest-${r.id}`,
        type: 'harvest',
        date: r.date,
        data: r,
      }),
    );
    expenseRecords?.forEach((r) =>
      logs.push({
        id: `expense-${r.id}`,
        type: 'expense',
        date: r.date,
        data: r,
      }),
    );
    fertigationRecords?.forEach((r) =>
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        data: r,
      }),
    );

    return logs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFarm(), refetchRecords()]);
    setRefreshing(false);
  };

  const handleAddActivity = () => {
    setAddEntryTab('log');
    setShowAddEntryModal(true);
  };

  const handleActivitySaveSuccess = () => {
    // Refresh records after saving
    refetchRecords();
  };

  const handleAddTask = () => {
    setAddEntryTab('task');
    setShowAddEntryModal(true);
  };

  const handleTaskSaveSuccess = () => {
    refetchTasks();
  };

  const handleCompleteTask = (taskId: number) => {
    Alert.alert('Complete Task', 'Mark this task as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeMutation.mutate(taskId, {
            onSuccess: () => {
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert('Error', error.message || 'Failed to complete task');
            },
          });
        },
      },
    ]);
  };

  const handleDeleteTask = (taskId: number, taskTitle: string) => {
    Alert.alert('Delete Task', `Delete "${taskTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(taskId, {
            onSuccess: () => {
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert('Error', error.message || 'Failed to delete task');
            },
          });
        },
      },
    ]);
  };

  const handleDeleteFarm = () => {
    if (!farmId || !farm) return;
    Alert.alert(
      'Delete Farm',
      `Are you sure you want to delete "${farm.name}"? This will also delete all associated data including irrigation records, spray records, harvests, expenses, soil profiles, and other farm-related data. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteFarmMutation.mutate(farmId, {
              onSuccess: () => {
                router.back();
              },
              onError: (error: Error) => {
                Alert.alert('Error', error.message || 'Failed to delete farm');
              },
            });
          },
        },
      ],
    );
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (date < today) return `Overdue: ${date.toLocaleDateString()}`;
    return date.toLocaleDateString();
  };

  const startOfDay = (date: Date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const isOverdue = (task: { completed?: boolean; due_date?: string | null }) => {
    if (task.completed || !task.due_date) return false;
    return new Date(task.due_date) < startOfDay(new Date());
  };

  const handleWorkboardAction = (action: WorkboardAction) => {
    switch (action.id) {
      case 'warehouse':
        router.push('/warehouse');
        break;
      case 'ai':
        router.push(`/ai-chat?id=${id}`);
        break;
      case 'lab':
        router.push(`/lab-tests?farmId=${id}`);
        break;
      case 'reports':
        router.push('/reports');
        break;
      case 'soil':
        router.push(`/soil-profiling?farmId=${id}`);
        break;
    }
  };

  if (farmLoading && !farm) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#f2f2f7',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ color: colors.surface[500], marginTop: spacing[4] }}>Loading farm...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#f2f2f7',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}
      >
        <Symbol name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text
          style={{
            color: colors.surface[900],
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            marginTop: spacing[4],
          }}
        >
          Farm Not Found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
          <Text style={{ color: colors.primary[600], fontWeight: fontWeight.medium }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: farm.name,
          headerStyle: { backgroundColor: '#f2f2f7' },
          headerTintColor: '#000000',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.push(`/farm/${id}/edit`)}
                style={{ marginRight: spacing[4] }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Symbol name="create-outline" size={24} color="#408059" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteFarm}
                style={{
                  marginRight: spacing[2],
                  opacity: deleteFarmMutation.isPending ? 0.5 : 1,
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={deleteFarmMutation.isPending}
              >
                {deleteFarmMutation.isPending ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Symbol name="trash" size={24} color="#DC2626" />
                )}
              </TouchableOpacity>
            </View>
          ),
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
              >
                {farm.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                  {farm.crop_variety || farm.crop}
                </Text>
                <Text
                  style={{
                    color: colors.surface[500],
                    fontSize: fontSize.xs,
                    marginHorizontal: spacing[1],
                  }}
                >
                  •
                </Text>
                <View
                  style={{
                    backgroundColor: '#408059',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Symbol name="resize" size={10} color="#FFFFFF" />
                  <Text
                    style={{
                      color: colors.white,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      marginLeft: spacing[1],
                    }}
                  >
                    {farm.area?.toFixed(1)} acres
                  </Text>
                </View>
              </View>
            </View>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#408059" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Farm Header Card - iOS Style Glass Effect */}
          <View
            style={{
              marginHorizontal: spacing[4],
              marginTop: spacing[16],
              borderRadius: borderRadius['2xl'],
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <View style={{ padding: spacing[4] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: colors.primary[100],
                        borderRadius: borderRadius.xl,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Symbol name="leaf.fill" size={24} color="#408059" />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          style={{
                            color: colors.surface[900],
                            fontSize: fontSize.xl,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          {farm.name}
                        </Text>
                        {daysSincePruning !== null && (
                          <View
                            style={{
                              marginLeft: spacing[2],
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                              borderRadius: borderRadius.full,
                              backgroundColor: '#F59E0B',
                            }}
                          >
                            <Symbol name="cut-outline" size={10} color="#FFFFFF" />
                            <Text
                              style={{
                                color: colors.white,
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.bold,
                                marginLeft: spacing[1],
                              }}
                            >
                              {daysSincePruning}d
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.sm }}>
                        {farm.crop_variety || farm.crop}
                      </Text>
                    </View>
                  </View>

                  {farm.region && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: spacing[3],
                      }}
                    >
                      <Symbol name="location-outline" size={16} color="#6B7280" />
                      <Text
                        style={{
                          color: colors.surface[600],
                          fontSize: fontSize.sm,
                          marginLeft: spacing[1],
                        }}
                      >
                        {farm.region}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Weather info */}
              {weather && (
                <View
                  style={{
                    marginTop: spacing[4],
                    paddingTop: spacing[4],
                    borderTopWidth: 1,
                    borderTopColor: colors.surface[100],
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: '#E0F2FE',
                          borderRadius: borderRadius.lg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Symbol name="partly-sunny" size={16} color="#0284C7" />
                      </View>
                      <View style={{ marginLeft: spacing[2] }}>
                        <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                          Current Weather
                        </Text>
                        <Text
                          style={{
                            color: colors.surface[900],
                            fontSize: fontSize.base,
                            fontWeight: fontWeight.semibold,
                          }}
                        >
                          {weather.current.condition}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text
                          style={{
                            color: colors.surface[900],
                            fontSize: fontSize.lg,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          {weather.current.temperature}°
                        </Text>
                        <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                          Temperature
                        </Text>
                      </View>
                      <View
                        style={{ width: 1, height: 32, backgroundColor: colors.surface[200] }}
                      />
                      <View style={{ alignItems: 'center' }}>
                        <Text
                          style={{
                            color: colors.surface[900],
                            fontSize: fontSize.lg,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          {weather.forecast[0]?.et0 ?? 0}
                        </Text>
                        <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                          ET0 (mm)
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Stats Grid - iOS Style */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => router.push(`/logs?farmId=${id}`)}
                activeOpacity={0.7}
              >
                <StatsCard
                  title="Log Entries"
                  value={totalRecords.toString()}
                  icon="document-text"
                  iconColor="#4D8561"
                  subtitle="Records"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => setShowWaterLevelModal(true)}
                activeOpacity={0.7}
              >
                <StatsCard
                  title="Soil Water"
                  value={farm.remaining_water ? farm.remaining_water.toFixed(1) : '--'}
                  icon="water"
                  iconColor="#4D857A"
                  subtitle="mm"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Workboard Section */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
                marginBottom: spacing[1],
              }}
            >
              WORKBOARD
            </Text>
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.sm,
                marginBottom: spacing[2],
              }}
            >
              Quick access to tools and resources.
            </Text>

            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginTop: spacing[2],
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {WORKBOARD_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
                    activeOpacity={0.7}
                    onPress={() => handleWorkboardAction(action)}
                  >
                    <View
                      style={{
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing[2],
                        width: 40,
                        height: 40,
                        backgroundColor: `${action.color}1A`,
                      }}
                    >
                      <Symbol name={action.icon} size={18} color={action.color} />
                    </View>
                    <Text
                      style={{
                        color: colors.surface[600],
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        textAlign: 'center',
                        lineHeight: 16,
                      }}
                    >
                      {action.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <View style={{ flexDirection: 'row' }}>
              {(['activities', 'tasks'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: spacing[3] }}
                  onPress={() => setSelectedTab(tab)}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: selectedTab === tab ? colors.primary[600] : colors.surface[400],
                    }}
                  >
                    {tab === 'activities' ? 'Activities' : 'Tasks'}
                  </Text>
                  <View
                    style={{
                      height: 2,
                      borderRadius: borderRadius.full,
                      marginTop: spacing[2],
                      width: 30,
                      backgroundColor: selectedTab === tab ? colors.primary[600] : 'transparent',
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tab Content */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[4],
              paddingBottom: spacing[24] + spacing[4],
            }}
          >
            {selectedTab === 'activities' ? (
              recentLogs.length > 0 ? (
                <View style={{ gap: spacing[3] }}>
                  {recentLogs.map((log) => (
                    <ActivityLogCard key={log.id} type={log.type} date={log.date} data={log.data} />
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    borderRadius: borderRadius['2xl'],
                    alignItems: 'center',
                    padding: spacing[10],
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: spacing[4],
                      backgroundColor: 'rgba(142, 142, 147, 0.2)',
                    }}
                  >
                    <Symbol name="doc.text" size={32} color="#9CA3AF" />
                  </View>
                  <Text
                    style={{
                      color: colors.surface[900],
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    No Activities Yet
                  </Text>
                  <Text
                    style={{
                      color: colors.surface[500],
                      fontSize: fontSize.sm,
                      textAlign: 'center',
                      marginTop: spacing[1],
                    }}
                  >
                    Start logging activities to see them here
                  </Text>
                </View>
              )
            ) : tasks && tasks.length > 0 ? (
              <View style={{ gap: spacing[3] }}>
                {tasks.map((task) => {
                  const priorityInfo = PRIORITY_INFO[task.priority];
                  const overdue = isOverdue(task);

                  return (
                    <View
                      key={task.id}
                      style={{
                        borderRadius: borderRadius['2xl'],
                        padding: spacing[4],
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: overdue ? 2 : 0,
                        borderColor: overdue ? '#FCD34D' : 'transparent',
                        opacity: task.completed ? 0.6 : 1,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <TouchableOpacity
                          onPress={() => !task.completed && handleCompleteTask(task.id!)}
                          disabled={task.completed}
                          style={{
                            width: 28,
                            height: 28,
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
                          {task.completed && <Symbol name="checkmark" size={18} color="white" />}
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: fontSize.base,
                              fontWeight: fontWeight.semibold,
                              color: task.completed ? colors.surface[500] : colors.surface[900],
                              textDecorationLine: task.completed ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </Text>

                          {task.description && (
                            <Text
                              style={{
                                color: colors.surface[500],
                                fontSize: fontSize.sm,
                                marginTop: spacing[1],
                              }}
                              numberOfLines={2}
                            >
                              {task.description}
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
                              <Symbol
                                name="calendar"
                                size={12}
                                color={overdue ? '#DC2626' : '#6B7280'}
                              />
                              <Text
                                style={{
                                  marginLeft: spacing[1],
                                  fontSize: fontSize.xs,
                                  color: overdue ? '#DC2626' : colors.surface[500],
                                  fontWeight: overdue ? fontWeight.medium : fontWeight.normal,
                                }}
                              >
                                {formatDueDate(task.due_date)}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: priorityInfo.bgColor }}>
                              <Text
                                style={{
                                  color: priorityInfo.color,
                                  fontSize: fontSize.xs,
                                  fontWeight: fontWeight.medium,
                                }}
                              >
                                {priorityInfo.label}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {!task.completed && (
                          <TouchableOpacity
                            onPress={() => handleDeleteTask(task.id!, task.title)}
                            style={{ padding: spacing[2] }}
                          >
                            <Symbol name="trash" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View
                style={{
                  borderRadius: borderRadius['2xl'],
                  alignItems: 'center',
                  padding: spacing[10],
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[4],
                    backgroundColor: 'rgba(142, 142, 147, 0.2)',
                  }}
                >
                  <Symbol name="checkbox-outline" size={32} color="#9CA3AF" />
                </View>
                <Text
                  style={{
                    color: colors.surface[900],
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  No Tasks Yet
                </Text>
                <Text
                  style={{
                    color: colors.surface[500],
                    fontSize: fontSize.sm,
                    textAlign: 'center',
                    marginTop: spacing[1],
                  }}
                >
                  Tap the + button to create tasks
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* FAB for adding activity or task */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
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
        }}
      >
        <Symbol name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Entry Modal */}
      {farm && (
        <AddEntryModal
          visible={showAddEntryModal}
          onClose={() => setShowAddEntryModal(false)}
          farm={farm}
          tabs={['log', 'task']}
          initialTab={addEntryTab}
          onLogSaveSuccess={handleActivitySaveSuccess}
          onTaskSaveSuccess={handleTaskSaveSuccess}
        />
      )}

      {/* Water Level Modal */}
      {farm && (
        <WaterLevelModal
          visible={showWaterLevelModal}
          onClose={() => setShowWaterLevelModal(false)}
          farm={farm}
        />
      )}
    </>
  );
}
