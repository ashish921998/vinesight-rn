import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius, radius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import {
  PETIOLE_PARAM_GROUPS,
  getPetioleRangeDef,
  getParamStatus,
  type ParamStatus,
  normalizeConsultantPetioleKey,
} from '@/constants/consultant-lab-config';

export interface ComparisonTest {
  id?: number;
  date: string;
  date_of_pruning?: string | null;
  parameters: Record<string, number | null>;
}

interface PetioleComparisonProps {
  tests: ComparisonTest[];
  highlightedTestId?: number;
  selectedParams?: Set<string>;
  showTrendIndicators?: boolean;
  showPruningInfo?: boolean;
  showLegend?: boolean;
}

interface Column {
  id: number;
  date: string;
  dateOfPruning: string | null;
  params: Record<string, number | null>;
  isHighlighted: boolean;
}

export function PetioleComparison({
  tests,
  highlightedTestId,
  selectedParams,
  showTrendIndicators = false,
  showPruningInfo = false,
  showLegend = false,
}: PetioleComparisonProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const columns = useMemo<Column[]>(() => {
    const sorted = [...tests].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return sorted.map((test, index) => ({
      id: test.id ?? index,
      date: test.date,
      dateOfPruning: test.date_of_pruning ?? null,
      params: normalizeParams(test.parameters),
      isHighlighted:
        highlightedTestId !== undefined && highlightedTestId !== null
          ? (test.id ?? index) === highlightedTestId
          : false,
    }));
  }, [tests, highlightedTestId]);

  const normalizedSelected = useMemo(() => {
    if (!selectedParams) return null;
    const set = new Set<string>();
    selectedParams.forEach((key) => set.add(normalizeConsultantPetioleKey(key)));
    return set;
  }, [selectedParams]);

  if (columns.length === 0) {
    return (
      <View
        style={{
          padding: spacing[4],
          borderRadius: borderRadius.lg,
          backgroundColor: m3.colorScheme.surface,
        }}
      >
        <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
          {t('labTests.list.comparison.noPetioleTests')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row with dates */}
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: 120,
                padding: spacing[2],
                justifyContent: 'flex-end',
                borderBottomWidth: 1,
                borderBottomColor: m3.colorScheme.outlineVariant,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                {t('labTests.list.comparison.parameter')}
              </Text>
            </View>
            {columns.map((column) => (
              <View
                key={column.id}
                style={{
                  width: showPruningInfo ? 110 : 90,
                  padding: spacing[2],
                  alignItems: 'center',
                  backgroundColor: column.isHighlighted
                    ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                    : undefined,
                  borderBottomWidth: 1,
                  borderBottomColor: m3.colorScheme.outlineVariant,
                }}
              >
                {showPruningInfo && (
                  <View style={{ alignItems: 'center', marginBottom: 4 }}>
                    <Text
                      style={{
                        fontSize: fontSize['2xs'],
                        fontWeight: fontWeight.semibold,
                        color: m3.colorScheme.onSurfaceVariant,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('trends.table.daysAfterPruningShort')}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.bold,
                        color: m3.colorScheme.onSurface,
                      }}
                    >
                      {getDaysAfterPruning(column.date, column.dateOfPruning)}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: column.isHighlighted ? fontWeight.semibold : fontWeight.normal,
                    color: column.isHighlighted ? m3.colorScheme.primary : m3.colorScheme.onSurface,
                  }}
                >
                  {formatDate(column.date, { month: 'short', day: 'numeric' })}
                </Text>
                {column.isHighlighted && (
                  <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.primary }}>
                    {t('labTests.list.comparison.current')}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Parameter rows */}
          {PETIOLE_PARAM_GROUPS.map((group) => {
            const visibleParams = normalizedSelected
              ? group.params.filter((p) => normalizedSelected.has(p))
              : group.params;

            if (visibleParams.length === 0) return null;

            return (
              <View key={group.title}>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    backgroundColor: colorWithOpacity(m3.colorScheme.surfaceVariant, 0.5),
                    borderBottomWidth: 1,
                    borderBottomColor: m3.colorScheme.outlineVariant,
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {group.title}
                  </Text>
                </View>
                {visibleParams.map((paramKey) => {
                  const range = getPetioleRangeDef(paramKey);
                  return (
                    <View key={paramKey} style={{ flexDirection: 'row' }}>
                      <View
                        style={{
                          width: 120,
                          padding: spacing[2],
                          justifyContent: 'center',
                          borderBottomWidth: 1,
                          borderBottomColor: m3.colorScheme.outlineVariant,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                          {range?.label ?? paramKey}
                        </Text>
                        {range?.unit ? (
                          <Text
                            style={{
                              fontSize: fontSize['2xs'],
                              color: m3.colorScheme.onSurfaceVariant,
                            }}
                          >
                            {range.unit}
                          </Text>
                        ) : null}
                      </View>
                      {columns.map((column, colIndex) => {
                        const value = column.params[paramKey];
                        const status = range ? getParamStatus(value ?? null, range) : 'ok';
                        const trendIndicator = showTrendIndicators
                          ? getTrendIndicator(
                              value,
                              colIndex > 0 ? columns[colIndex - 1].params[paramKey] : null,
                              m3,
                            )
                          : null;
                        return (
                          <View
                            key={column.id}
                            style={{
                              width: showPruningInfo ? 110 : 90,
                              padding: spacing[2],
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: column.isHighlighted
                                ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                                : undefined,
                              borderBottomWidth: 1,
                              borderBottomColor: m3.colorScheme.outlineVariant,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.sm,
                                fontWeight: fontWeight.medium,
                                color: statusColor(status, m3.colorScheme),
                              }}
                            >
                              {value !== null && value !== undefined
                                ? formatValue(value)
                                : '\u2014'}
                            </Text>
                            {trendIndicator}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {showLegend && <ColorLegend m3={m3} t={t} showTrends={showTrendIndicators} />}
    </View>
  );
}

function ColorLegend({
  m3,
  t,
  showTrends,
}: {
  m3: ReturnType<typeof useM3>;
  t: ReturnType<typeof useTranslation>['t'];
  showTrends: boolean;
}) {
  return (
    <View
      style={{
        marginVertical: spacing[3],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        borderRadius: borderRadius.sm,
        backgroundColor: m3.surface.s100,
        borderWidth: 1,
        borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: fontSize['2xs'],
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onSurface,
        }}
      >
        {t('trends.table.colorGuide')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: radius.xs,
              backgroundColor: colorWithOpacity(m3.colorScheme.success, 0.12),
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.success, 0.4),
            }}
          />
          <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.onSurface }}>
            {t('trends.table.optimal')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: radius.xs,
              backgroundColor: colorWithOpacity(m3.colorScheme.warning, 0.12),
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.warning, 0.4),
            }}
          />
          <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.onSurface }}>
            {t('trends.table.warning')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: radius.xs,
              backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.error, 0.4),
            }}
          />
          <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.onSurface }}>
            {t('trends.table.critical')}
          </Text>
        </View>
      </View>
      {showTrends && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Text
            style={{
              fontSize: fontSize['2xs'],
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('trends.table.trend')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.success }}>
              {' \u2191 '}
              <Text style={{ color: m3.colorScheme.onSurface }}>{t('trends.table.increase')}</Text>
            </Text>
            <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.error }}>
              {' \u2193 '}
              <Text style={{ color: m3.colorScheme.onSurface }}>{t('trends.table.decrease')}</Text>
            </Text>
            <Text style={{ fontSize: fontSize['2xs'], color: m3.colorScheme.onSurfaceVariant }}>
              {' \u25CF '}
              <Text style={{ color: m3.colorScheme.onSurface }}>{t('trends.table.stable')}</Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function normalizeParams(parameters: Record<string, number | null>): Record<string, number | null> {
  const normalized: Record<string, number | null> = {};
  Object.entries(parameters).forEach(([key, value]) => {
    normalized[normalizeConsultantPetioleKey(key)] = value;
  });
  return normalized;
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function statusColor(status: ParamStatus, scheme: Record<string, string>): string {
  switch (status) {
    case 'bad':
      return scheme.error;
    case 'warn':
      return scheme.warning;
    case 'ok':
    default:
      return scheme.success;
  }
}

function getDaysAfterPruning(testDate: string, pruningDate: string | null): string {
  if (!pruningDate) return '\u2014';
  const test = new Date(testDate);
  const pruning = new Date(pruningDate);
  if (Number.isNaN(test.getTime()) || Number.isNaN(pruning.getTime())) return '\u2014';
  const testDay = Date.UTC(test.getFullYear(), test.getMonth(), test.getDate());
  const pruningDay = Date.UTC(pruning.getFullYear(), pruning.getMonth(), pruning.getDate());
  const days = Math.floor((testDay - pruningDay) / (24 * 60 * 60 * 1000));
  return days >= 0 ? String(days) : '\u2014';
}

function getTrendIndicator(
  current: number | null | undefined,
  previous: number | null | undefined,
  m3: ReturnType<typeof useM3>,
): React.ReactNode {
  if (current == null || previous == null) return null;
  if (previous === 0) {
    if (current === 0) return <Text style={trendStyle(m3, 'stable')}>{' \u25CF'}</Text>;
    return current > 0 ? (
      <Text style={trendStyle(m3, 'up')}>{' \u2191'}</Text>
    ) : (
      <Text style={trendStyle(m3, 'down')}>{' \u2193'}</Text>
    );
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 5) return <Text style={trendStyle(m3, 'stable')}>{' \u25CF'}</Text>;
  if (change > 0) return <Text style={trendStyle(m3, 'up')}>{' \u2191'}</Text>;
  return <Text style={trendStyle(m3, 'down')}>{' \u2193'}</Text>;
}

function trendStyle(m3: ReturnType<typeof useM3>, direction: 'up' | 'down' | 'stable') {
  const color =
    direction === 'up'
      ? m3.colorScheme.success
      : direction === 'down'
        ? m3.colorScheme.error
        : m3.colorScheme.onSurfaceVariant;
  return { fontSize: fontSize['2xs'], color };
}
