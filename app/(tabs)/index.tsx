import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useDashboardStats,
  useFarmsNeedingAttention,
  useRecentActivities,
  useFarms,
} from '@/hooks';
import { StatsCard, QuickActionButton, ActivityLogCard } from '@/components/cards';
import { AddEntryModal } from '@/components/screens';
import { Symbol } from '@/components/ui/Symbol';
import type { LogTypeId } from '@/constants/calculatorModels';

// ============================================================
// MARK: - Greeting Helper
// ============================================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatHarvest(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} t`;
  }
  return `${value.toFixed(0)} kg`;
}

// ============================================================
// MARK: - Dashboard Screen
// ============================================================

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [selectedQuickAction, setSelectedQuickAction] = useState<LogTypeId | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);

  // Data hooks
  const { data: stats, refetch: refetchStats } = useDashboardStats();
  const { data: farmsNeedingAttention, refetch: refetchAttention } = useFarmsNeedingAttention();
  const { data: recentActivities, refetch: refetchActivities } = useRecentActivities(5);
  const { data: farms, refetch: refetchFarms } = useFarms();

  const greeting = useMemo(() => getGreeting(), []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStats(), refetchAttention(), refetchActivities(), refetchFarms()]);
    setIsRefreshing(false);
  };

  // Navigation handlers
  const handleQuickAction = (actionType: LogTypeId) => {
    // Show farm picker if farms exist, otherwise show farms list
    if (farms && farms.length > 0) {
      setSelectedQuickAction(actionType);
      setShowFarmPicker(true);
    } else {
      router.push('/(tabs)/farms');
    }
  };

  const handleFarmSelection = (farmId: number) => {
    setShowFarmPicker(false);
    setSelectedFarmId(farmId);
    setShowAddEntryModal(true);
  };

  const handleAddEntryModalClose = () => {
    setShowAddEntryModal(false);
    setSelectedQuickAction(null);
    setSelectedFarmId(null);
  };

  const handleLogSaveSuccess = () => {
    handleAddEntryModalClose();
    refetchActivities();
  };

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#408059" />
      }
      scrollIndicatorInsets={{ top: insets.top }}
    >
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
        {/* Welcome Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold" style={{ color: '#000000' }}>
            {greeting}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <StatsCard
                title="Farms"
                value={stats?.farmsCount?.toString() ?? '0'}
                icon="leaf"
                color="#408059"
              />
            </View>
            <View style={{ flex: 1, paddingLeft: 6 }}>
              <StatsCard
                title="Active Workers"
                value={stats?.activeWorkersCount?.toString() ?? '0'}
                icon="people"
                color="#408059"
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <StatsCard
                title="Activities"
                value={stats?.recentActivitiesCount?.toString() ?? '0'}
                icon="bar-chart"
                color="#408059"
              />
            </View>
            <View style={{ flex: 1, paddingLeft: 6 }}>
              <StatsCard
                title="Harvest"
                value={formatHarvest(stats?.totalHarvest ?? 0)}
                icon="basket"
                color="#669475"
              />
            </View>
          </View>
        </View>

        {/* Farms Needing Attention */}
        {farmsNeedingAttention && farmsNeedingAttention.length > 0 && (
          <View className="mb-6">
            <Text className="text-base font-semibold mb-3" style={{ color: '#000000' }}>
              Needs Attention
            </Text>
            {farmsNeedingAttention.slice(0, 3).map((item) => (
              <Pressable
                key={item.farm.id}
                onPress={() => item.farm.id && handleFarmAttention(item.farm.id)}
                className="rounded-xl p-3 mb-2 flex-row items-center active:opacity-80"
                style={{
                  backgroundColor: 'rgba(255, 149, 0, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 149, 0, 0.2)',
                }}
              >
                <View
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(255, 149, 0, 0.15)' }}
                >
                  <Symbol name="drop.fill" size={18} color="#ff9500" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold" style={{ color: '#000000' }}>
                    {item.farm.name}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    Water calculation needed
                  </Text>
                </View>
                <Symbol name="chevron.right" size={16} color="#c7c7cc" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: '#000000' }}>
            Quick Actions
          </Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff' }}>
            <View className="flex-row justify-around">
              <QuickActionButton
                title="Irrigation"
                icon="water"
                color="#4d8573"
                onPress={() => handleQuickAction('irrigation')}
              />
              <QuickActionButton
                title="Spray"
                icon="flask"
                color="#598d6b"
                onPress={() => handleQuickAction('spray')}
              />
              <QuickActionButton
                title="Harvest"
                icon="basket"
                color="#669475"
                onPress={() => handleQuickAction('harvest')}
              />
              <QuickActionButton
                title="Note"
                icon="document-text"
                color="#408059"
                onPress={() => handleQuickAction('note')}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-base font-semibold mb-3" style={{ color: '#000000' }}>
            Recent Activity
          </Text>
          {recentActivities && recentActivities.length > 0 ? (
            <View className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', gap: 8 }}>
              {recentActivities.map((activity) => (
                <ActivityLogCard
                  key={activity.id}
                  type={activity.type}
                  date={activity.date}
                  description={activity.description}
                  farmName={activity.farmName}
                  onPress={() => handleFarmAttention(activity.farmId)}
                />
              ))}
            </View>
          ) : (
            <View className="rounded-2xl p-6 items-center" style={{ backgroundColor: '#ffffff' }}>
              <Symbol name="clock" size={48} color="#c7c7cc" />
              <Text className="text-center mt-4" style={{ color: '#8e8e93' }}>
                No recent activity yet.{'\n'}Start by adding your first farm!
              </Text>
            </View>
          )}
        </View>

        {/* Farm Picker Modal */}
        <Modal
          visible={showFarmPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFarmPicker(false)}
        >
          <View className="flex-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <View
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-4 pt-6"
              style={{ backgroundColor: '#ffffff', maxHeight: '80%' }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-semibold" style={{ color: '#000000' }}>
                  Select Farm
                </Text>
                <Pressable onPress={() => setShowFarmPicker(false)}>
                  <Symbol name="xmark" size={24} color="#8e8e93" />
                </Pressable>
              </View>

              {/* Farm List */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                className="max-h-96"
              >
                {farms && farms.length > 0 ? (
                  farms.map((farm) => (
                    <TouchableOpacity
                      key={farm.id}
                      onPress={() => farm.id && handleFarmSelection(farm.id)}
                      className="p-4 border-b flex-row items-center justify-between"
                      style={{ borderColor: '#e5e5ea' }}
                    >
                      <View className="flex-1">
                        <Text className="text-base font-medium" style={{ color: '#000000' }}>
                          {farm.name}
                        </Text>
                        {farm.region && (
                          <Text className="text-sm mt-1" style={{ color: '#8e8e93' }}>
                            {farm.region}
                          </Text>
                        )}
                      </View>
                      <Symbol name="chevron.right" size={20} color="#c7c7cc" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View className="p-6 items-center">
                    <Text style={{ color: '#8e8e93' }}>No farms available</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add Entry Modal */}
        {selectedFarmId && selectedQuickAction && (
          <AddEntryModal
            visible={showAddEntryModal}
            onClose={handleAddEntryModalClose}
            initialFarmId={selectedFarmId}
            initialLogType={selectedQuickAction}
            tabs={['log']}
            initialTab="log"
            onLogSaveSuccess={handleLogSaveSuccess}
          />
        )}
      </View>
    </ScrollView>
  );
}
