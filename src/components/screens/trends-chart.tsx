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
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

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
  const colors = useThemeColors();
  const m3 = useM3();
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
      return {
        data: trendData.map((t) => t.parameters[param.key] || 0),
        color: (opacity: number) => colorWithOpacity(color, opacity),
        labelColor: (opacity: number) => colorWithOpacity(color, opacity),
        strokeWidth: 2,
      };
    });
  }, [params, trendData]);

  const chartConfig = {
    backgroundColor: colors.surface[100],
    backgroundGradientFrom: colors.surface[100],
    backgroundGradientTo: colors.surface[100],
    decimalPlaces: 2,
    color: (opacity: number) => colorWithOpacity(m3.colorScheme.onSurface, opacity),
    labelColor: (opacity: number) => colorWithOpacity(m3.colorScheme.onSurfaceVariant, opacity),
    style: {
      borderRadius: radius.lg,
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
            color: m3.colorScheme.onSurface,
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
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('trends.empty.needMoreDataTitle')}
        </Text>
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
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
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('trends.empty.noParamsTitle')}
        </Text>
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
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
          borderRadius: radius.lg,
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
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            marginBottom: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[2],
            }}
          >
            {formatDate(new Date(selectedPoint.date), { day: '2-digit', month: 'short' })}
          </Text>
          {params.map((param) => {
            const value = trendData[selectedPoint.index].parameters[param.key];
            return (
              <Text
                key={param.key}
                style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}
              >
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
            color: m3.colorScheme.onSurface,
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
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: radius.sm,
                    backgroundColor: color,
                  }}
                />
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {trend.label}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
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
            color: m3.colorScheme.onSurface,
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
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.xl,
                padding: spacing[4],
                marginBottom: spacing[3],
                borderWidth: 1,
                borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.xs,
                    backgroundColor: color,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
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
                        ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                        : trend.change > 0
                          ? colors.success
                          : trend.change < 0
                            ? m3.colorScheme.error
                            : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
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
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {t('common.labels.current')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {trend.values.length > 0 ? (trend.values.at(-1)?.toFixed(2) ?? '-') : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {t('common.labels.avg')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {trend.avg.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
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
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {t('common.labels.max')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.error,
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
