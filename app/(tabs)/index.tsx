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
  useTodayNeedsAttention,
  useRecentActivities,
  useFarms,
  useProfile,
  type TodayNeedAttentionItem,
} from '@/hooks';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
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
import { parseDbDateToLocalDate } from '@/utils/date';

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
    data: todayNeedsAttention,
    refetch: refetchTodayNeedsAttention,
    isLoading: isLoadingTodayNeedsAttention,
    error: todayNeedsAttentionError,
  } = useTodayNeedsAttention(6);
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
    await Promise.all([
      refetchStats(),
      refetchTodayNeedsAttention(),
      refetchActivities(),
      refetchFarms(),
    ]);
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

  const handleMetricCardPress = (destination: 'farms' | 'workers' | 'tasks' | 'activities') => {
    if (destination === 'farms') {
      router.push('/(tabs)/explore');
      return;
    }
    if (destination === 'workers') {
      router.push('/(tabs)/workers');
      return;
    }
    if (destination === 'tasks') {
      router.push('/tasks');
      return;
    }
    router.push('/logs');
  };

  const hasFarms = Boolean(farms && farms.length > 0);
  const attentionItems = todayNeedsAttention;

  const formatAttentionDate = (value?: string | null): string | null => {
    if (!value) return null;
    const parsed = parseDbDateToLocalDate(value);
    if (!parsed) return null;
    return formatDate(parsed, { month: 'short', day: 'numeric' });
  };

  const getAttentionActionLabel = (item: TodayNeedAttentionItem): string => {
    if (item.type === 'overdueTask') return t('dashboard.needsAttention.actions.reviewTasks');
    if (item.type === 'noRecentLogs') return t('dashboard.needsAttention.actions.logNow');
    if (item.type === 'phiDeadline') return t('dashboard.needsAttention.actions.reviewSpraySafety');
    return t('dashboard.needsAttention.actions.openFarm');
  };

  const getAttentionIcon = (
    item: TodayNeedAttentionItem,
  ): { name: string; background: string; color: string } => {
    if (item.type === 'overdueTask') {
      return {
        name: 'checklist',
        background: colorWithOpacity(m3.colorScheme.error, 0.14),
        color: m3.colorScheme.error,
      };
    }

    if (item.type === 'lowWaterLevel') {
      return {
        name: 'water',
        background: colorWithOpacity(m3.colorScheme.warning, 0.16),
        color: m3.colorScheme.warning,
      };
    }

    if (item.type === 'phiDeadline') {
      return {
        name: 'calendar',
        background: colorWithOpacity(m3.colorScheme.tertiary, 0.16),
        color: m3.colorScheme.tertiary,
      };
    }

    return {
      name: 'square.and.pencil',
      background: colorWithOpacity(m3.colorScheme.primary, 0.16),
      color: m3.colorScheme.primary,
    };
  };

  const getAttentionMetaLabel = (item: TodayNeedAttentionItem): string | null => {
    if (item.type === 'overdueTask') {
      const dueDate = formatAttentionDate(item.dueDate);
      return dueDate ? t('dashboard.needsAttention.meta.taskDue', { date: dueDate }) : null;
    }
    if (item.type === 'phiDeadline') {
      const safeDate = formatAttentionDate(item.safeHarvestDate);
      return safeDate ? t('dashboard.needsAttention.meta.phiDue', { date: safeDate }) : null;
    }
    return null;
  };

  const getAttentionTitle = (item: TodayNeedAttentionItem): string => {
    if (item.type === 'overdueTask') {
      return item.taskTitle?.trim() || t('dashboard.needsAttention.taskFallback');
    }
    if (item.type === 'phiDeadline' && item.chemical?.trim()) {
      return item.chemical.trim();
    }
    return item.farmName;
  };

  const handleNeedsAttentionPress = (item: TodayNeedAttentionItem) => {
    if (item.type === 'overdueTask') {
      router.push({
        pathname: '/tasks',
        params: {
          farmId: String(item.farmId),
          filter: 'overdue',
        },
      });
      return;
    }

    if (item.type === 'noRecentLogs') {
      router.push({
        pathname: '/add-entry',
        params: {
          farmId: String(item.farmId),
          initialTab: 'log',
          tabs: 'log',
        },
      });
      return;
    }

    if (item.type === 'phiDeadline') {
      router.push({
        pathname: '/spray-safe-checker',
        params: {
          farmId: String(item.farmId),
        },
      });
      return;
    }

    router.push(`/farm/${item.farmId}`);
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

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);
  const isTourScrollLocked =
    hasHydrated &&
    (guidedTourStatus === 'in_progress' ||
      (guidedTourStatus === 'not_started' && !hasSeenWelcomeThisSession));

  const hasAlerts = attentionItems && attentionItems.length > 0;
  const alertCount = attentionItems?.length ?? 0;

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
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity('#ffffff', 0.2),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.28),
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
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
                    fontSize: 20,
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
                  borderRadius: 19,
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

          {hasAlerts ? (
            // Greeting title with alert summary subtitle
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
                {t('dashboard.hero.attentionSummary', { count: alertCount })}
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
                {stats?.farmsCount ? t('dashboard.hero.allClear') : t('dashboard.empty.noFarms')}
              </Text>
            </>
          )}
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
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
                opacity: pressed ? 0.85 : 1,
              })}
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
                  letterSpacing: 0,
                }}
              >
                {t('dashboard.stats.farms')}
              </Text>
            </Pressable>

            {/* Workers */}
            <Pressable
              onPress={() => handleMetricCardPress('workers')}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.stats.activeWorkers')}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
                opacity: pressed ? 0.85 : 1,
              })}
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
                  letterSpacing: 0,
                }}
              >
                {t('dashboard.stats.activeWorkers')}
              </Text>
            </Pressable>

            {/* Tasks */}
            <Pressable
              onPress={() => handleMetricCardPress('tasks')}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.stats.tasks')}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
                opacity: pressed ? 0.85 : 1,
              })}
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
                  letterSpacing: 0,
                }}
              >
                {t('dashboard.stats.tasks')}
              </Text>
            </Pressable>

            {/* Activities */}
            <Pressable
              onPress={() => handleMetricCardPress('activities')}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.stats.activities')}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: '45%',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[300],
                borderRadius: borderRadius.md,
                padding: spacing[4],
                opacity: pressed ? 0.85 : 1,
              })}
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
                  letterSpacing: 0,
                }}
              >
                {t('dashboard.stats.activities')}
              </Text>
            </Pressable>
          </View>

          {/* Today Needs Attention */}
          <View style={{ marginBottom: spacing[6] }}>
            <Text style={sectionTitleStyle} accessibilityRole="header">
              {t('dashboard.needsAttention.title')}
            </Text>
            {isLoadingTodayNeedsAttention ? (
              <View
                style={{
                  height: 72,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderRadius: m3.shape.cornerMedium,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <ActivityIndicator color={m3.colorScheme.primary} />
              </View>
            ) : todayNeedsAttentionError ? (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  padding: spacing[5],
                  alignItems: 'center',
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <SymbolIcon
                  name="exclamationmark.triangle.fill"
                  size={38}
                  color={m3.colorScheme.error}
                />
                <Text
                  style={{
                    ...m3.typography.titleMedium,
                    color: m3.colorScheme.onSurface,
                    marginTop: spacing[3],
                    textAlign: 'center',
                  }}
                >
                  {t('dashboard.needsAttention.error.title')}
                </Text>
                <Text
                  style={{
                    ...m3.typography.bodyMedium,
                    color: m3.colorScheme.onSurfaceVariant,
                    marginTop: spacing[2],
                    textAlign: 'center',
                  }}
                >
                  {t('dashboard.needsAttention.error.subtitle')}
                </Text>
                <View style={{ marginTop: spacing[4], width: '100%' }}>
                  <Button
                    title={t('dashboard.needsAttention.error.cta')}
                    onPress={() => {
                      void refetchTodayNeedsAttention();
                    }}
                  />
                </View>
              </View>
            ) : attentionItems && attentionItems.length > 0 ? (
              attentionItems.map((item) => {
                const title = getAttentionTitle(item);
                const reasonLabel = t(`dashboard.needsAttention.reasons.${item.type}`);
                const actionLabel = getAttentionActionLabel(item);
                const metaLabel = getAttentionMetaLabel(item);
                const icon = getAttentionIcon(item);
                const isHigh = item.severity === 'high';
                const isMedium = item.severity === 'medium';
                const severityHighLabel = t('dashboard.needsAttention.severity.high');
                const severityMediumLabel = t('dashboard.needsAttention.severity.medium');
                const emphasisColor = isHigh
                  ? m3.colorScheme.error
                  : isMedium
                    ? m3.colorScheme.warning
                    : m3.colorScheme.primary;
                const iconBackground = isHigh
                  ? colorWithOpacity(m3.colorScheme.error, 0.18)
                  : isMedium
                    ? colorWithOpacity(m3.colorScheme.warning, 0.18)
                    : colorWithOpacity(m3.colorScheme.primary, 0.1);
                const iconGlyphColor = isHigh
                  ? m3.colorScheme.error
                  : isMedium
                    ? m3.colorScheme.warning
                    : icon.color;
                const secondaryLine =
                  item.farmName && metaLabel
                    ? `${item.farmName} · ${metaLabel}`
                    : item.farmName && !metaLabel
                      ? `${item.farmName} · ${reasonLabel}`
                      : metaLabel
                        ? metaLabel
                        : reasonLabel;
                const accessibilityLabel = `${title}.${
                  isHigh ? ` ${severityHighLabel}.` : isMedium ? ` ${severityMediumLabel}.` : ''
                } ${secondaryLine}. ${actionLabel}.`;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleNeedsAttentionPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    style={{
                      borderRadius: m3.shape.cornerMedium,
                      paddingVertical: spacing[3] + 2,
                      paddingHorizontal: spacing[3],
                      marginBottom: spacing[2],
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colorWithOpacity(emphasisColor, 0.07),
                      borderWidth: 1,
                      borderColor: colorWithOpacity(emphasisColor, 0.25),
                      overflow: 'hidden',
                    }}
                  >
                    {({ pressed }) => (
                      <>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: borderRadius.full,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: iconBackground,
                          }}
                        >
                          <SymbolIcon name={icon.name} size={20} color={iconGlyphColor} />
                        </View>
                        <View style={{ marginLeft: spacing[3], flex: 1 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing[2],
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                ...m3.typography.titleMedium,
                                color: m3.colorScheme.onSurface,
                                flexShrink: 1,
                              }}
                            >
                              {title}
                            </Text>
                            {isHigh ? (
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: borderRadius.pill,
                                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.14),
                                }}
                              >
                                <Text
                                  style={{
                                    ...m3.typography.labelSmall,
                                    color: m3.colorScheme.error,
                                    fontWeight: fontWeight.semibold,
                                    letterSpacing: 0.3,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {severityHighLabel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{
                              ...m3.typography.labelSmall,
                              color: m3.colorScheme.onSurfaceVariant,
                              marginTop: 2,
                            }}
                          >
                            {secondaryLine}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginLeft: spacing[2],
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              ...m3.typography.labelSmall,
                              color: m3.colorScheme.primary,
                              fontWeight: fontWeight.semibold,
                            }}
                          >
                            {actionLabel}
                          </Text>
                          <SymbolIcon
                            name="chevron.right"
                            size={14}
                            color={m3.colorScheme.primary}
                          />
                        </View>
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
                );
              })
            ) : (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  padding: spacing[5],
                  alignItems: 'center',
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <SymbolIcon name="checkmark.seal.fill" size={38} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    ...m3.typography.titleMedium,
                    color: m3.colorScheme.onSurface,
                    marginTop: spacing[3],
                    textAlign: 'center',
                  }}
                >
                  {t('dashboard.needsAttention.empty.title')}
                </Text>
                <Text
                  style={{
                    ...m3.typography.bodyMedium,
                    color: m3.colorScheme.onSurfaceVariant,
                    marginTop: spacing[2],
                    textAlign: 'center',
                  }}
                >
                  {t('dashboard.needsAttention.empty.subtitle')}
                </Text>
                <View style={{ marginTop: spacing[4], width: '100%' }}>
                  <Button
                    title={
                      hasFarms
                        ? t('dashboard.needsAttention.empty.ctaWithFarms')
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
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.irrigation')}
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
                    <AppIcon name="water" size={20} color={colors.irrigation[500]} />
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
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.spray')}
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
                    <AppIcon name="spraycan" size={20} color={colors.spray[500]} />
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
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.expense')}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: colorWithOpacity(colors.expense[500], 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppIcon name="receipt" size={20} color={colors.expense[500]} />
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
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.quickActions.note')}
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
                    <AppIcon name="document-text" size={20} color={colors.labour[500]} />
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
                              ? colors.expense[500]
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
