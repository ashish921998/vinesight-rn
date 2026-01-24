/**
 * Trends Chart Component
 * Line chart visualization for test parameters
 */

import React, { useState, useMemo } from 'react';
import { View, Text, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { TrendData, ParameterTrend } from '../../types/analytics';
import { PARAMETER_COLORS } from '../../hooks/useLabTests';

const screenWidth = Dimensions.get('window').width;

interface Props {
  trendData: TrendData[];
  parameterTrends: Record<string, ParameterTrend>;
  selectedParams: Set<string>;
  onToggleParam: (key: string) => void;
}

export default function TrendsChart({
  trendData,
  parameterTrends,
  selectedParams,
  onToggleParam,
}: Props) {
  const [selectedPoint, setSelectedPoint] = useState<{ index: number; date: string } | null>(null);

  const labels = useMemo(() => {
    return trendData.map((t) => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
  }, [trendData]);

  const sortedParams = Array.from(selectedParams).sort();
  const params = sortedParams
    .map((key) => ({ key, trend: parameterTrends?.[key] }))
    .filter((item): item is { key: string; trend: ParameterTrend } => !!item?.trend);

  const datasets = useMemo(() => {
    return params.map((param, idx) => {
      const color = PARAMETER_COLORS[idx % PARAMETER_COLORS.length];
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      return {
        data: trendData.map((t) => t.parameters[param.key] || 0),
        color: (opacity: number) => hexToRgba(color, opacity),
        labelColor: (opacity: number) => hexToRgba(color, opacity),
        strokeWidth: 2,
      };
    });
  }, [params, trendData]);

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2,
    color: (opacity: number) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity: number) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
    },
  };

  if (!parameterTrends || Object.keys(parameterTrends).length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-lg font-semibold text-gray-800">No Data Available</Text>
      </View>
    );
  }

  if (trendData.length < 2) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-lg font-semibold text-gray-800">Need More Data</Text>
        <Text className="text-gray-500 text-center mt-2 px-8">
          Add at least 2 lab tests to view chart
        </Text>
      </View>
    );
  }

  if (selectedParams.size === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-lg font-semibold text-gray-800">No Parameters Selected</Text>
        <Text className="text-gray-500 text-center mt-2 px-8">
          Select at least one parameter to view chart
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        <LineChart
          data={{
            labels,
            datasets,
          }}
          width={screenWidth - 32}
          height={300}
          chartConfig={chartConfig}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
          onDataPointClick={(data) => {
            setSelectedPoint({ index: data.index, date: trendData[data.index].date });
          }}
        />

        {/* Selected Point Info */}
        {selectedPoint && (
          <View className="bg-blue-50 p-4 rounded-xl mb-4">
            <Text className="text-sm font-semibold text-blue-900 mb-2">
              {new Date(selectedPoint.date).toLocaleDateString()}
            </Text>
            {params.map((param) => {
              const value = trendData[selectedPoint.index].parameters[param.key];
              return (
                <Text key={param.key} className="text-sm text-blue-800">
                  {param.trend.label}:{' '}
                  {value != null && typeof value === 'number' ? value.toFixed(2) : '-'}{' '}
                  {param.trend.unit}
                </Text>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-800 mb-3">Legend</Text>
          <View className="flex-row flex-wrap gap-2">
            {params.map((param, idx) => {
              const color = PARAMETER_COLORS[idx % PARAMETER_COLORS.length];
              const trend = param.trend;
              return (
                <TouchableOpacity
                  key={param.key}
                  onPress={() => onToggleParam(param.key)}
                  className="flex-row items-center px-3 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: color,
                    }}
                  />
                  <View className="ml-2">
                    <Text className="text-xs font-semibold text-gray-800">{trend.label}</Text>
                    <Text className="text-xs text-gray-500">
                      {trend.change !== null
                        ? `${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`
                        : 'N/A'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stats Summary */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-gray-800 mb-3">Summary</Text>
          {params.map((param, idx) => {
            const color = PARAMETER_COLORS[idx % PARAMETER_COLORS.length];
            const trend = param.trend;
            return (
              <View key={param.key} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                  <Text className="flex-1 ml-2 text-sm font-semibold text-gray-800">
                    {trend.label}
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${
                      trend.change === null
                        ? 'text-gray-400'
                        : trend.change > 0
                          ? 'text-green-600'
                          : trend.change < 0
                            ? 'text-red-600'
                            : 'text-gray-400'
                    }`}
                  >
                    {trend.change === null
                      ? 'N/A'
                      : trend.change > 0
                        ? `↑ ${Math.abs(trend.change).toFixed(1)}%`
                        : trend.change < 0
                          ? `↓ ${Math.abs(trend.change).toFixed(1)}%`
                          : `— ${Math.abs(trend.change).toFixed(1)}%`}
                  </Text>
                </View>
                <View className="flex-row justify-between mt-3">
                  <View>
                    <Text className="text-xs text-gray-500">Current</Text>
                    <Text className="text-sm font-semibold text-gray-800">
                      {trend.values.length > 0 ? (trend.values.at(-1)?.toFixed(2) ?? '-') : '-'}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500">Avg</Text>
                    <Text className="text-sm font-semibold text-gray-800">
                      {trend.avg.toFixed(2)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500">Min</Text>
                    <Text className="text-sm font-semibold text-green-600">
                      {trend.min.toFixed(2)}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500">Max</Text>
                    <Text className="text-sm font-semibold text-red-600">
                      {trend.max.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
