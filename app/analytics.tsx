import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';

import { Stack } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useAnalytics } from '../src/hooks/useAnalytics';
import { useProfile } from '../src/hooks';
import { TimeRange } from '../src/types/analytics';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

// Metric card colors
const metricColors = {
  irrigation: { bg: '#DBEAFE', icon: '#3B82F6' },
  spray: { bg: '#F3E8FF', icon: '#8B5CF6' },
  harvest: { bg: '#FEF3C7', icon: '#F59E0B' },
  cost: { bg: '#DCFCE7', icon: '#16A34A' },
};

// Activity type icons
const activityIcons: Record<string, { icon: string; color: string }> = {
  irrigation: { icon: 'drop.fill', color: '#3B82F6' },
  spray: { icon: 'flask.fill', color: '#8B5CF6' },
  harvest: { icon: 'basket.fill', color: '#F59E0B' },
  expense: { icon: 'dollarsign.circle.fill', color: '#DC2626' },
  fertigation: { icon: 'leaf.fill', color: '#16A34A' },
};

export default function AnalyticsScreen() {
  const { data: profile } = useProfile();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const { analytics, costAnalysis, yieldAnalysis, performanceMetrics, isLoading } =
    useAnalytics(timeRange);

  const currency = profile?.preferred_currency || 'INR';
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack.Screen options={{ title: 'Analytics' }} />
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          Loading analytics...
        </Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <Stack.Screen options={{ title: 'Analytics' }} />
        <Symbol name="chart.bar.fill" size={48} color="#9CA3AF" />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          No data available
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            marginTop: spacing[2],
            textAlign: 'center',
          }}
        >
          Add farms and record activities to see analytics
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
      <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
        <Stack.Screen options={{ title: 'Analytics' }} />

        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
          {/* Time Range Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
            style={{ marginBottom: spacing[4] }}
          >
            {TIME_RANGES.map((range) => (
              <TouchableOpacity
                key={range.value}
                onPress={() => setTimeRange(range.value)}
                style={{
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.full,
                  backgroundColor: timeRange === range.value ? colors.primary[600] : colors.white,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: timeRange === range.value ? colors.white : colors.surface[600],
                  }}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
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
                backgroundColor: colors.white,
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
                <Symbol name="drop.fill" size={20} color={metricColors.irrigation.icon} />
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
                Irrigation Hours
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.white,
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
                <Symbol name="flask.fill" size={20} color={metricColors.spray.icon} />
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
                Spray Applications
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.white,
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
                <Symbol name="basket.fill" size={20} color={metricColors.harvest.icon} />
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
                Total Harvest
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.white,
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
                <Symbol name="dollarsign.circle.fill" size={20} color={metricColors.cost.icon} />
              </View>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.surface[900],
                }}
              >
                {currencySymbol}
                {(analytics.totalHarvestValue / 1000).toFixed(0)}k
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                Harvest Value
              </Text>
            </View>
          </View>

          {/* Performance Score */}
          {performanceMetrics && (
            <View
              style={{
                backgroundColor: colors.white,
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
                  Performance Score
                </Text>
                <View
                  style={{
                    backgroundColor: colors.primary[100],
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.primary[700],
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
                        {key}
                      </Text>
                      <Symbol
                        name={
                          value.trend === 'up'
                            ? 'trending-up'
                            : value.trend === 'down'
                              ? 'trending-down'
                              : 'remove'
                        }
                        size={14}
                        color={
                          value.trend === 'up'
                            ? '#16A34A'
                            : value.trend === 'down'
                              ? '#DC2626'
                              : '#6B7280'
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
                backgroundColor: colors.white,
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
                Cost Analysis
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: spacing[3], gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#ECFDF3',
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: '#16A34A' }}>Revenue</Text>
                  <Text
                    style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#15803D' }}
                  >
                    {currencySymbol}
                    {costAnalysis.totalRevenue.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#FEF2F2',
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: '#DC2626' }}>Expenses</Text>
                  <Text
                    style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#B91C1C' }}
                  >
                    {currencySymbol}
                    {costAnalysis.totalCosts.toLocaleString()}
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
                    Profit Margin
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: costAnalysis.profitMargin >= 0 ? '#15803D' : '#B91C1C',
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
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>ROI</Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: costAnalysis.roi >= 0 ? '#15803D' : '#B91C1C',
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
                backgroundColor: colors.white,
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
                Yield Analysis
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
                    Total Yield
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {yieldAnalysis.currentYield.toLocaleString()} kg
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
                    Yield/Acre
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
                    Avg Price
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {currencySymbol}
                    {yieldAnalysis.avgPricePerKg.toFixed(2)}/kg
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
                    Total Area
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {yieldAnalysis.totalArea.toFixed(1)} acres
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Expense Breakdown */}
          {analytics.expensesByType.length > 0 && (
            <View
              style={{
                backgroundColor: colors.white,
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
                Expense Breakdown
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
                        <Symbol name="doc.text.fill" size={16} color="#6B7280" />
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
                      {currencySymbol}
                      {expense.amount.toLocaleString()}
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
                backgroundColor: '#EFF6FF',
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}
              >
                <Symbol name="lightbulb.fill" size={20} color="#3B82F6" />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: '#1E3A8A',
                    marginLeft: spacing[2],
                  }}
                >
                  Recommendations
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
                  <Symbol name="checkmark.circle.fill" size={16} color="#3B82F6" />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: '#1E40AF',
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
                backgroundColor: colors.white,
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
                Recent Activity
              </Text>
              {(() => {
                const recentItems = analytics.recentActivity.slice(0, 5);
                return recentItems.map((activity, index) => {
                  const iconInfo = activityIcons[activity.type] || {
                    icon: 'ellipse',
                    color: '#6B7280',
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
                          backgroundColor: `${iconInfo.color}15`,
                        }}
                      >
                        <Symbol name={iconInfo.icon} size={18} color={iconInfo.color} />
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
                        {new Date(activity.date).toLocaleDateString()}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
