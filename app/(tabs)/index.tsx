import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: '#f2f2f7' }}
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
          <Text 
            className="text-2xl font-bold"
            style={{ color: '#000000' }}
          >
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
                  <Ionicons name="water" size={18} color="#ff9500" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold" style={{ color: '#000000' }}>
                    {item.farm.name}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>Water calculation needed</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#c7c7cc" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: '#000000' }}>
            Quick Actions
          </Text>
          <View 
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#ffffff' }}
          >
            <View className="flex-row justify-around">
              <QuickActionButton
                title="Irrigation"
                icon="water"
                color="#4d8573"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Spray"
                icon="flask"
                color="#598d6b"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Harvest"
                icon="basket"
                color="#669475"
                onPress={handleAddLog}
              />
              <QuickActionButton
                title="Note"
                icon="document-text"
                color="#408059"
                onPress={handleAddLog}
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
            <View 
              className="rounded-2xl p-4"
              style={{ backgroundColor: '#ffffff', gap: 8 }}
            >
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
            <View 
              className="rounded-2xl p-6 items-center"
              style={{ backgroundColor: '#ffffff' }}
            >
              <Ionicons name="time-outline" size={48} color="#c7c7cc" />
              <Text className="text-center mt-4" style={{ color: '#8e8e93' }}>
                No recent activity yet.{'\n'}Start by adding your first farm!
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
