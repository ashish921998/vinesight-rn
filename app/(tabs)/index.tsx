import React, { useEffect, useState } from 'react';
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
import { useDashboardStats, useRecentActivities, useFarms, useProfile } from '@/hooks';
import { Spinner } from '@/components/ui/spinner';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui';
import type { LogTypeId } from '@/constants/calculator-models';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/format';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { ALL_FARMS_ID } from '@/constants/farm-selection';
import { guidedTourEmit } from '@/features/guided-tour';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { useAppModeStore } from '@/stores';
import { createAddLogHref } from '@/utils/add-log-navigation';
import { SimplifiedHome } from '@/components/screens/simplified-home';

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

// Mode switch: Simplified mode gets an action-forward Home; Detailed mode keeps
// the existing analytics dashboard below unchanged.
export default function DashboardScreen() {
  const detailedMode = useAppModeStore((s) => s.detailedMode);
  return detailedMode ? <DetailedDashboard /> : <SimplifiedHome />;
}

function DetailedDashboard() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedQuickAction, setSelectedQuickAction] = useState<LogTypeId | null>(null);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const hasSeenWelcomeThisSession = useGuidedTourStore((s) => s.hasSeenWelcomeThisSession);
  const hasHydrated = useGuidedTourStore((s) => s.hasHydrated);
  const detailedMode = useAppModeStore((s) => s.detailedMode);

  // Data hooks
  const { data: stats, refetch: refetchStats } = useDashboardStats();
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
    await Promise.all([refetchStats(), refetchActivities(), refetchFarms()]);
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
      router.push(
        createAddLogHref({
          farmId: farmId === ALL_FARMS_ID ? 'all' : farmId,
          initialLogType: selectedQuickAction,
        }),
      );
    }
    setSelectedQuickAction(null);
  };

  const handleFarmAttention = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  const handleMetricCardPress = (destination: 'farms' | 'workers') => {
    if (destination === 'farms') {
      router.push('/(tabs)/explore');
      return;
    }
    router.push('/(tabs)/workers');
  };

  const hasFarms = Boolean(farms && farms.length > 0);

  const containerStyle: ViewStyle = {
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
  };

  const sectionTitleStyle: TextStyle = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
    color: m3.surface.s900,
  };

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);
  const isTourScrollLocked =
    hasHydrated &&
    (guidedTourStatus === 'in_progress' ||
      (guidedTourStatus === 'not_started' && !hasSeenWelcomeThisSession));

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
        {/* Hero Block - brand, greeting, logging nudge */}
        <View
          style={{
            backgroundColor: m3.colorScheme.primary,
            paddingTop: insets.top + spacing[3],
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[5],
            borderBottomLeftRadius: borderRadius.lg,
            borderBottomRightRadius: borderRadius.lg,
            marginBottom: spacing[6],
          }}
        >
          {/* Top bar: brand + user left, settings right */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[3],
              marginBottom: spacing[4],
            }}
          >
            <Pressable
              onPress={() => router.push('/app-settings')}
              accessibilityRole="button"
              accessibilityLabel={t('assistant.settingsButtonA11y')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                gap: spacing[3],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity('#ffffff', 0.2),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.28),
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: '#ffffff',
                    letterSpacing: 0.2,
                  }}
                >
                  {(profile?.full_name?.trim()?.charAt(0) || 'V').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.xl,
                    color: '#ffffff',
                    fontWeight: fontWeight.semibold,
                    letterSpacing: -0.3,
                    lineHeight: 25,
                  }}
                >
                  {t('app.name', { defaultValue: 'VineSight' })}
                </Text>
              </View>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Pressable
                onPress={() => router.push('/app-settings')}
                accessibilityRole="button"
                accessibilityLabel={t('assistant.settingsGearA11y')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity('#ffffff', pressed ? 0.28 : 0.16),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.2),
                })}
              >
                <SymbolIcon name="gearshape.fill" size={17} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <Text
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.normal,
              color: '#ffffff',
              lineHeight: 30,
              marginBottom: spacing[1],
            }}
          >
            {profile?.full_name
              ? t(`dashboard.greetingWithName.${greetingKey}`, { name: profile.full_name })
              : t(`dashboard.greeting.${greetingKey}`)}
          </Text>
          <Text
            style={{
              fontSize: fontSize.sm,
              color: colorWithOpacity('#ffffff', 0.7),
              lineHeight: 20,
              marginBottom: spacing[3],
            }}
          >
            {stats?.farmsCount
              ? t('dashboard.needsAttention.empty.subtitle')
              : t('dashboard.empty.noFarms')}
          </Text>
        </View>

        <View style={containerStyle}>
          {/* 2x2 Metric Grid */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[3],
              marginBottom: spacing[6],
            }}
          >
            {/* Farms */}
            <Pressable
              onPress={() => handleMetricCardPress('farms')}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.stats.farms')}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: '45%',
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                borderRadius: borderRadius.md,
                padding: spacing[4],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: colorWithOpacity(m3.primary.p500, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <SymbolIcon name="leaf" size={18} color={m3.primary.p500} />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: m3.surface.s900,
                  lineHeight: 28,
                  marginBottom: spacing[1],
                }}
              >
                {formatNumber(stats?.farmsCount ?? 0, { maximumFractionDigits: 0 })}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s500,
                  letterSpacing: 0,
                }}
              >
                {t('dashboard.stats.farms')}
              </Text>
            </Pressable>

            {detailedMode && (
              <>
                {/* Workers */}
                <Pressable
                  onPress={() => handleMetricCardPress('workers')}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.stats.activeWorkers')}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: '45%',
                    backgroundColor: m3.surface.s100,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    borderRadius: borderRadius.md,
                    padding: spacing[4],
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: spacing[3],
                    }}
                  >
                    <SymbolIcon name="person.2" size={18} color={m3.colorScheme.secondary} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize['2xl'],
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                      lineHeight: 28,
                      marginBottom: spacing[1],
                    }}
                  >
                    {formatNumber(stats?.activeWorkersCount ?? 0, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.surface.s500,
                      letterSpacing: 0,
                    }}
                  >
                    {t('dashboard.stats.activeWorkers')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Quick Actions Section */}
          <View style={{ marginBottom: spacing[6] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                marginBottom: spacing[3],
              }}
            >
              <Text style={sectionTitleStyle} accessibilityRole="header">
                {t('dashboard.quickActions.title')}
              </Text>
            </View>
            <View
              style={{
                borderRadius: borderRadius.md,
                padding: spacing[4],
                paddingHorizontal: spacing[3],
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                }}
              >
                {/* Irrigation */}
                <Pressable
                  onPress={() => handleQuickAction('irrigation')}
                  style={{ alignItems: 'center', minWidth: 68 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.irrigation')}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(domain.category.irrigation, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="water" size={20} color={domain.category.irrigation} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s500,
                      marginTop: spacing[1] + 2,
                    }}
                  >
                    {t('dashboard.quickActions.irrigation')}
                  </Text>
                </Pressable>

                {/* Spray */}
                <Pressable
                  onPress={() => handleQuickAction('spray')}
                  style={{ alignItems: 'center', minWidth: 68 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.spray')}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(domain.category.spray, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="spraycan" size={20} color={domain.category.spray} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s500,
                      marginTop: spacing[1] + 2,
                    }}
                  >
                    {t('dashboard.quickActions.spray')}
                  </Text>
                </Pressable>

                {/* Expense */}
                <Pressable
                  onPress={() => handleQuickAction('expense')}
                  style={{ alignItems: 'center', minWidth: 68 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.expense')}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(domain.category.expense, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="receipt" size={20} color={domain.category.expense} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s500,
                      marginTop: spacing[1] + 2,
                    }}
                  >
                    {t('dashboard.quickActions.expense')}
                  </Text>
                </Pressable>

                {/* Note */}
                <Pressable
                  onPress={() => handleQuickAction('note')}
                  style={{ alignItems: 'center', minWidth: 68 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.note')}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(domain.category.labour, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="document-text" size={20} color={domain.category.labour} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s500,
                      marginTop: spacing[1] + 2,
                    }}
                  >
                    {t('dashboard.quickActions.note')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={sectionTitleStyle} accessibilityRole="header">
              {t('dashboard.recentActivity.title')}
            </Text>
            {isLoadingActivities || isLoadingFarms ? (
              <View
                style={{
                  borderRadius: borderRadius.md,
                  padding: spacing[8],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                }}
              >
                <Spinner color={m3.colorScheme.primary} />
              </View>
            ) : recentActivities && recentActivities.length > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: m3.surface.s200,
                }}
              >
                {recentActivities.map((activity, index) => (
                  <Pressable
                    key={activity.id}
                    onPress={() => handleFarmAttention(activity.farmId)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      activity.farmName
                        ? t('dashboard.recentActivity.openFarm', { name: activity.farmName })
                        : t('dashboard.recentActivity.openFarmDetails')
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      borderBottomWidth: index < recentActivities.length - 1 ? 1 : 0,
                      borderBottomColor: m3.surface.s200,
                    }}
                  >
                    {/* Colored dot */}
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.xs,
                        backgroundColor:
                          activity.type === 'irrigation'
                            ? domain.category.irrigation
                            : activity.type === 'expense'
                              ? domain.category.expense
                              : activity.type === 'note'
                                ? domain.category.labour
                                : m3.colorScheme.primary,
                        flexShrink: 0,
                      }}
                    />
                    {/* Primary and secondary text */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: m3.surface.s900,
                          lineHeight: 20,
                        }}
                      >
                        {activity.description}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.surface.s500,
                          lineHeight: 16,
                        }}
                      >
                        {activity.farmName}
                      </Text>
                    </View>
                    {/* Time */}
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        color: m3.surface.s400,
                        flexShrink: 0,
                      }}
                    >
                      {formatDate(activity.date, { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                style={{
                  borderRadius: borderRadius.md,
                  padding: spacing[6],
                  alignItems: 'center',
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                }}
              >
                <SymbolIcon name="clock" size={48} color={m3.surface.s400} />
                <Text
                  style={{
                    textAlign: 'center',
                    marginTop: spacing[4],
                    fontSize: fontSize.sm,
                    color: m3.surface.s500,
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
                    onPress={() => {
                      if (hasFarms) {
                        router.push({
                          pathname: '/add-entry',
                          params: {
                            initialTab: 'log',
                            tabs: 'log',
                          },
                        });
                        return;
                      }
                      router.push('/(tabs)/explore');
                    }}
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
                style={StyleSheet.absoluteFill}
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
                    borderRadius: radius.xs,
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
                    <SymbolIcon name="xmark" size={24} color={m3.neutral.n400} />
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
                        <SymbolIcon name="chevron.right" size={20} color={m3.neutral.n300} />
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
                        <SymbolIcon name="chevron.right" size={20} color={m3.neutral.n300} />
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
    </>
  );
}
