/**
 * Trends Chart Component
 * Line chart visualization for test parameters
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { TrendData, ParameterTrend } from '../../types/analytics';
import { PARAMETER_COLORS } from '../../hooks/use-lab-tests';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

import { formatDate } from '@/i18n/format';

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
  const { t, i18n } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [selectedPoint, setSelectedPoint] = useState<{ index: number; date: string } | null>(null);

  const labels = useMemo(() => {
    return trendData.map((trend) => {
      const date = new Date(trend.date);
      return formatDate(date, { day: '2-digit', month: 'short' });
    });
  }, [trendData, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

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
    backgroundColor: colors.white,
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing[16],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
          }}
        >
          {t('trends.empty.noDataTitle')}
        </Text>
      </View>
    );
  }

  if (trendData.length < 2) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing[16],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
          }}
        >
          {t('trends.empty.needMoreDataTitle')}
        </Text>
        <Text
          style={{
            color: colors.gray[500],
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
        >
          {t('trends.empty.needMoreDataBody')}
        </Text>
      </View>
    );
  }

  if (selectedParams.size === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing[16],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
          }}
        >
          {t('trends.empty.noParamsTitle')}
        </Text>
        <Text
          style={{
            color: colors.gray[500],
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
        >
          {t('trends.empty.noParamsBody')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: spacing[4],
        paddingHorizontal: spacing[4],
        paddingBottom: spacing[4],
      }}
    >
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
          if (
            data &&
            typeof data.index === 'number' &&
            data.index >= 0 &&
            data.index < trendData.length
          ) {
            setSelectedPoint({ index: data.index, date: trendData[data.index].date });
          }
        }}
      />

      {/* Selected Point Info */}
      {selectedPoint && (
        <View
          style={{
            backgroundColor: colors.primary[50],
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            marginBottom: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.primary[900],
              marginBottom: spacing[2],
            }}
          >
            {formatDate(new Date(selectedPoint.date), { day: '2-digit', month: 'short' })}
          </Text>
          {params.map((param) => {
            const value = trendData[selectedPoint.index].parameters[param.key];
            return (
              <Text key={param.key} style={{ fontSize: fontSize.sm, color: colors.primary[800] }}>
                {param.trend.label}:{' '}
                {value != null && typeof value === 'number' ? value.toFixed(2) : '-'}{' '}
                {param.trend.unit}
              </Text>
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View style={{ marginBottom: spacing[4] }}>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
            marginBottom: spacing[3],
          }}
        >
          {t('trends.legend.title')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {params.map((param, idx) => {
            const color = PARAMETER_COLORS[idx % PARAMETER_COLORS.length];
            const trend = param.trend;
            return (
              <Pressable
                key={param.key}
                onPress={() => onToggleParam(param.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: color,
                  }}
                />
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: colors.gray[800],
                    }}
                  >
                    {trend.label}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                    {trend.change !== null
                      ? `${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`
                      : t('common.na')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Stats Summary */}
      <View style={{ marginBottom: spacing[8] }}>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
            marginBottom: spacing[3],
          }}
        >
          {t('trends.summary.title')}
        </Text>
        {params.map((param, idx) => {
          const color = PARAMETER_COLORS[idx % PARAMETER_COLORS.length];
          const trend = param.trend;
          return (
            <View
              key={param.key}
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing[4],
                marginBottom: spacing[3],
                borderWidth: 1,
                borderColor: colors.gray[100],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: colors.gray[800],
                  }}
                >
                  {trend.label}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color:
                      trend.change === null
                        ? colors.gray[400]
                        : trend.change > 0
                          ? colors.success
                          : trend.change < 0
                            ? colors.error
                            : colors.gray[400],
                  }}
                >
                  {trend.change === null
                    ? t('common.na')
                    : trend.change > 0
                      ? `↑ ${Math.abs(trend.change).toFixed(1)}%`
                      : trend.change < 0
                        ? `↓ ${Math.abs(trend.change).toFixed(1)}%`
                        : `— ${Math.abs(trend.change).toFixed(1)}%`}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing[3],
                }}
              >
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                    {t('common.labels.current')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.gray[800],
                    }}
                  >
                    {trend.values.length > 0 ? (trend.values.at(-1)?.toFixed(2) ?? '-') : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                    {t('common.labels.avg')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.gray[800],
                    }}
                  >
                    {trend.avg.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                    {t('common.labels.min')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.success,
                    }}
                  >
                    {trend.min.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
                    {t('common.labels.max')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.error,
                    }}
                  >
                    {trend.max.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
