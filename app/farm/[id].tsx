import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFarm, useFarmRecords } from '@/hooks';
import { StatsCard, ActivityLogCard } from '@/components/cards';
import { AddActivityModal } from '@/components/screens';
import { getWaterStatus } from '@/constants/calculatorModels';
import type { Farm, IrrigationRecord, SprayRecord, HarvestRecord, ExpenseRecord, FertigationRecord } from '@/types';

// Workboard action type
interface WorkboardAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route?: string;
}

const WORKBOARD_ACTIONS: WorkboardAction[] = [
  { id: 'logs', title: 'View Logs', icon: 'document-text', color: '#3B82F6', bgColor: '#EFF6FF', route: '/farm/logs' },
  { id: 'water', title: 'Water Calc', icon: 'water', color: '#0EA5E9', bgColor: '#F0F9FF' },
  { id: 'reports', title: 'Reports', icon: 'stats-chart', color: '#8B5CF6', bgColor: '#F5F3FF' },
  { id: 'soil', title: 'Soil Profile', icon: 'earth', color: '#84CC16', bgColor: '#F7FEE7' },
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
    isLoading: recordsLoading,
    refetch: refetchRecords,
  } = useFarmRecords(farmId);
  
  const [selectedTab, setSelectedTab] = useState<'activities' | 'tasks'>('activities');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);

  // Calculate stats
  const totalHarvest = useMemo(() => 
    harvestRecords?.reduce((sum, r) => sum + r.quantity, 0) || 0,
    [harvestRecords]
  );

  const totalExpenses = useMemo(() => 
    expenseRecords?.reduce((sum, r) => sum + r.cost, 0) || 0,
    [expenseRecords]
  );

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
  }, [farm?.date_of_pruning]);

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

  const handleWorkboardAction = (action: WorkboardAction) => {
    // Navigate to appropriate screen or show modal
    if (action.id === 'water') {
      // Show water calculator
    } else if (action.id === 'logs') {
      // Show logs
    }
  };

  // Water status
  const waterStatus = farm?.remaining_water 
    ? getWaterStatus(farm.remaining_water) 
    : null;

  if (farmLoading && !farm) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-500 mt-4">Loading farm...</Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center p-8">
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
          headerStyle: { backgroundColor: '#F9FAFB' },
          headerTintColor: '#111827',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push(`/farm/${id}/edit`)}
              className="mr-4"
            >
              <Ionicons name="create-outline" size={24} color="#408059" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView
        className="flex-1 bg-surface-50"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#408059"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Farm Header Card */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center">
                  <Ionicons name="leaf" size={24} color="#408059" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-xl font-bold text-surface-900">
                    {farm.name}
                  </Text>
                  <Text className="text-sm text-surface-500">
                    {farm.crop_variety || farm.crop} • {farm.area?.toFixed(1)} acres
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

          {/* Pruning info */}
          {daysSincePruning !== null && (
            <View className="mt-4 pt-4 border-t border-surface-100">
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-amber-100 rounded-lg items-center justify-center">
                  <Ionicons name="calendar" size={16} color="#F59E0B" />
                </View>
                <View className="ml-2">
                  <Text className="text-xs text-surface-500">Days Since Pruning</Text>
                  <Text className="text-base font-semibold text-surface-900">
                    {daysSincePruning} days
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Water Status Card */}
        {waterStatus && (
          <TouchableOpacity 
            className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View 
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${waterStatus.color}20` }}
                >
                  <Ionicons 
                    name={waterStatus.icon as any} 
                    size={24} 
                    color={waterStatus.color} 
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm text-surface-500">Soil Water Level</Text>
                  <Text className="text-xl font-bold text-surface-900">
                    {farm.remaining_water?.toFixed(1)} mm
                  </Text>
                  <Text 
                    className="text-xs font-medium mt-0.5"
                    style={{ color: waterStatus.color }}
                  >
                    {waterStatus.label} - {waterStatus.message}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View className="px-4 mt-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatsCard
                title="Log Entries"
                value={totalRecords.toString()}
                icon="document-text"
                iconColor="#3B82F6"
                subtitle="Records"
              />
            </View>
            <View className="flex-1">
              <StatsCard
                title="Total Harvest"
                value={totalHarvest > 0 ? totalHarvest.toFixed(0) : '--'}
                icon="basket"
                iconColor="#F59E0B"
                subtitle="kg"
              />
            </View>
          </View>
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1">
              <StatsCard
                title="Expenses"
                value={totalExpenses > 0 ? `₹${(totalExpenses / 1000).toFixed(1)}k` : '--'}
                icon="cash"
                iconColor="#EF4444"
                subtitle="Total"
              />
            </View>
            <View className="flex-1">
              <StatsCard
                title="Irrigations"
                value={(irrigationRecords?.length || 0).toString()}
                icon="water"
                iconColor="#0EA5E9"
                subtitle="Sessions"
              />
            </View>
          </View>
        </View>

        {/* Workboard Section */}
        <View className="px-4 mt-6">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-1">
            WORKBOARD
          </Text>
          <Text className="text-sm text-surface-500 mb-4">
            Quick access to farm tools
          </Text>
          
          <View className="flex-row flex-wrap gap-3">
            {WORKBOARD_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                className="bg-white rounded-xl p-4 items-center"
                style={{ width: '23%', minWidth: 75 }}
                activeOpacity={0.7}
                onPress={() => handleWorkboardAction(action)}
              >
                <View 
                  className="w-10 h-10 rounded-lg items-center justify-center mb-2"
                  style={{ backgroundColor: action.bgColor }}
                >
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <Text className="text-xs font-medium text-surface-700 text-center">
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View className="px-4 mt-6">
          <View className="flex-row bg-surface-100 rounded-xl p-1">
            {(['activities', 'tasks'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2.5 rounded-lg ${
                  selectedTab === tab ? 'bg-white shadow-sm' : ''
                }`}
                onPress={() => setSelectedTab(tab)}
              >
                <Text className={`text-sm font-semibold text-center ${
                  selectedTab === tab ? 'text-primary-600' : 'text-surface-500'
                }`}>
                  {tab === 'activities' ? 'Recent Activities' : 'Tasks'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 mt-4 pb-24">
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
              <View className="bg-white rounded-2xl p-8 items-center">
                <View className="w-16 h-16 bg-surface-100 rounded-full items-center justify-center mb-4">
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
            <View className="bg-white rounded-2xl p-8 items-center">
              <View className="w-16 h-16 bg-surface-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkbox-outline" size={32} color="#9CA3AF" />
              </View>
              <Text className="text-base font-semibold text-surface-900">
                Tasks Coming Soon
              </Text>
              <Text className="text-sm text-surface-500 text-center mt-1">
                Task management will be available in a future update
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB for adding activity */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
        activeOpacity={0.8}
        onPress={handleAddActivity}
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
    </>
  );
}
