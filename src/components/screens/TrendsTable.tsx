/**
 * Trends Table Component
 * Excel-like table view for test parameters
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { TrendData, ParameterTrend } from '../../types/analytics';

interface Props {
  trendData: TrendData[];
  parameterTrends: Record<string, ParameterTrend>;
  selectedParams: Set<string>;
}

export default function TrendsTable({ trendData, parameterTrends, selectedParams }: Props) {
  if (trendData.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-lg font-semibold text-gray-800">No Data Available</Text>
        <Text className="text-gray-500 text-center mt-2 px-8">Add lab tests to view trends</Text>
      </View>
    );
  }

  if (!parameterTrends || Object.keys(parameterTrends).length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-lg font-semibold text-gray-800">No Parameter Data</Text>
        <Text className="text-gray-500 text-center mt-2 px-8">Unable to load parameter trends</Text>
      </View>
    );
  }

  const sortedParams = Array.from(selectedParams).sort();
  const params = sortedParams
    .map((key) => parameterTrends[key])
    .filter(Boolean) as ParameterTrend[];

  const getValueStyle = (value: number, trend: ParameterTrend) => {
    if (value === trend.min) return styles.minValue;
    if (value === trend.max) return styles.maxValue;
    return null;
  };

  return (
    <ScrollView className="flex-1" nestedScrollEnabled>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nutrientCell]}>Nutrient</Text>
          {trendData.map((item, index) => (
            <Text key={`header-${item.date}-${index}`} style={styles.headerCell}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          ))}
        </View>

        {/* Rows - one per nutrient */}
        {params.map((trend, rowIndex) => (
          <View key={trend.key} style={[styles.row, rowIndex % 2 === 0 && styles.rowEven]}>
            <Text style={[styles.cell, styles.nutrientCell, styles.nutrientLabel]}>
              {trend.label}
            </Text>
            {trendData.map((item, colIndex) => {
              const value = item.parameters[trend.key];
              return (
                <Text
                  key={`${trend.key}-${item.date}-${colIndex}`}
                  style={[styles.cell, value != null && getValueStyle(value, trend)]}
                >
                  {value != null ? value.toFixed(2) : '-'}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
      <View className="h-8" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f7',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  nutrientCell: {
    flex: 1.2,
    textAlign: 'left',
    paddingLeft: 12,
  },
  nutrientLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowEven: {
    backgroundColor: '#fafafa',
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
    textAlign: 'center',
  },
  minValue: {
    color: '#10B981',
    fontWeight: '700',
  },
  maxValue: {
    color: '#EF4444',
    fontWeight: '700',
  },
});
