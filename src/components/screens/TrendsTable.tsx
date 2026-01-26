/**
 * Trends Table Component
 * Excel-like table view for test parameters
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { TrendData, ParameterTrend } from '../../types/analytics';

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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

  return (
    <ScrollView className="flex-1" nestedScrollEnabled>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nutrientCell]}>Nutrient</Text>
          {trendData.map((item, index) => {
            const date = new Date(item.date);
            return (
              <View key={`header-${item.date}-${index}`} style={styles.headerDateContainer}>
                <Text style={styles.headerDateMonth}>{monthNames[date.getMonth()]}</Text>
                <Text style={styles.headerDateDay}>{date.getDate()}</Text>
                <Text style={styles.headerDateYear}>{date.getFullYear()}</Text>
              </View>
            );
          })}
        </View>

        {/* Rows - one per nutrient */}
        {params.map((trend, rowIndex) => (
          <View key={trend.key} style={[styles.row, rowIndex % 2 === 0 && styles.rowEven]}>
            <Text style={[styles.cell, styles.nutrientCell, styles.nutrientLabel]}>
              {trend.label}
            </Text>
            {trendData.map((item, colIndex) => {
              const value = item.parameters[trend.key];
              const prevValue = colIndex > 0 ? trendData[colIndex - 1].parameters[trend.key] : null;
              const changeIndicator =
                value != null && prevValue != null ? (
                  value > prevValue ? (
                    <Text style={styles.increase}> ↑</Text>
                  ) : value < prevValue ? (
                    <Text style={styles.decrease}> ↓</Text>
                  ) : null
                ) : null;
              return (
                <Text key={`${trend.key}-${item.date}-${colIndex}`} style={styles.cell}>
                  {value != null ? value.toFixed(2) : '-'}
                  {changeIndicator}
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

const styles = {
  container: {
    backgroundColor: 'white' as const,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  headerRow: {
    flexDirection: 'row' as const,
    backgroundColor: '#f2f2f7' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb' as const,
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#374151' as const,
    textAlign: 'center' as const,
  },
  nutrientCell: {
    flex: 1.2,
    textAlign: 'left' as const,
    paddingLeft: 12,
  },
  nutrientLabel: {
    fontWeight: '600' as const,
    color: '#374151' as const,
  },
  row: {
    flexDirection: 'row' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6' as const,
  },
  rowEven: {
    backgroundColor: '#fafafa' as const,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937' as const,
    textAlign: 'center' as const,
  },
  increase: {
    color: '#10B981' as const,
    fontSize: 10,
  },
  decrease: {
    color: '#EF4444' as const,
    fontSize: 10,
  },
  headerDateContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 4,
  },
  headerDateMonth: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#374151' as const,
  },
  headerDateDay: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#374151' as const,
  },
  headerDateYear: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: '#6B7280' as const,
  },
};
