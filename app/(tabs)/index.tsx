import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
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
  useProfile,
} from '@/hooks';
import { StatsCard, QuickActionButton, ActivityLogCard } from '@/components/cards';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { LogTypeId } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/format';
import { useThemeTokens } from '@/styles/use-theme';
import { FloatingAssistantButton } from '@/components/ui/floating-assistant-button';
import { ALL_FARMS_ID } from '@/constants/farm-selection';
import { guidedTourEmit } from '@/features/guided-tour';
import { useGuidedTourStore } from '@/features/guided-tour/store';

// ============================================================
// MARK: - Greeting Helper
// ============================================================

type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

function getGreetingKey(): GreetingKey {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ============================================================
// MARK: - Dashboard Screen
// ============================================================

export default function DashboardScreen() {
  const { m3, colors } = useThemeTokens();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedQuickAction, setSelectedQuickAction] = useState<LogTypeId | null>(null);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const hasSeenWelcomeThisSession = useGuidedTourStore((s) => s.hasSeenWelcomeThisSession);

  // Data hooks
  const { data: stats, refetch: refetchStats, isLoading: isLoadingStats } = useDashboardStats();
  const {
    data: farmsNeedingAttention,
    refetch: refetchAttention,
    isLoading: isLoadingAttention,
  } = useFarmsNeedingAttention();
  const {
    data: recentActivities,
    refetch: refetchActivities,
    isLoading: isLoadingActivities,
  } = useRecentActivities(5);
  const { data: farms, refetch: refetchFarms, isLoading: isLoadingFarms } = useFarms();
  const { data: profile } = useProfile();

  const greetingKey = getGreetingKey();

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
      router.push('/(tabs)/explore');
    }
  };

  const handleFarmSelection = (farmId: number) => {
    setShowFarmPicker(false);
    if (selectedQuickAction === 'note') {
      router.push({
        pathname: '/add-note',
        params: {
          farmId: farmId.toString(),
        },
      });
    } else {
      router.push({
        pathname: '/add-entry',
        params: {
          farmId: farmId === ALL_FARMS_ID ? 'all' : farmId.toString(),
          initialLogType: selectedQuickAction ?? undefined,
          initialTab: 'log',
          tabs: 'log',
        },
      });
    }
    setSelectedQuickAction(null);
  };

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  const containerStyle: ViewStyle = {
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
  };

  const greetingStyle: TextStyle = {
    ...m3.typography.headlineSmall,
    color: m3.colorScheme.onSurface,
  };

  const dateStyle: TextStyle = {
    ...m3.typography.labelSmall,
    color: m3.colorScheme.onSurfaceVariant,
    marginTop: spacing[1],
  };

  const sectionTitleStyle: TextStyle = {
    ...m3.typography.titleMedium,
    marginBottom: spacing[3],
    color: m3.colorScheme.onSurface,
  };

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);
  const todayLabel = formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' });
  const isTourScrollLocked =
    guidedTourStatus === 'in_progress' ||
    (guidedTourStatus === 'not_started' && !hasSeenWelcomeThisSession);

  useEffect(() => {
    guidedTourEmit('guidedTour.appReadyHome', {});
  }, []);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        scrollEnabled={!isTourScrollLocked}
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
            <Text style={greetingStyle}>
              {profile?.full_name
                ? t(`dashboard.greetingWithName.${greetingKey}`, { name: profile.full_name })
                : t(`dashboard.greeting.${greetingKey}`)}
            </Text>
            <Text style={dateStyle}>{todayLabel}</Text>
          </View>

          {/* Stats Grid */}
          <View style={{ marginBottom: spacing[6] }}>
            <View style={{ flexDirection: 'row', marginBottom: spacing[3] }}>
              <View style={{ flex: 1, paddingRight: spacing[2] }}>
                <StatsCard
                  title={t('dashboard.stats.farms')}
                  value={formatNumber(stats?.farmsCount ?? 0, { maximumFractionDigits: 0 })}
                  icon="leaf"
                  color={m3.colorScheme.primary}
                  isLoading={isLoadingStats}
                  onPress={() => router.navigate('/(tabs)/explore')}
                />
              </View>
              <View style={{ flex: 1, paddingLeft: spacing[2] }}>
                <StatsCard
                  title={t('dashboard.stats.activeWorkers')}
                  value={formatNumber(stats?.activeWorkersCount ?? 0, { maximumFractionDigits: 0 })}
                  icon="people"
                  color={m3.colorScheme.primary}
                  isLoading={isLoadingStats}
                  onPress={() => router.navigate('/(tabs)/workers')}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, paddingRight: spacing[2] }}>
                <StatsCard
                  title={t('dashboard.stats.activities')}
                  value={formatNumber(stats?.recentActivitiesCount ?? 0, {
                    maximumFractionDigits: 0,
                  })}
                  icon="bar-chart"
                  color={m3.colorScheme.primary}
                  isLoading={isLoadingStats}
                  onPress={() => router.navigate('/logs')}
                />
              </View>
              <View style={{ flex: 1, paddingLeft: spacing[2] }}>
                <StatsCard
                  title={t('dashboard.stats.tasks')}
                  value={formatNumber(stats?.pendingTasksCount ?? 0, {
                    maximumFractionDigits: 0,
                  })}
                  icon="checklist"
                  color={m3.colorScheme.primary}
                  isLoading={isLoadingStats}
                  onPress={() => router.navigate('/tasks')}
                />
              </View>
            </View>
          </View>

          {/* Farms Needing Attention */}
          {isLoadingAttention ? (
            <View
              style={{
                marginBottom: spacing[6],
                height: 60,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: m3.surface.surfaceContainerLow,
                borderRadius: m3.shape.cornerMedium,
              }}
            >
              <ActivityIndicator color={m3.colorScheme.primary} />
            </View>
          ) : (
            farmsNeedingAttention &&
            farmsNeedingAttention.length > 0 && (
              <View style={{ marginBottom: spacing[6] }}>
                <Text style={sectionTitleStyle}>{t('dashboard.needsAttention.title')}</Text>
                {farmsNeedingAttention.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.farm.id}
                    onPress={() => item.farm.id && handleFarmAttention(item.farm.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.farm.name}. ${t(`dashboard.needsAttention.reasons.${item.reason}`)}.`}
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
                          <SymbolIcon
                            name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                            size={18}
                            color={m3.colorScheme.warning}
                          />
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
                            {t(`dashboard.needsAttention.reasons.${item.reason}`)}
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
            )
          )}

          {/* Quick Actions */}
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={sectionTitleStyle}>{t('dashboard.quickActions.title')}</Text>
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
                  flexWrap: 'wrap',
                  rowGap: spacing[2],
                }}
              >
                <QuickActionButton
                  title={t('dashboard.quickActions.irrigation')}
                  icon="water"
                  color={colors.irrigation[500]}
                  onPress={() => handleQuickAction('irrigation')}
                />
                <QuickActionButton
                  title={t('dashboard.quickActions.spray')}
                  icon="flask"
                  color={colors.spray[500]}
                  onPress={() => handleQuickAction('spray')}
                />
                <QuickActionButton
                  title={t('dashboard.quickActions.expense')}
                  icon="dollarsign.circle"
                  color={colors.expense[500]}
                  onPress={() => handleQuickAction('expense')}
                />
                <QuickActionButton
                  title={t('dashboard.quickActions.note')}
                  icon="document-text"
                  color={m3.colorScheme.primary}
                  onPress={() => handleQuickAction('note')}
                />
              </View>
            </View>
          </View>

          {/* Recent Activity */}
          <View>
            <Text style={sectionTitleStyle}>{t('dashboard.recentActivity.title')}</Text>
            {isLoadingActivities || isLoadingFarms ? (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  padding: spacing[8],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <ActivityIndicator color={m3.colorScheme.primary} />
              </View>
            ) : recentActivities && recentActivities.length > 0 ? (
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
                    ? t('dashboard.empty.recentActivity')
                    : t('dashboard.empty.noFarms')}
                </Text>
                <View style={{ marginTop: spacing[4], width: '100%' }}>
                  <Button
                    title={
                      farms && farms.length > 0
                        ? t('dashboard.cta.addEntry')
                        : t('dashboard.cta.addFirstFarm')
                    }
                    onPress={() => router.push('/(tabs)/explore')}
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
            <View
              style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.scrim, 0.45) }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.farmPicker.dismissA11y')}
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
                    {t('dashboard.farmPicker.title')}
                  </Text>
                  <Pressable
                    onPress={() => setShowFarmPicker(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard.farmPicker.closeA11y')}
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
                    selectedQuickAction === 'expense' ? (
                      <Pressable
                        key="all-farms"
                        onPress={() => handleFarmSelection(ALL_FARMS_ID)}
                        accessibilityRole="button"
                        accessibilityLabel={t('dashboard.farmPicker.selectAllFarmsA11y')}
                        style={({ pressed }) => ({
                          padding: spacing[4],
                          borderBottomWidth: 1,
                          borderBottomColor: m3.colorScheme.outlineVariant,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: pressed
                            ? colorWithOpacity(
                                m3.colorScheme.onSurface,
                                m3.stateLayerOpacity.pressed,
                              )
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
                            {t('dashboard.farmPicker.allFarms')}
                          </Text>
                        </View>
                        <SymbolIcon name="chevron.right" size={20} color={colors.gray[300]} />
                      </Pressable>
                    ) : null
                  ) : null}
                  {farms && farms.length > 0 ? (
                    farms.map((farm) => (
                      <Pressable
                        key={farm.id}
                        onPress={() => farm.id && handleFarmSelection(farm.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('dashboard.farmPicker.selectFarmA11y', {
                          name: farm.name,
                        })}
                        style={({ pressed }) => ({
                          padding: spacing[4],
                          borderBottomWidth: 1,
                          borderBottomColor: m3.colorScheme.outlineVariant,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: pressed
                            ? colorWithOpacity(
                                m3.colorScheme.onSurface,
                                m3.stateLayerOpacity.pressed,
                              )
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
                        {t('dashboard.farmPicker.noFarms')}
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
      <FloatingAssistantButton onPress={() => router.push('/ai-chat')} />
    </>
  );
}
