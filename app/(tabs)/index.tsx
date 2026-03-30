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
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import type { LogTypeId } from '@/constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@/i18n/format';
import { useThemeTokens } from '@/styles/use-theme';
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
  const hasHydrated = useGuidedTourStore((s) => s.hasHydrated);

  // Data hooks
  const { data: stats, refetch: refetchStats } = useDashboardStats();
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

  const sectionTitleStyle: TextStyle = {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
    color: colors.surface[900],
  };

  const sectionCountStyle: TextStyle = {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
    backgroundColor: colorWithOpacity(colors.warning, 0.12),
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  };

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);
  const todayLabel = formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric' });
  const isTourScrollLocked =
    hasHydrated &&
    (guidedTourStatus === 'in_progress' ||
      (guidedTourStatus === 'not_started' && !hasSeenWelcomeThisSession));

  const hasAlerts = farmsNeedingAttention && farmsNeedingAttention.length > 0;
  const alertCount = farmsNeedingAttention?.length ?? 0;

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
        {/* Hero Block - Action-forward (with alerts) or All Clear fallback */}
        <View
          style={{
            backgroundColor: m3.colorScheme.primary,
            paddingVertical: spacing[4],
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[5],
            borderBottomLeftRadius: borderRadius.lg,
            borderBottomRightRadius: borderRadius.lg,
            marginBottom: spacing[6],
          }}
        >
          {/* Top row with Today label and alert badge or all clear badge */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing[3],
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: colorWithOpacity('#ffffff', 0.65),
                fontWeight: fontWeight.medium,
                letterSpacing: 0.3,
              }}
            >
              {t('dashboard.hero.today')}
            </Text>
            {hasAlerts ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: colorWithOpacity(colors.accent[500], 0.25),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(colors.accent[500], 0.4),
                  borderRadius: borderRadius.pill,
                  paddingHorizontal: spacing[2] + 2,
                  paddingVertical: 2,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: colors.accent[500],
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: fontWeight.semibold,
                    color: colors.accent[500],
                    letterSpacing: 0.2,
                  }}
                >
                  {t('dashboard.hero.alertCount', { count: alertCount })}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: colorWithOpacity(colors.success, 0.35),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(colors.success, 0.5),
                  borderRadius: borderRadius.pill,
                  paddingHorizontal: spacing[2] + 2,
                  paddingVertical: 2,
                }}
              >
                <SymbolIcon
                  name="checkmark.circle.fill"
                  size={12}
                  color={colorWithOpacity(colors.success, 0.8)}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: fontWeight.semibold,
                    color: colorWithOpacity(colors.success, 0.8),
                    letterSpacing: 0.2,
                  }}
                >
                  {t('dashboard.hero.allClear')}
                </Text>
              </View>
            )}
          </View>

          {hasAlerts ? (
            // Urgent title with alerts
            <>
              <Text
                style={{
                  fontSize: 19,
                  fontWeight: fontWeight.semibold,
                  color: '#ffffff',
                  lineHeight: 24,
                  marginBottom: spacing[1],
                }}
              >
                {farmsNeedingAttention && farmsNeedingAttention[0]
                  ? t(`dashboard.needsAttention.reasons.${farmsNeedingAttention[0].reason}`)
                  : t('dashboard.hero.attentionNeeded')}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colorWithOpacity('#ffffff', 0.7),
                  lineHeight: 20,
                  marginBottom: spacing[3],
                }}
              >
                {farmsNeedingAttention && farmsNeedingAttention[0]?.farm?.name
                  ? farmsNeedingAttention[0].farm.name
                  : ''}
              </Text>
            </>
          ) : (
            // Greeting fallback when no alerts
            <>
              <Text
                style={{
                  fontSize: 24,
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
                  fontSize: 14,
                  color: colorWithOpacity('#ffffff', 0.7),
                  lineHeight: 20,
                  marginBottom: spacing[3],
                }}
              >
                {stats?.farmsCount
                  ? t('dashboard.allFarmsHealthy', { count: stats.farmsCount })
                  : t('dashboard.greeting.noFarms')}
              </Text>
            </>
          )}

          {/* Weather line */}
          <Text
            style={{
              fontSize: 12,
              color: colorWithOpacity('#ffffff', 0.5),
              fontWeight: fontWeight.normal,
              letterSpacing: 0.2,
            }}
          >
            {todayLabel}
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
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colorWithOpacity(colors.primary[500], 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <SymbolIcon name="leaf" size={18} color={colors.primary[500]} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  lineHeight: 28,
                  marginBottom: spacing[1],
                }}
              >
                {formatNumber(stats?.farmsCount ?? 0, { maximumFractionDigits: 0 })}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {t('dashboard.stats.farms')}
              </Text>
            </View>

            {/* Workers */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colorWithOpacity(colors.secondary[500], 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <SymbolIcon name="person.2" size={18} color={colors.secondary[500]} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  lineHeight: 28,
                  marginBottom: spacing[1],
                }}
              >
                {formatNumber(stats?.activeWorkersCount ?? 0, { maximumFractionDigits: 0 })}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {t('dashboard.stats.activeWorkers')}
              </Text>
            </View>

            {/* Tasks */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colorWithOpacity(colors.accent[500], 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <SymbolIcon name="checklist" size={18} color={colors.accent[500]} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  lineHeight: 28,
                  marginBottom: spacing[1],
                }}
              >
                {formatNumber(stats?.pendingTasksCount ?? 0, { maximumFractionDigits: 0 })}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {t('dashboard.stats.tasks')}
              </Text>
            </View>

            {/* Activities */}
            <View
              style={{
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colorWithOpacity(colors.info, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <SymbolIcon name="chart.bar" size={18} color={colors.info} />
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                  lineHeight: 28,
                  marginBottom: spacing[1],
                }}
              >
                {formatNumber(stats?.recentActivitiesCount ?? 0, { maximumFractionDigits: 0 })}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[500],
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {t('dashboard.stats.activities')}
              </Text>
            </View>
          </View>

          {/* Needs Attention Section */}
          {isLoadingAttention ? (
            <View
              style={{
                marginBottom: spacing[6],
                height: 60,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: colors.surface[300],
              }}
            >
              <ActivityIndicator color={m3.colorScheme.primary} />
            </View>
          ) : (
            farmsNeedingAttention &&
            farmsNeedingAttention.length > 0 && (
              <View style={{ marginBottom: spacing[6] }}>
                <View style={sectionTitleStyle as ViewStyle}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <Text style={sectionTitleStyle} accessibilityRole="header">
                      {t('dashboard.needsAttention.title')}
                    </Text>
                    <Text style={sectionCountStyle}>{farmsNeedingAttention.length}</Text>
                  </View>
                </View>
                {farmsNeedingAttention.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.farm.id}
                    onPress={() => item.farm.id && handleFarmAttention(item.farm.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.farm.name}. ${t(`dashboard.needsAttention.reasons.${item.reason}`)}.`}
                    style={{
                      backgroundColor: colors.surface[100],
                      borderWidth: 1,
                      borderColor: colors.surface[300],
                      borderRadius: borderRadius.md,
                      overflow: 'hidden',
                      marginBottom: spacing[2],
                    }}
                  >
                    {({ pressed }) => (
                      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                        {/* 3px amber left strip */}
                        <View
                          style={{
                            width: 3,
                            backgroundColor: colors.warning,
                            flexShrink: 0,
                          }}
                        />
                        {/* Body */}
                        <View
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: spacing[3] + 2,
                            paddingLeft: spacing[3],
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: colorWithOpacity(colors.warning, 0.12),
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <SymbolIcon
                              name="exclamationmark.triangle"
                              size={18}
                              color={colors.warning}
                            />
                          </View>
                          <View style={{ marginLeft: spacing[2] + 2, flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: fontWeight.semibold,
                                color: colors.surface[900],
                                lineHeight: 19,
                              }}
                            >
                              {item.farm.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                color: colors.surface[500],
                                lineHeight: 18,
                              }}
                            >
                              {t(`dashboard.needsAttention.reasons.${item.reason}`)}
                            </Text>
                          </View>
                          <SymbolIcon name="chevron.right" size={16} color={colors.surface[400]} />
                        </View>
                        {/* Press overlay */}
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              backgroundColor: pressed
                                ? colorWithOpacity(
                                    colors.surface[900],
                                    m3.stateLayerOpacity.pressed,
                                  )
                                : 'transparent',
                            },
                          ]}
                        />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )
          )}

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
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
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
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colorWithOpacity(colors.irrigation[500], 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="water" size={20} color={colors.irrigation[500]} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
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
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colorWithOpacity(colors.spray[500], 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="flask" size={20} color={colors.spray[500]} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
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
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colorWithOpacity(colors.harvest[500], 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="dollarsign.circle" size={20} color={colors.harvest[500]} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
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
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colorWithOpacity(colors.labour[500], 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="doc.text" size={20} color={colors.labour[500]} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
                      marginTop: spacing[1] + 2,
                    }}
                  >
                    {t('dashboard.quickActions.note')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Recent Activity Section - Compact list without card wrapper */}
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                marginBottom: spacing[3],
              }}
            >
              <Text style={sectionTitleStyle} accessibilityRole="header">
                {t('dashboard.recentActivity.title')}
              </Text>
            </View>
            {isLoadingActivities || isLoadingFarms ? (
              <View
                style={{
                  borderRadius: borderRadius.md,
                  padding: spacing[8],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                }}
              >
                <ActivityIndicator color={m3.colorScheme.primary} />
              </View>
            ) : recentActivities && recentActivities.length > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.surface[200],
                }}
              >
                {recentActivities.map((activity, index) => (
                  <Pressable
                    key={activity.id}
                    onPress={() => handleFarmAttention(activity.farmId)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      borderBottomWidth: index < recentActivities.length - 1 ? 1 : 0,
                      borderBottomColor: colors.surface[200],
                    }}
                  >
                    {/* Colored dot */}
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          activity.type === 'irrigation'
                            ? colors.irrigation[500]
                            : activity.type === 'expense'
                              ? colors.harvest[500]
                              : activity.type === 'note'
                                ? colors.labour[500]
                                : m3.colorScheme.primary,
                        flexShrink: 0,
                      }}
                    />
                    {/* Primary and secondary text */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: fontWeight.medium,
                          color: colors.surface[900],
                          lineHeight: 20,
                        }}
                      >
                        {activity.description}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.surface[500],
                          lineHeight: 16,
                        }}
                      >
                        {activity.farmName}
                      </Text>
                    </View>
                    {/* Time */}
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.surface[400],
                        flexShrink: 0,
                      }}
                    >
                      {activity.date}
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
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                }}
              >
                <SymbolIcon name="clock" size={48} color={colors.surface[400]} />
                <Text
                  style={{
                    textAlign: 'center',
                    marginTop: spacing[4],
                    fontSize: fontSize.sm,
                    color: colors.surface[500],
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
    </>
  );
}
