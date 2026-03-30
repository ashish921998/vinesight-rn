import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { getSectionsForReportType, type ReportPreview, type ReportType } from '@/types/report';
import { Symbol as Icon } from '@/components/ui/symbol';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.42;
const CARD_GAP = spacing[2];
const CARD_HEIGHT = 88;
const HORIZONTAL_PADDING = spacing[4];

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

/** Curated card palette — distinct hues that stay harmonious with the vineyard theme. */
const CARD_COLORS = {
  /** Indigo-blue — neutral "count" feel */
  records: '#5856D6',
  /** Teal — water / flow */
  water: '#30B0C7',
  /** Warm amber — harvest / yield */
  harvest: '#E8952E',
  /** Positive green — profit ≥ 0 */
  profitPositive: '#2AA45B',
  /** Rose — profit < 0 / expenses */
  profitNegative: '#E5484D',
  /** Emerald — revenue */
  revenue: '#2AA45B',
  /** Rose-red — expenses */
  expenses: '#E5484D',
  /** Slate-blue — stock usage */
  stockUsage: '#6366F1',
  /** Teal — stock matched */
  stockMatched: '#0EA5A0',
  /** Amber — coverage */
  stockCoverage: '#D97706',
} as const;

interface ReportExecutiveSummaryProps {
  preview: ReportPreview;
  reportType: ReportType;
  preferredCurrency: string;
}

export function ReportExecutiveSummary({
  preview,
  reportType,
  preferredCurrency,
}: ReportExecutiveSummaryProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const snapInterval = CARD_WIDTH + CARD_GAP;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / snapInterval);
      setActiveIndex(Math.min(Math.max(index, 0), summaryTiles.length - 1));
    },
    [snapInterval, summaryTiles.length],
  );

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
          paddingHorizontal: HORIZONTAL_PADDING,
        }}
      >
        {t('reports.formal.executiveTitle')}
      </Text>

      {/* Horizontally scrollable hero cards */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: HORIZONTAL_PADDING,
          gap: CARD_GAP,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {summaryTiles.map((tile) => (
          <View
            key={tile.key}
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: borderRadius['2xl'],
              borderCurve: 'continuous',
              backgroundColor: colorWithOpacity(tile.color, 0.12),
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colorWithOpacity(tile.color, 0.18),
            }}
          >
            {/* Card content */}
            <View
              style={{
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingTop: spacing[2],
                paddingBottom: spacing[2] + 2,
                justifyContent: 'space-between',
              }}
            >
              {/* Icon */}
              <Icon
                name={ICON_MAP[tile.key] ?? 'info.circle.fill'}
                size={18}
                color={tile.color}
                weight="semibold"
              />

              {/* Value + Label */}
              <View style={{ gap: 1 }}>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{
                    color: tile.color,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    fontVariant: ['tabular-nums'],
                    lineHeight: 22,
                  }}
                >
                  {tile.value}
                </Text>
                <Text
                  numberOfLines={2}
                  selectable
                  style={{
                    color: colorWithOpacity(tile.color, 0.7),
                    fontSize: 11,
                    fontWeight: fontWeight.medium,
                    lineHeight: 14,
                  }}
                >
                  {tile.label}
                </Text>
              </View>
            </View>

            {/* Bottom gradient-like overlay for depth */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: CARD_HEIGHT * 0.4,
                backgroundColor: colorWithOpacity(tile.color, 0.06),
                borderBottomLeftRadius: borderRadius['2xl'],
                borderBottomRightRadius: borderRadius['2xl'],
              }}
              pointerEvents="none"
            />

            {/* Subtle border */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: borderRadius['2xl'],
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: colorWithOpacity(tile.color, 0.18),
              }}
              pointerEvents="none"
            />
          </View>
        ))}
      </ScrollView>

      {/* Page indicator dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        {summaryTiles.map((tile, index) => (
          <View
            key={tile.key}
            style={{
              width: index === activeIndex ? 18 : 6,
              height: 6,
              borderRadius: borderRadius.full,
              borderCurve: 'continuous',
              backgroundColor:
                index === activeIndex
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurface, 0.18),
            }}
          />
        ))}
      </View>
    </View>
  );
}
