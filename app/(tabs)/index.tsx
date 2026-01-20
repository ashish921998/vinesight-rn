import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores';
import {
  useDashboardStats,
  useFarmsNeedingAttention,
  useRecentActivities,
  useFarms,
} from '@/hooks';
import { StatsCard, QuickActionButton, ActivityLogCard } from '@/components/cards';

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
  const { user } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data hooks
  const { data: stats, refetch: refetchStats } = useDashboardStats();
  const { data: farmsNeedingAttention, refetch: refetchAttention } = useFarmsNeedingAttention();
  const { data: recentActivities, refetch: refetchActivities } = useRecentActivities(5);
  const { data: farms, refetch: refetchFarms } = useFarms();

  const greeting = useMemo(() => getGreeting(), []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchAttention(),
      refetchActivities(),
      refetchFarms(),
    ]);
    setIsRefreshing(false);
  };

  // Navigation handlers
  const handleAddLog = () => {
    // Navigate to first farm if exists, or farms list
    if (farms && farms.length > 0 && farms[0].id) {
      router.push(`/farm/${farms[0].id}`);
    } else {
      router.push('/(tabs)/farms');
    }
  };

  const handleWaterCalc = () => {
    if (farms && farms.length > 0 && farms[0].id) {
      router.push(`/farm/${farms[0].id}`);
    } else {
      router.push('/(tabs)/tools');
    }
  };

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-100"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#408059"
        />
      }
    >
      <View className="p-4">
        {/* Welcome Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">{greeting}</Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap" style={{ gap: 12, marginBottom: 24 }}>
          <View style={{ width: '48%' }}>
            <StatsCard
              title="Farms"
              value={stats?.farmsCount?.toString() ?? '0'}
              icon="leaf"
              color="#22C55E"
            />
          </View>
          <View style={{ width: '48%' }}>
            <StatsCard
              title="Active Workers"
              value={stats?.activeWorkersCount?.toString() ?? '0'}
              icon="people"
              color="#22C55E"
            />
          </View>
          <View style={{ width: '48%' }}>
            <StatsCard
              title="Activities"
              value={stats?.recentActivitiesCount?.toString() ?? '0'}
              icon="bar-chart"
              color="#22C55E"
            />
          </View>
          <View style={{ width: '48%' }}>
            <StatsCard
              title="Harvest"
              value={formatHarvest(stats?.totalHarvest ?? 0)}
              icon="basket"
              color="#A855F7"
            />
          </View>
        </View>

        {/* Farms Needing Attention */}
        {farmsNeedingAttention && farmsNeedingAttention.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Needs Attention
            </Text>
            {farmsNeedingAttention.slice(0, 3).map((item) => (
              <Pressable
                key={item.farm.id}
                onPress={() => item.farm.id && handleFarmAttention(item.farm.id)}
                className="bg-orange-50 rounded-xl p-4 mb-2 flex-row items-center active:opacity-80"
              >
                <Ionicons name="alert-circle" size={24} color="#F59E0B" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.farm.name}
                  </Text>
                  <Text className="text-sm text-orange-600">{item.reason}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Quick Actions
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row justify-around">
              <QuickActionButton
                title="Irrigation"
                icon="water"
                color="#3B82F6"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Spray"
                icon="flask"
                color="#8B5CF6"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Harvest"
                icon="basket"
                color="#A855F7"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Note"
                icon="document-text"
                color="#22C55E"
                onPress={handleAddLog}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Recent Activity
          </Text>
          {recentActivities && recentActivities.length > 0 ? (
            <View className="bg-white rounded-2xl p-4 border border-gray-100" style={{ gap: 8 }}>
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
            <View className="bg-white rounded-2xl p-6 items-center">
              <Ionicons name="time-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 text-center mt-4">
                No recent activity yet.{'\n'}Start by adding your first farm!
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
