import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  StyleSheet,
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
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { LogTypeId } from '@/constants/calculator-models';
import { colors, m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

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
  const [selectedQuickAction, setSelectedQuickAction] = useState<LogTypeId | null>(null);

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
    router.push({
      pathname: '/add-entry',
      params: {
        farmId: farmId.toString(),
        initialLogType: selectedQuickAction ?? undefined,
        initialTab: 'log',
        tabs: 'log',
      },
    });
    setSelectedQuickAction(null);
  };

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  const containerStyle: ViewStyle = {
    paddingTop: insets.top + spacing[4],
    paddingHorizontal: spacing[4],
  };

  const greetingStyle: TextStyle = {
    ...m3.typography.headlineSmall,
    color: m3.colorScheme.onSurface,
  };

  const sectionTitleStyle: TextStyle = {
    ...m3.typography.titleMedium,
    marginBottom: spacing[3],
    color: m3.colorScheme.onSurface,
  };

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={m3.colorScheme.primary}
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
        <View style={{ marginBottom: spacing[6] }}>
          <View style={{ flexDirection: 'row', marginBottom: spacing[3] }}>
            <View style={{ flex: 1, paddingRight: spacing[2] }}>
              <StatsCard
                title="Farms"
                value={stats?.farmsCount?.toString() ?? '0'}
                icon="leaf"
                color={m3.colorScheme.primary}
              />
            </View>
            <View style={{ flex: 1, paddingLeft: spacing[2] }}>
              <StatsCard
                title="Active Workers"
                value={stats?.activeWorkersCount?.toString() ?? '0'}
                icon="people"
                color={m3.colorScheme.primary}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, paddingRight: spacing[2] }}>
              <StatsCard
                title="Activities"
                value={stats?.recentActivitiesCount?.toString() ?? '0'}
                icon="bar-chart"
                color={m3.colorScheme.primary}
              />
            </View>
            <View style={{ flex: 1, paddingLeft: spacing[2] }}>
              <StatsCard
                title="Harvest"
                value={formatHarvest(stats?.totalHarvest ?? 0)}
                icon="basket"
                color={m3.colorScheme.tertiary}
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
                accessibilityRole="button"
                accessibilityLabel={`${item.farm.name}. ${item.reason}.`}
                style={{
                  borderRadius: m3.shape.cornerMedium,
                  padding: spacing[3],
                  marginBottom: spacing[2],
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.warning, 0.08),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.warning, 0.25),
                  overflow: 'hidden',
                }}
              >
                {({ pressed }) => (
                  <>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity(m3.colorScheme.warning, 0.18),
                      }}
                    >
                      <SymbolIcon name="drop.fill" size={18} color={m3.colorScheme.warning} />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <Text
                        style={{ ...m3.typography.labelLarge, color: m3.colorScheme.onSurface }}
                      >
                        {item.farm.name}
                      </Text>
                      <Text
                        style={{
                          ...m3.typography.labelSmall,
                          color: m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {item.reason}
                      </Text>
                    </View>
                    <SymbolIcon name="chevron.right" size={16} color={colors.gray[300]} />
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          backgroundColor: pressed
                            ? colorWithOpacity(
                                m3.colorScheme.onSurface,
                                m3.stateLayerOpacity.pressed,
                              )
                            : 'transparent',
                        },
                      ]}
                    />
                  </>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ marginBottom: spacing[6] }}>
          <Text style={sectionTitleStyle}>Quick Actions</Text>
          <View
            style={{
              borderRadius: m3.shape.cornerLarge,
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
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
                color={colors.irrigation[500]}
                onPress={() => handleQuickAction('irrigation')}
              />
              <QuickActionButton
                title="Spray"
                icon="flask"
                color={colors.spray[500]}
                onPress={() => handleQuickAction('spray')}
              />
              <QuickActionButton
                title="Harvest"
                icon="basket"
                color={colors.harvest[500]}
                onPress={() => handleQuickAction('harvest')}
              />
              <QuickActionButton
                title="Note"
                icon="document-text"
                color={m3.colorScheme.primary}
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
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[4],
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
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
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[6],
                alignItems: 'center',
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <SymbolIcon name="clock" size={48} color={colors.gray[300]} />
              <Text
                style={{
                  textAlign: 'center',
                  marginTop: spacing[4],
                  ...m3.typography.bodyMedium,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {farms && farms.length > 0
                  ? 'No recent activity yet.\nAdd an entry to get started.'
                  : 'No farms yet.\nAdd your first farm to get started.'}
              </Text>
              <View style={{ marginTop: spacing[4], width: '100%' }}>
                <Button
                  title={farms && farms.length > 0 ? 'Add an entry' : 'Add your first farm'}
                  onPress={() => router.push('/(tabs)/farms')}
                />
              </View>
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
          <View style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.scrim, 0.45) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss farm picker"
              onPress={() => setShowFarmPicker(false)}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                borderTopLeftRadius: m3.shape.cornerLarge,
                borderTopRightRadius: m3.shape.cornerLarge,
                padding: spacing[4],
                paddingTop: spacing[6],
                backgroundColor: m3.surface.surfaceContainerLow,
                maxHeight: '80%',
              }}
            >
              {/* Handle */}
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: m3.colorScheme.outlineVariant,
                  marginBottom: spacing[4],
                }}
              />
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
                    ...m3.typography.titleMedium,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  Select Farm
                </Text>
                <Pressable
                  onPress={() => setShowFarmPicker(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close farm picker"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <SymbolIcon name="xmark" size={24} color={colors.gray[400]} />
                </Pressable>
              </View>

              {/* Farm List */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                style={{ maxHeight: 400 }}
              >
                {farms && farms.length > 0 ? (
                  farms.map((farm) => (
                    <Pressable
                      key={farm.id}
                      onPress={() => farm.id && handleFarmSelection(farm.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select farm: ${farm.name}`}
                      style={({ pressed }) => ({
                        padding: spacing[4],
                        borderBottomWidth: 1,
                        borderBottomColor: m3.colorScheme.outlineVariant,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            ...m3.typography.bodyMedium,
                            fontWeight: fontWeight.medium,
                            color: m3.colorScheme.onSurface,
                          }}
                        >
                          {farm.name}
                        </Text>
                        {farm.region && (
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              marginTop: spacing[1],
                              color: m3.colorScheme.onSurfaceVariant,
                            }}
                          >
                            {farm.region}
                          </Text>
                        )}
                      </View>
                      <SymbolIcon name="chevron.right" size={20} color={colors.gray[300]} />
                    </Pressable>
                  ))
                ) : (
                  <View
                    style={{
                      padding: spacing[6],
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
                      No farms available
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add Entry Modal */}
        {/* Add Entry handled via route */}
      </View>
    </ScrollView>
  );
}
