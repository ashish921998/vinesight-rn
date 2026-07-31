import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatNumber } from '@/i18n/format';
import type { MetricDelta, ReportComparison, ReportPreview } from '@/types/report';
import { Symbol as Icon } from '@/components/ui/symbol';

const CARD_MIN_HEIGHT = 82;

/**
 * Small period-over-period chip shown top-right of each tile.
 * Renders nothing when there is no meaningful numeric baseline. "New" is not
 * useful here because it can mean either first-time activity or missing data.
 */
function DeltaChip({ delta, color }: { delta: MetricDelta | undefined; color: string }) {
  if (!delta || delta.isNew) return null;

  const rounded = Math.round(Math.abs(delta.deltaPct ?? 0));
  if (rounded < 1) return null;

  const label = `${delta.direction > 0 ? '↑' : '↓'} ${rounded}%`;

  return (
    <View
      style={{
        paddingHorizontal: spacing[1] + 2,
        paddingVertical: 1,
        borderRadius: radius.full,
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
  harvest: 'basket.fill',
  profit: 'chart.line.uptrend.xyaxis',
  revenue: 'dollarsign.circle.fill',
  expenses: 'creditcard.fill',
};

interface ReportExecutiveSummaryProps {
  preview: ReportPreview;
  preferredCurrency: string;
  /** Period-over-period deltas, keyed by tile key. Omit to hide all chips. */
  comparison?: ReportComparison | null;
}

/**
 * The report's headline numbers.
 *
 * Only non-zero metrics render. A grid of confident coloured cards reading
 * "0L / 0kg / ₹0.00" is worse than saying nothing: it implies a measurement was
 * taken and came back zero, when in fact nothing was logged. There is also no
 * "Total Records" tile — a record count is a database fact, not a farming one.
 *
 * Colours come from theme tokens rather than the literal hexes this file used to
 * carry. Those hexes were exact copies of `irrigation.500`, `harvest.500`,
 * `success`, `error`, `secondary.500` and `accent.500`, so they rendered
 * identically in light mode and were invisible in dark mode.
 */
export function ReportExecutiveSummary({
  preview,
  preferredCurrency,
  comparison,
}: ReportExecutiveSummaryProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const { summary } = preview;
  const currency = (value: number) => formatCurrency(value, preferredCurrency);

  const tiles = [
    {
      key: 'harvest',
      label: t('reports.summary.totalHarvest'),
      value: `${formatNumber(summary.totalHarvest)}kg`,
      color: m3.colorScheme.primary,
      show: summary.totalHarvest !== 0,
    },
    {
      key: 'revenue',
      label: t('reports.formal.revenue'),
      value: currency(summary.totalRevenue),
      color: m3.colorScheme.success,
      show: summary.totalRevenue !== 0,
    },
    {
      key: 'expenses',
      label: t('reports.formal.expenses'),
      value: currency(summary.totalExpenses),
      color: m3.colorScheme.error,
      show: summary.totalExpenses !== 0,
    },
    {
      key: 'profit',
      label: t('reports.summary.netProfit'),
      value: currency(summary.netProfit),
      color: summary.netProfit >= 0 ? m3.colorScheme.success : m3.colorScheme.error,
      // Only meaningful once there is money on at least one side.
      show: summary.totalRevenue !== 0 || summary.totalExpenses !== 0,
    },
  ].filter((tile) => tile.show);

  // Records exist but none carry a headline figure (e.g. irrigation logged
  // without a water volume). Rendering nothing is correct here — the record
  // sections below carry the detail, and claiming "nothing logged" directly
  // above "Irrigation Records (2)" would be a lie.
  if (tiles.length === 0 && summary.totalRecords > 0) return null;

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ gap: 2 }}>
        <Text
          selectable
          style={{
            color: m3.colorScheme.onSurface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.lg,
          }}
        >
          {t('reports.formal.executiveTitle')}
        </Text>
        <Text
          selectable
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            fontWeight: fontWeight.normal,
            fontSize: fontSize.xs,
          }}
        >
          {comparison
            ? t('reports.summary.comparedWith', { period: comparison.baselineLabel })
            : t('reports.summary.loggedRecordsNote')}
        </Text>
      </View>

      {tiles.length === 0 ? (
        <Text selectable style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.sm }}>
          {t('reports.summary.nothingLogged')}
        </Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing[2],
          }}
        >
          {tiles.map((tile) => (
            <View
              key={tile.key}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                minHeight: CARD_MIN_HEIGHT,
                // Matches the record cards and filter panel either side of these
                // tiles. `2xl` (28) is the large-feature-surface rung and made
                // them the only surface on the screen at a different radius.
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                backgroundColor: m3.colorScheme.surface,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                padding: spacing[3],
                justifyContent: 'space-between',
                gap: spacing[2],
              }}
            >
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

              <View style={{ gap: 1 }}>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={{
                    color: m3.colorScheme.onSurface,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    fontVariant: ['tabular-nums'],
                    lineHeight: 24,
                  }}
                >
                  {tile.value}
                </Text>
                <Text
                  numberOfLines={2}
                  selectable
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
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
      )}
    </View>
  );
}
