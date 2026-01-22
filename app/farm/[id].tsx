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
import { Ionicons } from '@expo/vector-icons';
import { useFarm, useFarmRecords, useWeather, useDeleteFarm } from '@/hooks';
import { useTasks, useCompleteTask, useDeleteTask } from '@/hooks/useTasks';
import { StatsCard, ActivityLogCard } from '@/components/cards';
import { AddActivityModal, WaterLevelModal, AddTaskModal } from '@/components/screens';
import type { IrrigationRecord, SprayRecord, HarvestRecord, ExpenseRecord, FertigationRecord } from '@/types';
import { PRIORITY_INFO } from '@/types/task';

// Workboard action type
interface WorkboardAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
}

const WORKBOARD_ACTIONS: WorkboardAction[] = [
  { id: 'warehouse', title: 'Warehouse', icon: 'cube', color: '#4D857A' },
  { id: 'ai', title: 'AI', icon: 'bulb', color: '#408059' },
  { id: 'lab', title: 'Lab', icon: 'flask', color: '#598C6B' },
  { id: 'reports', title: 'Reports', icon: 'stats-chart', color: '#669475' },
  { id: 'soil', title: 'Soil Moisture', icon: 'layers', color: '#597A61' },
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
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [showWaterLevelModal, setShowWaterLevelModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'activities' | 'tasks'>('activities');


  // Calculate stats
  const totalRecords = useMemo(() => 
    (irrigationRecords?.length || 0) + 
    (sprayRecords?.length || 0) + 
    (harvestRecords?.length || 0) + 
    (expenseRecords?.length || 0) +
    (fertigationRecords?.length || 0),
    [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords]
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

    irrigationRecords?.forEach(r => logs.push({ 
      id: `irrigation-${r.id}`, 
      type: 'irrigation', 
      date: r.date, 
      data: r 
    }));
    sprayRecords?.forEach(r => logs.push({ 
      id: `spray-${r.id}`, 
      type: 'spray', 
      date: r.date, 
      data: r 
    }));
    harvestRecords?.forEach(r => logs.push({ 
      id: `harvest-${r.id}`, 
      type: 'harvest', 
      date: r.date, 
      data: r 
    }));
    expenseRecords?.forEach(r => logs.push({ 
      id: `expense-${r.id}`, 
      type: 'expense', 
      date: r.date, 
      data: r 
    }));
    fertigationRecords?.forEach(r => logs.push({ 
      id: `fertigation-${r.id}`, 
      type: 'fertigation', 
      date: r.date, 
      data: r 
    }));

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFarm(), refetchRecords()]);
    setRefreshing(false);
  };

  const handleAddActivity = () => {
    setShowAddActivityModal(true);
  };

  const handleActivitySaveSuccess = () => {
    // Refresh records after saving
    refetchRecords();
  };

  const handleAddTask = () => {
    setShowAddTaskModal(true);
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
    Alert.alert('Delete Farm', `Are you sure you want to delete "${farm.name}"? This action cannot be undone.`, [
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
    ]);
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

  const isOverdue = (task: { completed?: boolean; due_date?: string | null }) => {
    if (task.completed || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
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
      <View style={{ flex: 1, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-500 mt-4">Loading farm...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-lg font-semibold text-surface-900 mt-4">Farm Not Found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-600 font-medium">Go Back</Text>
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
            <View className="flex-row items-center">
              <TouchableOpacity 
                onPress={() => router.push(`/farm/${id}/edit`)}
                className="mr-4"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="create-outline" size={24} color="#408059" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDeleteFarm}
                className="mr-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ),
          headerTitle: () => (
            <View className="items-center">
              <Text className="text-lg font-bold text-surface-900">{farm.name}</Text>
              <View className="flex-row items-center">
                <Text className="text-xs text-surface-500">
                  {farm.crop_variety || farm.crop}
                </Text>
                <Text className="text-xs text-surface-500 mx-1">•</Text>
                <View 
                  className="flex-row items-center px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#408059' }}
                >
                  <Ionicons name="resize" size={10} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white ml-1">
                    {farm.area?.toFixed(1)} acres
                  </Text>
                </View>
              </View>
            </View>
          ),
        }}
      />

      <View className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
        {/* Subtle top gradient */}
        <View 
          className="absolute top-0 left-0 right-0"
        />

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#408059"
            />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Farm Header Card - iOS Style Glass Effect */}
        <View 
          className="mx-4 mt-16 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View className="p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center">
                    <Ionicons name="leaf" size={24} color="#408059" />
                  </View>
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-xl font-bold text-surface-900">
                        {farm.name}
                      </Text>
                      {daysSincePruning !== null && (
                        <View className="ml-2 flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F59E0B' }}>
                          <Ionicons name="cut-outline" size={10} color="#FFFFFF" />
                          <Text className="text-xs font-bold text-white ml-1">
                            {daysSincePruning}d
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm text-surface-500">
                      {farm.crop_variety || farm.crop}
                    </Text>
                  </View>
                </View>
                
                {farm.region && (
                  <View className="flex-row items-center mt-3">
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text className="text-sm text-surface-600 ml-1">{farm.region}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Weather info */}
            {weather && (
              <View className="mt-4 pt-4 border-t border-surface-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 bg-sky-100 rounded-lg items-center justify-center">
                      <Ionicons name="partly-sunny" size={16} color="#0284C7" />
                    </View>
                    <View className="ml-2">
                      <Text className="text-xs text-surface-500">Current Weather</Text>
                      <Text className="text-base font-semibold text-surface-900">
                        {weather.current.condition}
                      </Text>
                    </View>
                  </View>
      <View className="flex-row items-center gap-3">
        <View className="items-center">
          <Text className="text-lg font-bold text-surface-900">
            {weather.current.temperature}°
          </Text>
          <Text className="text-xs text-surface-500">Temperature</Text>
        </View>
        <View className="w-px h-8 bg-surface-200" />
        <View className="items-center">
          <Text className="text-lg font-bold text-surface-900">
            {weather.forecast[0]?.et0 ?? 0}
          </Text>
          <Text className="text-xs text-surface-500">ET0 (mm)</Text>
        </View>
      </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats Grid - iOS Style */}
        <View className="px-4 mt-4">
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1"
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
              className="flex-1"
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
        <View className="px-4 mt-6">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-1">
            WORKBOARD
          </Text>
          <Text className="text-sm text-surface-500 mb-2">
            Quick access to tools and resources.
          </Text>

          <View
            className="rounded-2xl p-4 mt-2"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 5 },
              borderRadius: 12
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
                    className="rounded-full items-center justify-center mb-2"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: `${action.color}1A`,
                    }}
                  >
                    <Ionicons name={action.icon} size={18} color={action.color} />
                  </View>
                  <Text className="text-xs font-medium text-surface-600 text-center leading-tight">
                    {action.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="px-4 mt-6">
          <View className="flex-row">
            {(['activities', 'tasks'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                className="flex-1 items-center py-3"
                onPress={() => setSelectedTab(tab)}
              >
                <Text
                  className={`text-sm font-bold uppercase text-center ${
                    selectedTab === tab ? 'text-primary-600' : 'text-surface-400'
                  }`}
                >
                  {tab === 'activities' ? 'Activities' : 'Tasks'}
                </Text>
                <View
                  className={`h-0.5 rounded-full mt-2 ${
                    selectedTab === tab ? 'bg-primary-600' : 'bg-transparent'
                  }`}
                  style={{ width: 30 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 mt-4 pb-28">
          {selectedTab === 'activities' ? (
            recentLogs.length > 0 ? (
              <View className="gap-3">
                {recentLogs.map((log) => (
                  <ActivityLogCard
                    key={log.id}
                    type={log.type}
                    date={log.date}
                    data={log.data}
                  />
                ))}
              </View>
            ) : (
              <View
                className="rounded-2xl items-center p-10"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(142, 142, 147, 0.2)' }}
                >
                  <Ionicons name="document-text-outline" size={32} color="#9CA3AF" />
                </View>
                <Text className="text-base font-semibold text-surface-900">
                  No Activities Yet
                </Text>
                <Text className="text-sm text-surface-500 text-center mt-1">
                  Start logging activities to see them here
                </Text>
              </View>
            )
          ) : (
            tasks && tasks.length > 0 ? (
              <View className="gap-3">
                {tasks.map((task) => {
                  const priorityInfo = PRIORITY_INFO[task.priority];
                  const overdue = isOverdue(task);

                  return (
                    <View
                      key={task.id}
                      className={`rounded-2xl p-4 ${
                        overdue ? 'border-2 border-amber-300' : ''
                      } ${task.completed ? 'opacity-60' : ''}`}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.06,
                        shadowRadius: 12,
                        elevation: 6,
                      }}
                    >
                      <View className="flex-row items-start">
                        <TouchableOpacity
                          onPress={() => !task.completed && handleCompleteTask(task.id!)}
                          disabled={task.completed}
                          className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 mt-0.5 ${
                            task.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-surface-300'
                          }`}
                        >
                          {task.completed && (
                            <Ionicons name="checkmark" size={18} color="white" />
                          )}
                        </TouchableOpacity>

                        <View className="flex-1">
                          <Text
                            className={`text-base font-semibold ${
                              task.completed
                                ? 'text-surface-500 line-through'
                                : 'text-surface-900'
                            }`}
                            numberOfLines={2}
                          >
                            {task.title}
                          </Text>

                          {task.description && (
                            <Text className="text-sm text-surface-500 mt-1" numberOfLines={2}>
                              {task.description}
                            </Text>
                          )}

                          <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 8 }}>
                            <View
                              className={`flex-row items-center ${
                                overdue ? 'bg-red-100' : 'bg-surface-100'
                              } px-2 py-0.5 rounded`}
                            >
                              <Ionicons
                                name="calendar"
                                size={12}
                                color={overdue ? '#DC2626' : '#6B7280'}
                              />
                              <Text
                                className={`text-xs ml-1 ${
                                  overdue ? 'text-red-600 font-medium' : 'text-surface-500'
                                }`}
                              >
                                {formatDueDate(task.due_date)}
                              </Text>
                            </View>
                            <View
                              className="px-2 py-0.5 rounded"
                              style={{ backgroundColor: priorityInfo.bgColor }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: priorityInfo.color }}
                              >
                                {priorityInfo.label}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {!task.completed && (
                          <TouchableOpacity
                            onPress={() => handleDeleteTask(task.id!, task.title)}
                            className="p-2"
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View
                className="rounded-2xl items-center p-10"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(142, 142, 147, 0.2)' }}
                >
                  <Ionicons name="checkbox-outline" size={32} color="#9CA3AF" />
                </View>
                <Text className="text-base font-semibold text-surface-900">
                  No Tasks Yet
                </Text>
                <Text className="text-sm text-surface-500 text-center mt-1">
                  Tap the + button to create tasks
                </Text>
              </View>
            )
          )}
          </View>
        </ScrollView>
      </View>

      {/* FAB for adding activity or task */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
        activeOpacity={0.8}
        onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
        style={{
          shadowColor: '#408059',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Activity Modal */}
      {farm && (
        <AddActivityModal
          visible={showAddActivityModal}
          onClose={() => setShowAddActivityModal(false)}
          farm={farm}
          onSaveSuccess={handleActivitySaveSuccess}
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

      {/* Add Task Modal */}
      {farmId && (
        <AddTaskModal
          visible={showAddTaskModal}
          onClose={() => setShowAddTaskModal(false)}
          editingTask={null}
          initialFarmId={farmId}
          onSaveSuccess={handleTaskSaveSuccess}
        />
      )}
    </>
  );
}
