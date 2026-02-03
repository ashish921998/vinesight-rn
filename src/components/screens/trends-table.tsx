/**
 * Trends Table Component
 * Excel-like table view for test parameters
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrendData, ParameterTrend } from '../../types/analytics';
import { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../../hooks/use-lab-tests';
import { spacing, fontSize, fontWeight } from '@/styles/theme';

import { formatDate } from '@/i18n/format';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface Props {
  trendData: TrendData[];
  parameterTrends: Record<string, ParameterTrend>;
  selectedParams: Set<string>;
  testType: 'soil' | 'petiole';
}

export default function TrendsTable({
  trendData,
  parameterTrends,
  selectedParams,
  testType,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(
    () => ({
      container: {
        backgroundColor: colors.surface[100],
        margin: 16,
        borderRadius: 12,
        overflow: 'hidden' as const,
      },
      headerRow: {
        flexDirection: 'row' as const,
        backgroundColor: colors.surface[50],
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface[200],
      },
      headerCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700' as const,
        color: colors.gray[700],
        textAlign: 'center' as const,
      },
      nutrientCell: {
        flex: 1.2,
        paddingLeft: 12,
      },
      nutrientLabelContainer: {
        flexDirection: 'column' as const,
        gap: 2,
      },
      nutrientLabel: {
        fontWeight: '600' as const,
        color: colors.gray[700],
        fontSize: 13,
      },
      nutrientRange: {
        fontSize: 10,
        color: colors.gray[500],
        fontWeight: '400' as const,
      },
      row: {
        flexDirection: 'row' as const,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface[200],
      },
      rowEven: {
        backgroundColor: colors.surface[50],
      },
      cell: {
        flex: 1,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: colors.surface[200],
      },
      increase: {
        color: colors.success,
        fontSize: 10,
      },
      decrease: {
        color: colors.error,
        fontSize: 10,
      },
      stable: {
        color: colors.gray[500],
        fontSize: 10,
      },
      cellGray: {
        backgroundColor: colors.surface[200],
      },
      cellOptimal: {
        backgroundColor: colorWithOpacity(colors.success, 0.15),
      },
      cellWarning: {
        backgroundColor: colorWithOpacity(colors.warning, 0.15),
      },
      cellCritical: {
        backgroundColor: colorWithOpacity(colors.error, 0.12),
      },
      cellText: {
        fontSize: 13,
        textAlign: 'center' as const,
        color: colors.gray[700],
      },
      legendContainer: {
        backgroundColor: colors.surface[100],
        margin: 16,
        marginTop: 0,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.surface[200],
      },
      legendContent: {
        gap: 6,
      },
      legendTitle: {
        fontSize: 10,
        fontWeight: '600' as const,
        color: colors.gray[700],
      },
      colorGuideRow: {
        flexDirection: 'row' as const,
        gap: 12,
        flexWrap: 'wrap' as const,
      },
      legendItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
      },
      colorBox: {
        width: 12,
        height: 12,
        borderRadius: 2,
        borderWidth: 1,
      },
      colorBoxOptimal: {
        backgroundColor: colorWithOpacity(colors.success, 0.2),
        borderColor: colorWithOpacity(colors.success, 0.5),
      },
      colorBoxWarning: {
        backgroundColor: colorWithOpacity(colors.warning, 0.2),
        borderColor: colorWithOpacity(colors.warning, 0.5),
      },
      colorBoxCritical: {
        backgroundColor: colorWithOpacity(colors.error, 0.2),
        borderColor: colorWithOpacity(colors.error, 0.5),
      },
      legendText: {
        fontSize: 10,
        color: colors.gray[700],
      },
      trendGuide: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
      },
      trendItems: {
        flexDirection: 'row' as const,
        gap: 8,
        flexWrap: 'wrap' as const,
      },
      trendItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
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
        color: colors.gray[700],
      },
      headerDateDay: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: colors.gray[700],
      },
      headerDateYear: {
        fontSize: 10,
        fontWeight: '500' as const,
        color: colors.gray[500],
      },
    }),
    [colors],
  );
  if (trendData.length === 0) {
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
          {t('trends.table.empty.noDataTitle')}
        </Text>
        <Text
          style={{
            color: colors.gray[500],
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
        >
          {t('trends.table.empty.noDataBody')}
        </Text>
      </View>
    );
  }

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
          {t('trends.table.empty.noParamsTitle')}
        </Text>
        <Text
          style={{
            color: colors.gray[500],
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
        >
          {t('trends.table.empty.noParamsBody')}
        </Text>
      </View>
    );
  }

  const paramOrder = testType === 'soil' ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const sortedParams = Array.from(selectedParams).sort((a, b) => {
    const indexA = paramOrder.findIndex((p) => p.key === a);
    const indexB = paramOrder.findIndex((p) => p.key === b);
    const adjustedIndexA = indexA === -1 ? paramOrder.length : indexA;
    const adjustedIndexB = indexB === -1 ? paramOrder.length : indexB;
    return adjustedIndexA - adjustedIndexB;
  });
  const params = sortedParams
    .map((key) => parameterTrends[key])
    .filter(Boolean) as ParameterTrend[];

  const getCellColor = (value: number | null, param: ParameterTrend) => {
    if (value == null) return styles.cellGray;

    const { optimalMin, optimalMax } = param;
    const warningThreshold = 0.2;

    if (value >= optimalMin && value <= optimalMax) {
      return styles.cellOptimal;
    }

    const lowerWarning = optimalMin * (1 - warningThreshold);
    const upperWarning = optimalMax * (1 + warningThreshold);

    if (value >= lowerWarning && value <= upperWarning) {
      return styles.cellWarning;
    }

    return styles.cellCritical;
  };

  const getTrendIndicator = (currentValue: number | null, previousValue: number | null) => {
    if (currentValue == null || previousValue == null) return null;

    if (previousValue === 0) {
      if (currentValue === 0) {
        return <Text style={styles.stable}> ●</Text>;
      }
      if (currentValue > 0) {
        return <Text style={styles.increase}> ↑</Text>;
      }
      return <Text style={styles.decrease}> ↓</Text>;
    }

    const change = ((currentValue - previousValue) / previousValue) * 100;

    if (Math.abs(change) < 5) {
      return <Text style={styles.stable}> ●</Text>;
    }

    if (change > 0) {
      return <Text style={styles.increase}> ↑</Text>;
    }

    return <Text style={styles.decrease}> ↓</Text>;
  };

  return (
    <ScrollView style={{ flex: 1 }} nestedScrollEnabled>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nutrientCell]}>{t('trends.table.nutrient')}</Text>
          {trendData.map((item, index) => {
            const date = new Date(item.date);
            return (
              <View key={`header-${item.date}-${index}`} style={styles.headerDateContainer}>
                <Text style={styles.headerDateMonth}>{formatDate(date, { month: 'short' })}</Text>
                <Text style={styles.headerDateDay}>{formatDate(date, { day: '2-digit' })}</Text>
                <Text style={styles.headerDateYear}>{formatDate(date, { year: 'numeric' })}</Text>
              </View>
            );
          })}
        </View>

        {/* Rows - one per nutrient */}
        {params.map((trend, rowIndex) => (
          <View key={trend.key} style={[styles.row, rowIndex % 2 === 0 && styles.rowEven]}>
            <View style={[styles.cell, styles.nutrientCell, styles.nutrientLabelContainer]}>
              <Text style={styles.nutrientLabel}>{trend.shortLabel}</Text>
              <Text style={styles.nutrientRange}>
                {trend.optimalMin}-{trend.optimalMax}
                {trend.unit ? ` ${trend.unit}` : ''}
              </Text>
            </View>
            {trendData.map((item, colIndex) => {
              const value = item.parameters[trend.key] as number | null | undefined;
              const prevValue =
                colIndex > 0
                  ? (trendData[colIndex - 1].parameters[trend.key] as number | null | undefined)
                  : null;
              const changeIndicator = getTrendIndicator(value ?? null, prevValue ?? null);
              const cellStyle = getCellColor(value ?? null, trend);
              return (
                <View
                  key={`${trend.key}-${item.date}-${colIndex}`}
                  style={[styles.cell, cellStyle]}
                >
                  <Text style={styles.cellText}>
                    {value != null ? value.toFixed(2) : '-'}
                    {changeIndicator}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Color Guide Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendContent}>
          <Text style={styles.legendTitle}>{t('trends.table.colorGuide')}</Text>
          <View style={styles.colorGuideRow}>
            <View style={styles.legendItem}>
              <View style={[styles.colorBox, styles.colorBoxOptimal]} />
              <Text style={styles.legendText}>{t('trends.table.optimal')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.colorBox, styles.colorBoxWarning]} />
              <Text style={styles.legendText}>{t('trends.table.warning')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.colorBox, styles.colorBoxCritical]} />
              <Text style={styles.legendText}>{t('trends.table.critical')}</Text>
            </View>
          </View>
          <View style={styles.trendGuide}>
            <Text style={styles.legendTitle}>{t('trends.table.trend')}</Text>
            <View style={styles.trendItems}>
              <View style={styles.trendItem}>
                <Text style={styles.increase}> ↑</Text>
                <Text style={styles.legendText}>{t('trends.table.increase')}</Text>
              </View>
              <View style={styles.trendItem}>
                <Text style={styles.decrease}> ↓</Text>
                <Text style={styles.legendText}>{t('trends.table.decrease')}</Text>
              </View>
              <View style={styles.trendItem}>
                <Text style={styles.stable}> ●</Text>
                <Text style={styles.legendText}>{t('trends.table.stable')}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: spacing[8] }} />
    </ScrollView>
  );
}
