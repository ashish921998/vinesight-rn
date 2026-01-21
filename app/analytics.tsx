import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  irrigation: { icon: 'water', color: '#3B82F6' },
  spray: { icon: 'flask', color: '#8B5CF6' },
  harvest: { icon: 'basket', color: '#F59E0B' },
  expense: { icon: 'cash', color: '#DC2626' },
  fertigation: { icon: 'leaf', color: '#16A34A' },
};

export default function AnalyticsScreen() {
  const { data: profile } = useProfile();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const {
    analytics,
    costAnalysis,
    yieldAnalysis,
    performanceMetrics,
    isLoading,
  } = useAnalytics(timeRange);

  const currency = profile?.preferred_currency || 'INR';
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Analytics' }} />
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-600 mt-4">Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center p-6">
        <Stack.Screen options={{ title: 'Analytics' }} />
        <Ionicons name="analytics" size={48} color="#9CA3AF" />
        <Text className="text-surface-600 mt-4 text-center">No data available</Text>
        <Text className="text-surface-500 text-sm mt-2 text-center">
          Add farms and record activities to see analytics
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
      <View className="flex-1 bg-surface-50">
      <Stack.Screen options={{ title: 'Analytics' }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Time Range Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {TIME_RANGES.map((range) => (
            <TouchableOpacity
              key={range.value}
              onPress={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-full ${
                timeRange === range.value ? 'bg-primary-600' : 'bg-white'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  timeRange === range.value ? 'text-white' : 'text-surface-600'
                }`}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Overview Stats */}
        <View className="flex-row flex-wrap mb-4" style={{ gap: 12 }}>
          <View className="bg-white rounded-2xl p-4" style={{ width: '47%' }}>
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mb-2"
              style={{ backgroundColor: metricColors.irrigation.bg }}
            >
              <Ionicons name="water" size={20} color={metricColors.irrigation.icon} />
            </View>
            <Text className="text-2xl font-bold text-surface-900">
              {analytics.totalIrrigationHours.toFixed(1)}h
            </Text>
            <Text className="text-xs text-surface-500">Irrigation Hours</Text>
          </View>
          <View className="bg-white rounded-2xl p-4" style={{ width: '47%' }}>
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mb-2"
              style={{ backgroundColor: metricColors.spray.bg }}
            >
              <Ionicons name="flask" size={20} color={metricColors.spray.icon} />
            </View>
            <Text className="text-2xl font-bold text-surface-900">
              {analytics.totalSprayCount}
            </Text>
            <Text className="text-xs text-surface-500">Spray Applications</Text>
          </View>
          <View className="bg-white rounded-2xl p-4" style={{ width: '47%' }}>
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mb-2"
              style={{ backgroundColor: metricColors.harvest.bg }}
            >
              <Ionicons name="basket" size={20} color={metricColors.harvest.icon} />
            </View>
            <Text className="text-2xl font-bold text-surface-900">
              {(analytics.totalHarvestQuantity / 1000).toFixed(1)}t
            </Text>
            <Text className="text-xs text-surface-500">Total Harvest</Text>
          </View>
          <View className="bg-white rounded-2xl p-4" style={{ width: '47%' }}>
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mb-2"
              style={{ backgroundColor: metricColors.cost.bg }}
            >
              <Ionicons name="cash" size={20} color={metricColors.cost.icon} />
            </View>
            <Text className="text-2xl font-bold text-surface-900">
              {currencySymbol}
              {(analytics.totalHarvestValue / 1000).toFixed(0)}k
            </Text>
            <Text className="text-xs text-surface-500">Harvest Value</Text>
          </View>
        </View>

        {/* Performance Score */}
        {performanceMetrics && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-surface-900">
                Performance Score
              </Text>
              <View className="bg-primary-100 px-3 py-1 rounded-full">
                <Text className="text-lg font-bold text-primary-700">
                  {performanceMetrics.overallScore}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {Object.entries(performanceMetrics.categories).map(([key, value]) => (
                <View
                  key={key}
                  className="bg-surface-50 rounded-xl p-3"
                  style={{ width: '47%' }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-surface-500 capitalize">{key}</Text>
                    <Ionicons
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
                  <Text className="text-lg font-bold text-surface-900">{value.score}</Text>
                  <Text className="text-xs text-surface-500" numberOfLines={1}>
                    {value.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cost Analysis */}
        {costAnalysis && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-base font-semibold text-surface-900 mb-3">
              Cost Analysis
            </Text>
            <View className="flex-row mb-3" style={{ gap: 12 }}>
              <View className="flex-1 bg-green-50 rounded-xl p-3">
                <Text className="text-xs text-green-600">Revenue</Text>
                <Text className="text-lg font-bold text-green-700">
                  {currencySymbol}
                  {costAnalysis.totalRevenue.toLocaleString()}
                </Text>
              </View>
              <View className="flex-1 bg-red-50 rounded-xl p-3">
                <Text className="text-xs text-red-600">Expenses</Text>
                <Text className="text-lg font-bold text-red-700">
                  {currencySymbol}
                  {costAnalysis.totalCosts.toLocaleString()}
                </Text>
              </View>
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1 bg-surface-50 rounded-xl p-3">
                <Text className="text-xs text-surface-500">Profit Margin</Text>
                <Text
                  className={`text-lg font-bold ${
                    costAnalysis.profitMargin >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {costAnalysis.profitMargin.toFixed(1)}%
                </Text>
              </View>
              <View className="flex-1 bg-surface-50 rounded-xl p-3">
                <Text className="text-xs text-surface-500">ROI</Text>
                <Text
                  className={`text-lg font-bold ${
                    costAnalysis.roi >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {costAnalysis.roi.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Yield Analysis */}
        {yieldAnalysis && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-base font-semibold text-surface-900 mb-3">
              Yield Analysis
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              <View className="bg-surface-50 rounded-xl p-3" style={{ width: '47%' }}>
                <Text className="text-xs text-surface-500">Total Yield</Text>
                <Text className="text-lg font-bold text-surface-900">
                  {yieldAnalysis.currentYield.toLocaleString()} kg
                </Text>
              </View>
              <View className="bg-surface-50 rounded-xl p-3" style={{ width: '47%' }}>
                <Text className="text-xs text-surface-500">Yield/Acre</Text>
                <Text className="text-lg font-bold text-surface-900">
                  {yieldAnalysis.yieldPerAcre.toFixed(1)} kg
                </Text>
              </View>
              <View className="bg-surface-50 rounded-xl p-3" style={{ width: '47%' }}>
                <Text className="text-xs text-surface-500">Avg Price</Text>
                <Text className="text-lg font-bold text-surface-900">
                  {currencySymbol}
                  {yieldAnalysis.avgPricePerKg.toFixed(2)}/kg
                </Text>
              </View>
              <View className="bg-surface-50 rounded-xl p-3" style={{ width: '47%' }}>
                <Text className="text-xs text-surface-500">Total Area</Text>
                <Text className="text-lg font-bold text-surface-900">
                  {yieldAnalysis.totalArea.toFixed(1)} acres
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Expense Breakdown */}
        {analytics.expensesByType.length > 0 && (
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-base font-semibold text-surface-900 mb-3">
              Expense Breakdown
            </Text>
            {analytics.expensesByType.slice(0, 5).map((expense, index) => (
              <View
                key={expense.type}
                className={`flex-row items-center justify-between py-2 ${
                  index < analytics.expensesByType.length - 1
                    ? 'border-b border-surface-100'
                    : ''
                }`}
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 bg-surface-100 rounded-lg items-center justify-center">
                    <Ionicons name="receipt" size={16} color="#6B7280" />
                  </View>
                  <Text className="text-sm text-surface-700 ml-2 capitalize">
                    {expense.type}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-surface-900">
                  {currencySymbol}
                  {expense.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {performanceMetrics && performanceMetrics.recommendations.length > 0 && (
          <View className="bg-blue-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Ionicons name="bulb" size={20} color="#3B82F6" />
              <Text className="text-base font-semibold text-blue-900 ml-2">
                Recommendations
              </Text>
            </View>
            {performanceMetrics.recommendations.map((rec, index) => (
              <View key={index} className="flex-row items-start mb-2">
                <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                <Text className="text-sm text-blue-800 ml-2 flex-1">{rec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        {analytics.recentActivity.length > 0 && (
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-base font-semibold text-surface-900 mb-3">
              Recent Activity
            </Text>
            {analytics.recentActivity.slice(0, 5).map((activity, index) => {
              const iconInfo = activityIcons[activity.type] || {
                icon: 'ellipse',
                color: '#6B7280',
              };
              return (
                <View
                  key={index}
                  className={`flex-row items-center py-3 ${
                    index < analytics.recentActivity.length - 1
                      ? 'border-b border-surface-100'
                      : ''
                  }`}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${iconInfo.color}15` }}
                  >
                    <Ionicons
                      name={iconInfo.icon as any}
                      size={18}
                      color={iconInfo.color}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-medium text-surface-900">
                      {activity.farmName}
                    </Text>
                    <Text className="text-xs text-surface-500" numberOfLines={1}>
                      {activity.details}
                    </Text>
                  </View>
                  <Text className="text-xs text-surface-400">
                    {new Date(activity.date).toLocaleDateString()}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}
