import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useAnalytics } from '../src/hooks/use-analytics';
import { TimeRange } from '../src/types/analytics';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3 } from '@/styles/use-theme';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { colorWithOpacity } from '@/utils/color';

const TIME_RANGES: { value: TimeRange; labelKey: string }[] = [
  { value: '30d', labelKey: 'analytics.timeRanges.30d' },
  { value: '90d', labelKey: 'analytics.timeRanges.90d' },
  { value: '1y', labelKey: 'analytics.timeRanges.1y' },
  { value: 'all', labelKey: 'analytics.timeRanges.all' },
];

// Category colors for the new Cellar Ledger palette
const CATEGORY_COLORS = {
  irrigation: '#3F6E78',
  spray: '#6C7C46',
  harvest: '#A9752F',
  expense: '#A56B4F',
  fertigation: '#56704E',
  labour: '#7A5E8E',
} as const;

// Section header style - 11px/600/uppercase/stone-5
const SECTION_HEADER_STYLE = {
  fontSize: fontSize.xs,
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
};

export default function AnalyticsScreen() {
  const m3 = useM3();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const { analytics, costAnalysis, yieldAnalysis, performanceMetrics, isLoading } =
    useAnalytics(timeRange);

  const currency = useCurrency();
  const activityIcons = useMemo<Record<string, { icon: string; color: string }>>(
    () => ({
      irrigation: { icon: 'drop.fill', color: m3.colorScheme.primary },
      spray: { icon: 'flask.fill', color: m3.colorScheme.tertiary },
      harvest: { icon: 'basket.fill', color: m3.colorScheme.warning },
      expense: { icon: 'dollarsign.circle.fill', color: m3.colorScheme.error },
      fertigation: { icon: 'leaf.fill', color: m3.colorScheme.success },
    }),
    [m3],
  );

  // Custom JS header (avoids iOS 26 native bar-button glass capsule)
  const analyticsHeader = (
    <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[2],
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: 'transparent',
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          {({ pressed }) => (
            <View
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolIcon name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: radius.xl,
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                      : 'transparent',
                  },
                ]}
              />
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {t('analytics.title')}
          </Text>
        </View>

        <View style={{ width: 44, height: 44 }} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        {analyticsHeader}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text style={{ color: m3.surface.s600, marginTop: spacing[4] }}>
            {t('analytics.loading')}
          </Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        {analyticsHeader}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing[6],
          }}
        >
          <SymbolIcon
            name="chart.bar.fill"
            size={48}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          />
          <Text
            style={{
              color: m3.surface.s600,
              marginTop: spacing[4],
              textAlign: 'center',
            }}
          >
            {t('analytics.empty.title')}
          </Text>
          <Text
            style={{
              color: m3.surface.s500,
              fontSize: fontSize.sm,
              marginTop: spacing[2],
              textAlign: 'center',
            }}
          >
            {t('analytics.empty.subtitle')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      edges={['left', 'right', 'bottom']}
    >
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        {analyticsHeader}

        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
          {/* Time Range Selector - Horizontal pill row with 999 borderRadius */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2], marginBottom: spacing[5] }}
          >
            {TIME_RANGES.map((range) => {
              const isActive = timeRange === range.value;
              return (
                <Pressable
                  key={range.value}
                  onPress={() => setTimeRange(range.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: radius.full, // Pill shape per wireframe
                    backgroundColor: isActive ? m3.colorScheme.primary : m3.surface.s100,
                    borderWidth: isActive ? 0 : 1,
                    borderColor: m3.surface.s300,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: isActive ? '#FFFFFF' : m3.surface.s500,
                    }}
                  >
                    {t(range.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Summary Stat Cards - Horizontal scroll with trends */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], marginBottom: spacing[6], paddingBottom: 2 }}
          >
            {/* Total Expenses Card */}
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                borderRadius: radius.md,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                minWidth: 130,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginBottom: 4 }}>
                {t('analytics.labels.totalExpenses')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: '700',
                    color: m3.surface.s900,
                  }}
                >
                  {formatCurrency(costAnalysis?.totalCosts || 0, currency, {
                    notation: 'compact',
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            </View>

            {/* Harvest Yield Card */}
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                borderRadius: radius.md,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                minWidth: 130,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginBottom: 4 }}>
                {t('analytics.labels.harvestYield')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: '700',
                    color: m3.surface.s900,
                  }}
                >
                  {(analytics.totalHarvestQuantity / 1000).toFixed(1)}
                </Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: m3.surface.s500 }}>
                  {t('analytics.units.tons')}
                </Text>
              </View>
            </View>

            {/* Activities Logged Card */}
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                borderRadius: radius.md,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                minWidth: 130,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginBottom: 4 }}>
                {t('analytics.labels.activitiesLogged')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: '700',
                    color: m3.surface.s900,
                  }}
                >
                  {analytics.irrigationsByMonth.reduce((sum, m) => sum + m.count, 0) +
                    analytics.totalSprayCount +
                    analytics.totalHarvestCount +
                    analytics.expensesByType.reduce((sum, e) => sum + e.count, 0)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Category Breakdown - Colored progress bars with category colors */}
          <View
            style={{
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: m3.surface.s300,
              borderRadius: radius.md,
              padding: spacing[4],
              marginBottom: spacing[6],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  ...SECTION_HEADER_STYLE,
                  color: m3.surface.s500,
                }}
              >
                {t('analytics.sections.categoryBreakdown')}
              </Text>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: m3.surface.s500 }}>
                {analytics.irrigationsByMonth.reduce((sum, m) => sum + m.count, 0) +
                  analytics.totalSprayCount +
                  analytics.totalHarvestCount +
                  analytics.expensesByType.reduce((sum, e) => sum + e.count, 0)}{' '}
                {t('analytics.labels.entries')}
              </Text>
            </View>

            {/* Category rows with colored dots and progress bars */}
            {(() => {
              // Calculate totals for progress bars from real analytics data
              const irrigationCount = analytics.irrigationsByMonth.reduce(
                (sum, m) => sum + m.count,
                0,
              );
              const sprayCount = analytics.totalSprayCount;
              const harvestCount = analytics.totalHarvestCount;
              const expenseCount = analytics.expensesByType.reduce((sum, e) => sum + e.count, 0);

              const categoryTotals: Record<string, number> = {
                irrigation: irrigationCount,
                spray: sprayCount,
                harvest: harvestCount,
                expense: expenseCount,
              };
              const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;

              const categories = [
                {
                  key: 'irrigation',
                  name: t('analytics.categories.irrigation'),
                  color: CATEGORY_COLORS.irrigation,
                },
                {
                  key: 'spray',
                  name: t('analytics.categories.spray'),
                  color: CATEGORY_COLORS.spray,
                },
                {
                  key: 'harvest',
                  name: t('analytics.categories.harvest'),
                  color: CATEGORY_COLORS.harvest,
                },
                {
                  key: 'expense',
                  name: t('analytics.categories.expense'),
                  color: CATEGORY_COLORS.expense,
                },
              ];

              return categories.map((cat, index) => {
                const count = categoryTotals[cat.key] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <View
                    key={cat.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: m3.surface.s200,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: radius.xs,
                        backgroundColor: cat.color,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: '500',
                            color: m3.surface.s900,
                          }}
                        >
                          {cat.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: '600',
                            color: m3.surface.s900,
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: '100%',
                          height: 6,
                          borderRadius: radius.xs,
                          backgroundColor: m3.surface.s200, // Track #EEE7DD
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            borderRadius: radius.xs,
                            backgroundColor: cat.color,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                );
              });
            })()}
          </View>

          {/* Performance Score */}
          {performanceMetrics && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s900,
                  }}
                >
                  {t('analytics.labels.performanceScore')}
                </Text>
                <View
                  style={{
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.16),
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.primary,
                    }}
                  >
                    {performanceMetrics.overallScore}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(performanceMetrics.categories).map(([key, value]) => (
                  <View
                    key={key}
                    style={{
                      backgroundColor: m3.surface.s50,
                      borderRadius: borderRadius.xl,
                      padding: spacing[3],
                      width: '47%',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.surface.s500,
                          textTransform: 'capitalize',
                        }}
                      >
                        {t(`analytics.categories.${key}`, { defaultValue: key })}
                      </Text>
                      <SymbolIcon
                        name={
                          value.trend === 'up'
                            ? 'chart.line.uptrend.xyaxis'
                            : value.trend === 'down'
                              ? 'chart.line.downtrend.xyaxis'
                              : 'minus'
                        }
                        size={14}
                        color={
                          value.trend === 'up'
                            ? m3.colorScheme.success
                            : value.trend === 'down'
                              ? m3.colorScheme.error
                              : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)
                        }
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: fontSize.lg,
                        fontWeight: fontWeight.bold,
                        color: m3.surface.s900,
                      }}
                    >
                      {value.score}
                    </Text>
                    <Text
                      style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}
                      numberOfLines={1}
                    >
                      {value.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Cost Analysis */}
          {costAnalysis && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.costAnalysis')}
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: spacing[3], gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colorWithOpacity(m3.colorScheme.success, 0.12),
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.success }}>
                    {t('analytics.metrics.revenue')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.success,
                    }}
                  >
                    {formatCurrency(costAnalysis.totalRevenue, currency)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.error }}>
                    {t('analytics.metrics.expenses')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.error,
                    }}
                  >
                    {formatCurrency(costAnalysis.totalCosts, currency)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.metrics.profitMargin')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color:
                        costAnalysis.profitMargin >= 0
                          ? m3.colorScheme.success
                          : m3.colorScheme.error,
                    }}
                  >
                    {costAnalysis.profitMargin.toFixed(1)}%
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.metrics.roi')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: costAnalysis.roi >= 0 ? m3.colorScheme.success : m3.colorScheme.error,
                    }}
                  >
                    {costAnalysis.roi.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Yield Analysis */}
          {yieldAnalysis && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.yieldAnalysis')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View
                  style={{
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.labels.totalYield')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                    }}
                  >
                    {formatNumber(yieldAnalysis.currentYield)} kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.labels.yieldPerAcre')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                    }}
                  >
                    {yieldAnalysis.yieldPerAcre.toFixed(1)} kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.labels.avgPrice')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                    }}
                  >
                    {formatCurrency(yieldAnalysis.avgPricePerKg, currency)}/kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: m3.surface.s50,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('analytics.labels.totalArea')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                    }}
                  >
                    {yieldAnalysis.totalArea.toFixed(1)} {t('units.acres')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Expense Breakdown */}
          {analytics.expensesByType.length > 0 && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.expenseBreakdown')}
              </Text>
              {(() => {
                const displayed = analytics.expensesByType.slice(0, 5);
                return displayed.map((expense, index) => (
                  <View
                    key={expense.type}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing[2],
                      borderBottomWidth: index < displayed.length - 1 ? 1 : 0,
                      borderBottomColor:
                        index < displayed.length - 1 ? m3.surface.s100 : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: m3.surface.s100,
                          borderRadius: borderRadius.lg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <SymbolIcon
                          name={resolveSymbolIconName(ICON_REGISTRY.note)}
                          size={16}
                          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          color: m3.surface.s700,
                          marginLeft: spacing[2],
                          textTransform: 'capitalize',
                        }}
                      >
                        {expense.type}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: m3.surface.s900,
                      }}
                    >
                      {formatCurrency(expense.amount, currency)}
                    </Text>
                  </View>
                ));
              })()}
            </View>
          )}

          {/* Recommendations */}
          {performanceMetrics && performanceMetrics.recommendations.length > 0 && (
            <View
              style={{
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}
              >
                <SymbolIcon name="lightbulb.fill" size={20} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.primary,
                    marginLeft: spacing[2],
                  }}
                >
                  {t('analytics.sections.recommendations')}
                </Text>
              </View>
              {performanceMetrics.recommendations.map((rec, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginBottom: spacing[2],
                  }}
                >
                  <SymbolIcon
                    name="checkmark.circle.fill"
                    size={16}
                    color={m3.colorScheme.primary}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: m3.colorScheme.onSurfaceVariant,
                      marginLeft: spacing[2],
                      flex: 1,
                    }}
                  >
                    {rec}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Recent Activity */}
          {analytics.recentActivity.length > 0 && (
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.recentActivity')}
              </Text>
              {(() => {
                const recentItems = analytics.recentActivity.slice(0, 5);
                return recentItems.map((activity, index) => {
                  const iconInfo = activityIcons[activity.type] || {
                    icon: 'ellipse',
                    color: m3.colorScheme.onSurfaceVariant,
                  };
                  return (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: spacing[3],
                        borderBottomWidth: index < recentItems.length - 1 ? 1 : 0,
                        borderBottomColor:
                          index < recentItems.length - 1 ? m3.surface.s100 : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: borderRadius.xl,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colorWithOpacity(iconInfo.color, 0.08),
                        }}
                      >
                        <SymbolIcon name={iconInfo.icon} size={18} color={iconInfo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing[3] }}>
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.medium,
                            color: m3.surface.s900,
                          }}
                        >
                          {activity.farmName}
                        </Text>
                        <Text
                          style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}
                          numberOfLines={1}
                        >
                          {activity.details}
                        </Text>
                      </View>
                      <Text style={{ fontSize: fontSize.xs, color: m3.surface.s400 }}>
                        {formatDate(new Date(activity.date), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
