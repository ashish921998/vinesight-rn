import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { formatCurrency, formatNumber } from '@/i18n/format';
import type { MetricDelta, ReportComparison, ReportSummary } from '@/types/report';

/**
 * Row spec for the comparison table — the same seven metrics the delta chips
 * cover (COMPARISON_METRIC_FIELDS in services/report-comparison.ts), with the
 * executive summary's formatting per metric.
 */
const COMPARISON_ROWS: {
  key: string;
  labelKey: string;
  format: (summary: ReportSummary, currency: string) => string;
}[] = [
  {
    key: 'records',
    labelKey: 'reports.summary.totalRecords',
    format: (s) => formatNumber(s.totalRecords),
  },
  {
    key: 'water',
    labelKey: 'reports.summary.waterUsage',
    format: (s) => `${formatNumber(s.totalWaterUsage)}L`,
  },
  {
    key: 'harvest',
    labelKey: 'reports.summary.totalHarvest',
    format: (s) => `${formatNumber(s.totalHarvest)}kg`,
  },
  {
    key: 'revenue',
    labelKey: 'reports.formal.revenue',
    format: (s, currency) => formatCurrency(s.totalRevenue, currency),
  },
  {
    key: 'expenses',
    labelKey: 'reports.formal.expenses',
    format: (s, currency) => formatCurrency(s.totalExpenses, currency),
  },
  {
    key: 'profit',
    labelKey: 'reports.summary.netProfit',
    format: (s, currency) => formatCurrency(s.netProfit, currency),
  },
  {
    key: 'stock-usage',
    labelKey: 'reports.summary.stockUsageCount',
    format: (s) => formatNumber(s.stockUsageCount),
  },
];

function formatDelta(delta: MetricDelta | undefined): string {
  if (!delta) return '—';
  if (delta.isNew) return 'New';
  if (delta.deltaPct == null) return '—';
  const rounded = Math.round(Math.abs(delta.deltaPct));
  if (rounded < 1) return '—';
  return `${delta.direction > 0 ? '↑' : '↓'} ${rounded}%`;
}

interface ReportSeasonComparisonSectionProps {
  comparison: ReportComparison;
  preferredCurrency: string;
  panelStyle: object;
}

/**
 * Side-by-side season comparison: metric · current · baseline · Δ%. The delta
 * chips answer "up or down"; this section carries the actual numbers, over the
 * same clamped windows the deltas were computed from (comparison.currentSummary,
 * NOT the full preview). The elapsed-days footnote is the honesty guarantee —
 * without it a partial season reads as a collapse.
 */
export function ReportSeasonComparisonSection({
  comparison,
  preferredCurrency,
  panelStyle,
}: ReportSeasonComparisonSectionProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const columnHeaderStyle = {
    flex: 1.2,
    textAlign: 'right' as const,
    fontSize: fontSize['2xs'],
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurfaceVariant,
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Text
        selectable
        style={{
          color: m3.colorScheme.onSurfaceVariant,
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.xs,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {t('reports.comparison.title')}
      </Text>

      <View style={[panelStyle, { gap: spacing[2] }]}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] }}>
          <View style={{ flex: 1.6 }} />
          <Text numberOfLines={2} style={columnHeaderStyle}>
            {comparison.currentLabel}
          </Text>
          <Text numberOfLines={2} style={columnHeaderStyle}>
            {comparison.baselineLabel}
          </Text>
          <Text style={[columnHeaderStyle, { flex: 0.6 }]}>Δ</Text>
        </View>

        {COMPARISON_ROWS.map((row) => (
          <View
            key={row.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingTop: spacing[2],
              borderTopWidth: 1,
              borderTopColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1.6,
                fontSize: fontSize.xs,
                color: m3.colorScheme.onSurfaceVariant,
                fontWeight: fontWeight.medium,
              }}
            >
              {t(row.labelKey)}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              style={{
                flex: 1.2,
                textAlign: 'right',
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurface,
                fontWeight: fontWeight.semibold,
                fontVariant: ['tabular-nums'],
              }}
            >
              {row.format(comparison.currentSummary, preferredCurrency)}
            </Text>
            <Text
              selectable
              numberOfLines={1}
              style={{
                flex: 1.2,
                textAlign: 'right',
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                fontVariant: ['tabular-nums'],
              }}
            >
              {row.format(comparison.baselineSummary, preferredCurrency)}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 0.6,
                textAlign: 'right',
                fontSize: fontSize.xs,
                color: m3.colorScheme.onSurface,
                fontWeight: fontWeight.semibold,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatDelta(comparison.deltas[row.key])}
            </Text>
          </View>
        ))}

        {comparison.elapsedDays != null ? (
          <Text
            selectable
            style={{
              fontSize: fontSize['2xs'],
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[1],
            }}
          >
            {t('reports.comparison.footnote', { count: comparison.elapsedDays })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
