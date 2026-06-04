import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatNumber } from '@/i18n/format';
import {
  getSectionsForReportType,
  type MetricDelta,
  type ReportComparison,
  type ReportPreview,
  type ReportType,
} from '@/types/report';
import { Symbol as Icon } from '@/components/ui/symbol';

const CARD_MIN_HEIGHT = 92;

/**
 * Small period-over-period chip shown top-right of each tile.
 * Renders nothing for sub-1% / unchanged so we don't show "↑ 0%" noise.
 */
function DeltaChip({ delta, color }: { delta: MetricDelta | undefined; color: string }) {
  if (!delta) return null;

  const rounded = delta.deltaPct == null ? 0 : Math.round(Math.abs(delta.deltaPct));
  if (!delta.isNew && rounded < 1) return null;

  const label = delta.isNew ? 'New' : `${delta.direction > 0 ? '↑' : '↓'} ${rounded}%`;

  return (
    <View
      style={{
        paddingHorizontal: spacing[1] + 2,
        paddingVertical: 1,
        borderRadius: borderRadius.full,
        borderCurve: 'continuous',
        backgroundColor: colorWithOpacity(color, 0.14),
      }}
    >
      <Text
        style={{
          fontSize: fontSize['2xs'],
          fontWeight: fontWeight.semibold,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const ICON_MAP: Record<string, string> = {
  records: 'doc.text.fill',
  water: 'drop.fill',
  harvest: 'basket.fill',
  profit: 'chart.line.uptrend.xyaxis',
  revenue: 'dollarsign.circle.fill',
  expenses: 'creditcard.fill',
  'stock-usage': 'cube.fill',
  'stock-matched': 'checkmark.circle.fill',
  'stock-coverage': 'chart.bar.fill',
};

/**
 * KPI tile palette — drawn from the Cellar Ledger design system so the summary
 * reads as part of VineSight, not a separate dashboard. These map to the same
 * category/semantic tokens used elsewhere in the app.
 */
const CARD_COLORS = {
  /** Muted slate-blue (note category) — neutral "count" feel */
  records: '#5C6D91',
  /** Irrigation blue — water / flow */
  water: '#3F6E78',
  /** Harvest amber — yield */
  harvest: '#A9752F',
  /** Success green — profit ≥ 0 */
  profitPositive: '#4F7A5A',
  /** Error clay-red — profit < 0 */
  profitNegative: '#B84C3A',
  /** Success green — revenue */
  revenue: '#4F7A5A',
  /** Error clay-red — expenses */
  expenses: '#B84C3A',
  /** Secondary terracotta — stock usage */
  stockUsage: '#A56B4F',
  /** Success green — stock matched */
  stockMatched: '#4F7A5A',
  /** Accent gold — coverage */
  stockCoverage: '#D0A14A',
} as const;

interface ReportExecutiveSummaryProps {
  preview: ReportPreview;
  reportType: ReportType;
  preferredCurrency: string;
  /** Period-over-period deltas, keyed by tile key. Omit to hide all chips. */
  comparison?: ReportComparison | null;
}

export function ReportExecutiveSummary({
  preview,
  reportType,
  preferredCurrency,
  comparison,
}: ReportExecutiveSummaryProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const visibleSections = new Set(getSectionsForReportType(reportType));
  const showOperations =
    visibleSections.has('irrigation') ||
    visibleSections.has('spray') ||
    visibleSections.has('fertigation') ||
    visibleSections.has('harvest');
  const showFinancial = visibleSections.has('expense');
  const showStockOnly = visibleSections.has('stock') && !showOperations && !showFinancial;

  const matchedStockRowCount = preview.data.stock.filter(
    (row) => row.matchStrategy !== 'unmatched',
  ).length;
  const estimatedStockCoveragePercent =
    preview.data.stock.length > 0 ? (matchedStockRowCount / preview.data.stock.length) * 100 : 0;

  const summaryTiles = showStockOnly
    ? [
        {
          key: 'records',
          label: t('reports.summary.totalRecords'),
          value: formatNumber(preview.summary.totalRecords),
          color: CARD_COLORS.records,
        },
        {
          key: 'stock-usage',
          label: t('reports.summary.stockUsageCount'),
          value: formatNumber(preview.summary.stockUsageCount),
          color: CARD_COLORS.stockUsage,
        },
        {
          key: 'stock-matched',
          label: t('reports.summary.matchedItems'),
          value: formatNumber(matchedStockRowCount),
          color: CARD_COLORS.stockMatched,
        },
        {
          key: 'stock-coverage',
          label: t('reports.summary.stockCoverage'),
          value: `${formatNumber(estimatedStockCoveragePercent)}%`,
          color: CARD_COLORS.stockCoverage,
        },
      ]
    : showFinancial && !showOperations
      ? [
          {
            key: 'records',
            label: t('reports.summary.totalRecords'),
            value: formatNumber(preview.summary.totalRecords),
            color: CARD_COLORS.records,
          },
          {
            key: 'revenue',
            label: t('reports.formal.revenue'),
            value: formatCurrency(preview.summary.totalRevenue, preferredCurrency),
            color: CARD_COLORS.revenue,
          },
          {
            key: 'expenses',
            label: t('reports.formal.expenses'),
            value: formatCurrency(preview.summary.totalExpenses, preferredCurrency),
            color: CARD_COLORS.expenses,
          },
          {
            key: 'profit',
            label: t('reports.summary.netProfit'),
            value: formatCurrency(preview.summary.netProfit, preferredCurrency),
            color:
              preview.summary.netProfit >= 0
                ? CARD_COLORS.profitPositive
                : CARD_COLORS.profitNegative,
          },
        ]
      : [
          {
            key: 'records',
            label: t('reports.summary.totalRecords'),
            value: formatNumber(preview.summary.totalRecords),
            color: CARD_COLORS.records,
          },
          {
            key: 'water',
            label: t('reports.summary.waterUsage'),
            value: `${formatNumber(preview.summary.totalWaterUsage)}L`,
            color: CARD_COLORS.water,
          },
          {
            key: 'harvest',
            label: t('reports.summary.totalHarvest'),
            value: `${formatNumber(preview.summary.totalHarvest)}kg`,
            color: CARD_COLORS.harvest,
          },
          {
            key: 'profit',
            label: t('reports.summary.netProfit'),
            value: formatCurrency(preview.summary.netProfit, preferredCurrency),
            color:
              preview.summary.netProfit >= 0
                ? CARD_COLORS.profitPositive
                : CARD_COLORS.profitNegative,
          },
        ];

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Section header — iOS small-caps feel */}
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
        {t('reports.formal.executiveTitle')}
      </Text>

      {/* 2×2 KPI grid — every metric visible at a glance, no carousel */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {summaryTiles.map((tile) => (
          <View
            key={tile.key}
            style={{
              flexBasis: '47%',
              flexGrow: 1,
              minHeight: CARD_MIN_HEIGHT,
              borderRadius: borderRadius['2xl'],
              borderCurve: 'continuous',
              backgroundColor: colorWithOpacity(tile.color, 0.1),
              borderWidth: 1,
              borderColor: colorWithOpacity(tile.color, 0.18),
              padding: spacing[3],
              justifyContent: 'space-between',
              gap: spacing[2],
            }}
          >
            {/* Icon + period-over-period delta */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Icon
                name={ICON_MAP[tile.key] ?? 'info.circle.fill'}
                size={18}
                color={tile.color}
                weight="semibold"
              />
              <DeltaChip delta={comparison?.deltas[tile.key]} color={tile.color} />
            </View>

            {/* Value + Label */}
            <View style={{ gap: 1 }}>
              <Text
                selectable
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{
                  color: tile.color,
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                  fontVariant: ['tabular-nums'],
                  lineHeight: 26,
                }}
              >
                {tile.value}
              </Text>
              <Text
                numberOfLines={2}
                selectable
                style={{
                  color: colorWithOpacity(tile.color, 0.75),
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  lineHeight: 14,
                }}
              >
                {tile.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
