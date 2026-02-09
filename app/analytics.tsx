import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, SafeAreaView } from 'react-native';

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useAnalytics } from '../src/hooks/use-analytics';
import { TimeRange } from '../src/types/analytics';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { colorWithOpacity } from '@/utils/color';

const TIME_RANGES: { value: TimeRange; labelKey: string }[] = [
  { value: '30d', labelKey: 'analytics.timeRanges.30d' },
  { value: '90d', labelKey: 'analytics.timeRanges.90d' },
  { value: '1y', labelKey: 'analytics.timeRanges.1y' },
  { value: 'all', labelKey: 'analytics.timeRanges.all' },
];

export default function AnalyticsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const { analytics, costAnalysis, yieldAnalysis, performanceMetrics, isLoading } =
    useAnalytics(timeRange);

  const currency = useCurrency();
  const metricColors = useMemo(
    () => ({
      irrigation: {
        bg: colorWithOpacity(m3.colorScheme.primary, 0.15),
        icon: m3.colorScheme.primary,
      },
      spray: {
        bg: colorWithOpacity(m3.colorScheme.tertiary, 0.15),
        icon: m3.colorScheme.tertiary,
      },
      harvest: {
        bg: colorWithOpacity(colors.warning, 0.18),
        icon: colors.warning,
      },
      cost: {
        bg: colorWithOpacity(colors.success, 0.18),
        icon: colors.success,
      },
    }),
    [colors, m3],
  );
  const activityIcons = useMemo<Record<string, { icon: string; color: string }>>(
    () => ({
      irrigation: { icon: 'drop.fill', color: m3.colorScheme.primary },
      spray: { icon: 'flask.fill', color: m3.colorScheme.tertiary },
      harvest: { icon: 'basket.fill', color: colors.warning },
      expense: { icon: 'dollarsign.circle.fill', color: m3.colorScheme.error },
      fertigation: { icon: 'leaf.fill', color: colors.success },
    }),
    [colors.success, colors.warning, m3],
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack.Screen options={{ title: t('analytics.title') }} />
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          {t('analytics.loading')}
        </Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <Stack.Screen options={{ title: t('analytics.title') }} />
        <SymbolIcon
          name="chart.bar.fill"
          size={48}
          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
        />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          {t('analytics.empty.title')}
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            marginTop: spacing[2],
            textAlign: 'center',
          }}
        >
          {t('analytics.empty.subtitle')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <Stack.Screen options={{ title: t('analytics.title') }} />

        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
          {/* Time Range Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
            style={{ marginBottom: spacing[4] }}
          >
            {TIME_RANGES.map((range) => (
              <Pressable
                key={range.value}
                onPress={() => setTimeRange(range.value)}
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.full,
                  backgroundColor:
                    timeRange === range.value ? m3.colorScheme.primary : colors.surface[100],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color:
                      timeRange === range.value ? m3.colorScheme.onPrimary : colors.surface[600],
                  }}
                >
                  {t(range.labelKey)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Overview Stats */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: spacing[4],
              gap: 12,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '47%',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[2],
                  backgroundColor: metricColors.irrigation.bg,
                }}
              >
                <SymbolIcon
                  name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                  size={20}
                  color={metricColors.irrigation.icon}
                />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                }}
              >
                {analytics.totalIrrigationHours.toFixed(1)}h
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                {t('analytics.labels.irrigationHours')}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '47%',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[2],
                  backgroundColor: metricColors.spray.bg,
                }}
              >
                <SymbolIcon
                  name={resolveSymbolIconName(ICON_REGISTRY.spray)}
                  size={20}
                  color={metricColors.spray.icon}
                />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                }}
              >
                {analytics.totalSprayCount}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                {t('analytics.labels.sprayApplications')}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '47%',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[2],
                  backgroundColor: metricColors.harvest.bg,
                }}
              >
                <SymbolIcon
                  name={resolveSymbolIconName(ICON_REGISTRY.harvest)}
                  size={20}
                  color={metricColors.harvest.icon}
                />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                }}
              >
                {(analytics.totalHarvestQuantity / 1000).toFixed(1)}t
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                {t('analytics.labels.totalHarvest')}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '47%',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[2],
                  backgroundColor: metricColors.cost.bg,
                }}
              >
                <SymbolIcon
                  name={resolveSymbolIconName(ICON_REGISTRY.expense)}
                  size={20}
                  color={metricColors.cost.icon}
                />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                }}
              >
                {formatNumber(analytics.totalHarvestValue, {
                  style: 'currency',
                  currency,
                  notation: 'compact',
                  maximumFractionDigits: 0,
                })}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                {t('analytics.labels.harvestValue')}
              </Text>
            </View>
          </View>

          {/* Performance Score */}
          {performanceMetrics && (
            <View
              style={{
                backgroundColor: colors.surface[100],
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
                    color: colors.surface[900],
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
                      backgroundColor: colors.surface[50],
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
                          color: colors.surface[500],
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
                            ? colors.success
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
                        color: colors.surface[900],
                      }}
                    >
                      {value.score}
                    </Text>
                    <Text
                      style={{ fontSize: fontSize.xs, color: colors.surface[500] }}
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
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.costAnalysis')}
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: spacing[3], gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colorWithOpacity(colors.success, 0.12),
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.success }}>
                    {t('analytics.metrics.revenue')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.success,
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
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.metrics.profitMargin')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: costAnalysis.profitMargin >= 0 ? colors.success : m3.colorScheme.error,
                    }}
                  >
                    {costAnalysis.profitMargin.toFixed(1)}%
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.metrics.roi')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: costAnalysis.roi >= 0 ? colors.success : m3.colorScheme.error,
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
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginBottom: spacing[3],
                }}
              >
                {t('analytics.sections.yieldAnalysis')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.labels.totalYield')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {formatNumber(yieldAnalysis.currentYield)} kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.labels.yieldPerAcre')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {yieldAnalysis.yieldPerAcre.toFixed(1)} kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.labels.avgPrice')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {formatCurrency(yieldAnalysis.avgPricePerKg, currency)}/kg
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    width: '47%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {t('analytics.labels.totalArea')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
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
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
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
                        index < displayed.length - 1 ? colors.surface[100] : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: colors.surface[100],
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
                          color: colors.surface[700],
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
                        color: colors.surface[900],
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
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
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
                          index < recentItems.length - 1 ? colors.surface[100] : 'transparent',
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
                            color: colors.surface[900],
                          }}
                        >
                          {activity.farmName}
                        </Text>
                        <Text
                          style={{ fontSize: fontSize.xs, color: colors.surface[500] }}
                          numberOfLines={1}
                        >
                          {activity.details}
                        </Text>
                      </View>
                      <Text style={{ fontSize: fontSize.xs, color: colors.surface[400] }}>
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
