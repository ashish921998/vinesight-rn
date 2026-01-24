import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkers, useDeleteWorker } from '@/hooks';
import { AddWorkerModal } from '@/components/screens';
import { AttendanceView } from '@/components/screens';
import type { Worker } from '@/types';

type WorkersTab = 'workers' | 'attendance' | 'analytics';

const TAB_DATA: { id: WorkersTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'workers', label: 'Workers', icon: 'people' },
  { id: 'attendance', label: 'Attendance', icon: 'calendar' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
];

export default function WorkersScreen() {
  const { data: workers, isLoading, refetch } = useWorkers();
  const deleteWorker = useDeleteWorker();

  const [selectedTab, setSelectedTab] = useState<WorkersTab>('workers');
  const [showAddModal, setShowAddModal] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | undefined>(undefined);

  const activeWorkers = useMemo(() => workers?.filter((w) => w.is_active) || [], [workers]);

  const inactiveWorkers = useMemo(() => workers?.filter((w) => !w.is_active) || [], [workers]);

  const handleDeleteWorker = (worker: Worker) => {
    Alert.alert(
      'Delete Worker?',
      `This will permanently delete ${worker.name} and all their associated records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (worker.id) {
              await deleteWorker.mutateAsync(worker.id);
            }
          },
        },
      ],
    );
  };

  const handleEditWorker = (worker: Worker) => {
    setWorkerToEdit(worker);
    setShowAddModal(true);
  };

  const handleAddModalClose = () => {
    setShowAddModal(false);
    setWorkerToEdit(undefined);
  };

  const renderWorker = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      className="bg-white mx-4 mb-3 rounded-2xl overflow-hidden"
      activeOpacity={0.7}
      onPress={() => handleEditWorker(item)}
    >
      <View className="flex-row items-center p-4">
        {/* Avatar */}
        <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
          <Text className="text-lg font-bold text-primary-600">
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold text-surface-900">{item.name}</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="cash-outline" size={12} color="#6B7280" />
            <Text className="text-sm text-surface-500 ml-1">₹{item.daily_rate}/day</Text>
          </View>
        </View>

        {/* Advance Balance */}
        {item.advance_balance > 0 && (
          <View className="flex-row items-center bg-orange-100 px-2 py-1 rounded-full mr-2">
            <Ionicons name="arrow-up-circle" size={12} color="#F59E0B" />
            <Text className="text-xs font-semibold text-orange-600 ml-1">
              ₹{item.advance_balance}
            </Text>
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity onPress={() => handleDeleteWorker(item)} className="p-2">
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderWorkersTab = () => (
    <FlatList
      data={activeWorkers}
      renderItem={renderWorker}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: 100,
        flexGrow: 1,
      }}
      ListHeaderComponent={
        activeWorkers.length > 0 ? (
          <Text className="text-xs font-bold text-surface-500 tracking-wider mx-4 mb-2">
            ACTIVE WORKERS ({activeWorkers.length})
          </Text>
        ) : null
      }
      ListFooterComponent={
        inactiveWorkers.length > 0 ? (
          <View className="mt-4">
            <Text className="text-xs font-bold text-surface-500 tracking-wider mx-4 mb-2">
              INACTIVE WORKERS ({inactiveWorkers.length})
            </Text>
            {inactiveWorkers.map((worker) => (
              <View key={String(worker.id)} className="opacity-60">
                {renderWorker({ item: worker })}
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
          <View className="flex-1 items-center justify-center p-8">
            <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="people-outline" size={40} color="#408059" />
            </View>
            <Text className="text-lg font-semibold text-surface-900 text-center">
              No Workers Yet
            </Text>
            <Text className="text-sm text-surface-500 text-center mt-2">
              Add workers to track attendance,{`\n`}payments, and settlements.
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="bg-primary-600 px-6 py-3 rounded-xl mt-4"
            >
              <Text className="text-white font-semibold">Add Worker</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#408059" />
      }
    />
  );

  const renderAttendanceTab = () => (
    <AttendanceView workers={activeWorkers} onSaveSuccess={refetch} />
  );

  const renderAnalyticsTab = () => (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-20 h-20 bg-purple-100 rounded-full items-center justify-center mb-4">
        <Ionicons name="bar-chart-outline" size={40} color="#8B5CF6" />
      </View>
      <Text className="text-lg font-semibold text-surface-900 text-center">Labor Analytics</Text>
      <Text className="text-sm text-surface-500 text-center mt-2">
        View labor costs, productivity,{`\n`}and attendance patterns.
      </Text>
      <Text className="text-xs text-surface-400 mt-4">Coming soon in a future update</Text>
    </View>
  );

  return (
    <>
      <View className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
        {/* Tab Selector */}
        <View className="bg-white px-4 pt-2 pb-3">
          <View className="flex-row bg-surface-100 rounded-xl p-1">
            {TAB_DATA.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedTab(tab.id)}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
                  selectedTab === tab.id ? 'bg-white border border-gray-200' : ''
                }`}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={selectedTab === tab.id ? '#408059' : '#6B7280'}
                />
                <Text
                  className={`text-sm font-medium ml-1.5 ${
                    selectedTab === tab.id ? 'text-primary-600' : 'text-surface-500'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'attendance' && renderAttendanceTab()}
        {selectedTab === 'analytics' && renderAnalyticsTab()}

        {/* FAB */}
        {selectedTab === 'workers' && (workers?.length || 0) > 0 && (
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Add/Edit Worker Modal */}
      <AddWorkerModal
        visible={showAddModal}
        onClose={handleAddModalClose}
        worker={workerToEdit}
        onSaveSuccess={refetch}
      />
    </>
  );
}
