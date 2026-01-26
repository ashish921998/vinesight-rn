import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { useFarms } from '../src/hooks';
import { useAllTasks, useCompleteTask, useDeleteTask } from '../src/hooks/useTasks';
import { TaskReminder, TASK_TYPE_INFO, PRIORITY_INFO } from '../src/types/task';
import { AddEntryModal } from '../src/components/screens';

type FilterType = 'all' | 'pending' | 'overdue' | 'completed';

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export default function TasksScreen() {
  const { data: farms } = useFarms();
  const { data: tasks, isLoading, refetch, isRefetching } = useAllTasks();
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();

  const [filter, setFilter] = useState<FilterType>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskReminder | null>(null);

  // Get farm name by ID
  const getFarmName = (farmId: number) => {
    const farm = farms?.find((f) => f.id === farmId);
    return farm?.name || 'Unknown Farm';
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
    Alert.alert('Complete Task', `Mark "${task.title}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => completeMutation.mutate(task.id!),
      },
    ]);
  };

  const handleDelete = (task: TaskReminder) => {
    if (!task.id) return;
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(task.id!),
      },
    ]);
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (date < today) return `Overdue: ${date.toLocaleDateString()}`;
    return date.toLocaleDateString();
  };

  const isOverdue = (task: TaskReminder) => {
    if (task.completed || !task.due_date) return false;
    return new Date(task.due_date) < startOfDay(new Date());
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Tasks' }} />
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-600 mt-4">Loading tasks...</Text>
      </View>
    );
  }

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
        <View className="flex-1 bg-surface-50">
          <Stack.Screen
            options={{
              title: 'Tasks',
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => {
                    setEditingTask(null);
                    setShowAddModal(true);
                  }}
                  className="mr-4"
                >
                  <Symbol name="plus.circle.fill" size={28} color="#408059" />
                </TouchableOpacity>
              ),
            }}
          />

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#408059" />
            }
          >
            {/* Stats Cards */}
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              <View className="flex-1 bg-white rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-surface-900">{counts.pending}</Text>
                <Text className="text-xs text-surface-500">Pending</Text>
              </View>
              <View className="flex-1 bg-amber-50 rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-amber-700">{counts.overdue}</Text>
                <Text className="text-xs text-amber-600">Overdue</Text>
              </View>
              <View className="flex-1 bg-green-50 rounded-xl p-3 items-center">
                <Text className="text-2xl font-bold text-green-700">{counts.completed}</Text>
                <Text className="text-xs text-green-600">Completed</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {(['all', 'pending', 'overdue', 'completed'] as FilterType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFilter(type)}
                  className={`px-4 py-2 rounded-full ${
                    filter === type ? 'bg-primary-600' : 'bg-white'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      filter === type ? 'text-white' : 'text-surface-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)} ({counts[type]})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <View className="bg-white rounded-2xl p-8 items-center">
                <Symbol name="square" size={48} color="#9CA3AF" />
                <Text className="text-surface-600 mt-4 text-center">No tasks found</Text>
                <Text className="text-surface-500 text-sm mt-1 text-center">
                  {filter === 'all'
                    ? 'Create your first task to get started'
                    : `No ${filter} tasks`}
                </Text>
                {filter === 'all' && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingTask(null);
                      setShowAddModal(true);
                    }}
                    className="mt-4 bg-primary-600 px-6 py-3 rounded-xl"
                  >
                    <Text className="text-white font-semibold">Add Task</Text>
                  </TouchableOpacity>
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
                    className={`bg-white rounded-2xl p-4 mb-3 ${
                      overdue ? 'border-2 border-amber-300' : ''
                    } ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <View className="flex-row items-start">
                      {/* Complete Checkbox */}
                      <TouchableOpacity
                        onPress={() => !task.completed && handleComplete(task)}
                        disabled={task.completed}
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 mt-0.5 ${
                          task.completed ? 'bg-green-500 border-green-500' : 'border-surface-300'
                        }`}
                      >
                        {task.completed && <Symbol name="checkmark" size={16} color="white" />}
                      </TouchableOpacity>

                      <View className="flex-1">
                        {/* Title & Type */}
                        <View className="flex-row items-center">
                          <View
                            className="w-6 h-6 rounded items-center justify-center mr-2"
                            style={{ backgroundColor: `${typeInfo.color}20` }}
                          >
                            <Symbol
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
                            className={`text-base font-semibold flex-1 ${
                              task.completed ? 'text-surface-500 line-through' : 'text-surface-900'
                            }`}
                            numberOfLines={1}
                          >
                            {task.title}
                          </Text>
                        </View>

                        {/* Description */}
                        {task.description && (
                          <Text className="text-sm text-surface-500 mt-1" numberOfLines={2}>
                            {task.description}
                          </Text>
                        )}

                        {/* Farm & Due Date */}
                        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 8 }}>
                          <View className="flex-row items-center">
                            <Symbol name="leaf.fill" size={12} color="#6B7280" />
                            <Text className="text-xs text-surface-500 ml-1">
                              {getFarmName(task.farm_id)}
                            </Text>
                          </View>
                          <View
                            className={`flex-row items-center ${
                              overdue ? 'bg-red-100' : 'bg-surface-100'
                            } px-2 py-0.5 rounded`}
                          >
                            <Symbol
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

                      {/* Actions */}
                      {!task.completed && (
                        <TouchableOpacity onPress={() => handleDelete(task)} className="p-2">
                          <Symbol name="trash" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* FAB */}
          <TouchableOpacity
            onPress={() => {
              setEditingTask(null);
              setShowAddModal(true);
            }}
            className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center shadow-lg"
            style={{ elevation: 5 }}
          >
            <Symbol name="plus" size={28} color="white" />
          </TouchableOpacity>

          {/* Add Task Modal */}
          <AddEntryModal
            visible={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setEditingTask(null);
            }}
            tabs={['task']}
            initialTab="task"
            editingTask={editingTask}
            onTaskSaveSuccess={() => {
              refetch();
            }}
          />
        </View>
      </SafeAreaView>
    </>
  );
}
