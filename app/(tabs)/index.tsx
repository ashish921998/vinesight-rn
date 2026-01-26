import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  TouchableOpacity,
  type ViewStyle,
  type TextStyle,
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
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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

  const containerStyle: ViewStyle = {
    paddingTop: insets.top + spacing[4],
    paddingHorizontal: spacing[4],
  };

  const greetingStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.black,
  };

  const sectionTitleStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
    color: colors.black,
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      scrollIndicatorInsets={{ top: insets.top }}
    >
      <View style={containerStyle}>
        {/* Welcome Header */}
        <View style={{ marginBottom: spacing[6] }}>
          <Text style={greetingStyle}>{greeting}</Text>
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
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={sectionTitleStyle}>Needs Attention</Text>
            {farmsNeedingAttention.slice(0, 3).map((item) => (
              <Pressable
                key={item.farm.id}
                onPress={() => item.farm.id && handleFarmAttention(item.farm.id)}
                style={({ pressed }) => ({
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  marginBottom: spacing[2],
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 149, 0, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 149, 0, 0.2)',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 149, 0, 0.15)',
                  }}
                >
                  <Symbol name="drop.fill" size={18} color="#ff9500" />
                </View>
                <View style={{ marginLeft: spacing[3], flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.black,
                    }}
                  >
                    {item.farm.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.gray[400],
                    }}
                  >
                    Water calculation needed
                  </Text>
                </View>
                <Symbol name="chevron.right" size={16} color={colors.gray[300]} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ marginBottom: spacing[6] }}>
          <Text style={sectionTitleStyle}>Quick Actions</Text>
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              backgroundColor: colors.white,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
              }}
            >
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
                color={colors.primary}
                onPress={() => handleQuickAction('note')}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View>
          <Text style={sectionTitleStyle}>Recent Activity</Text>
          {recentActivities && recentActivities.length > 0 ? (
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                backgroundColor: colors.white,
                gap: spacing[2],
              }}
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
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[6],
                alignItems: 'center',
                backgroundColor: colors.white,
              }}
            >
              <Symbol name="clock" size={48} color={colors.gray[300]} />
              <Text
                style={{
                  textAlign: 'center',
                  marginTop: spacing[4],
                  color: colors.gray[400],
                }}
              >
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
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                padding: spacing[4],
                paddingTop: spacing[6],
                backgroundColor: colors.white,
                maxHeight: '80%',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[4],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.black,
                  }}
                >
                  Select Farm
                </Text>
                <Pressable onPress={() => setShowFarmPicker(false)}>
                  <Symbol name="xmark" size={24} color={colors.gray[400]} />
                </Pressable>
              </View>

              {/* Farm List */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                style={{ maxHeight: 384 }}
              >
                {farms && farms.length > 0 ? (
                  farms.map((farm) => (
                    <TouchableOpacity
                      key={farm.id}
                      onPress={() => farm.id && handleFarmSelection(farm.id)}
                      style={{
                        padding: spacing[4],
                        borderBottomWidth: 1,
                        borderBottomColor: colors.gray[200],
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: fontSize.base,
                            fontWeight: fontWeight.medium,
                            color: colors.black,
                          }}
                        >
                          {farm.name}
                        </Text>
                        {farm.region && (
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              marginTop: spacing[1],
                              color: colors.gray[400],
                            }}
                          >
                            {farm.region}
                          </Text>
                        )}
                      </View>
                      <Symbol name="chevron.right" size={20} color={colors.gray[300]} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View
                    style={{
                      padding: spacing[6],
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.gray[400] }}>No farms available</Text>
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
