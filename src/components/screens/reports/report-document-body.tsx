import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import {
  getSectionsForReportType,
  type ReportPreview,
  type ReportType,
  type UsageVerbatimRow,
  type FpcColumnOptions,
  FPC_LEAN_COLUMNS,
} from '@/types/report';
import { ReportSectionBlock, type ReportSectionRow } from './report-section-block';
import { NutrientLedgerSection } from './nutrient-ledger-section';

const ROW_LIMIT = 12;

/** SF Symbol icon names for each report section. */
const SECTION_ICONS = {
  irrigation: 'drop.fill',
  spray: 'spraycan.fill',
  fertigation: 'leaf.fill',
  harvest: 'basket.fill',
  expense: 'dollarsign.circle.fill',
  stock: 'cube.fill',
  fpcActivity: 'doc.text.fill',
} as const;

/** Accent color per section (direct theme values). */
const SECTION_ACCENT_COLORS = {
  irrigation: '#4d8573',
  spray: '#598d6b',
  fertigation: '#408059',
  harvest: '#669475',
  expense: '#598066',
  // stock uses m3.colorScheme.secondary — resolved at render time
} as const;

interface ReportDocumentBodyProps {
  preview: ReportPreview;
  reportType: ReportType;
  preferredCurrency: string;
  /** FPC register column visibility — mirrors the export so the in-app preview
   *  shows exactly what will be exported. Defaults to the lean preset. */
  fpcColumns?: FpcColumnOptions;
  panelStyle: object;
}

export function ReportDocumentBody({
  preview,
  reportType,
  preferredCurrency,
  fpcColumns = FPC_LEAN_COLUMNS,
  panelStyle,
}: ReportDocumentBodyProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const visibleSections = new Set(getSectionsForReportType(reportType));

  const stockAccentColor = m3.colorScheme.secondary;

  // ── Data rows ──────────────────────────────────────────────────────────

  const irrigationRows: ReportSectionRow[] = preview.data.irrigation
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `irr-${row.date}-${index}`,
      lines: [
        { label: t('reports.export.table.date'), value: row.date },
        {
          label: t('reports.export.table.duration'),
          value: `${formatNumber(row.duration)} h`,
          monospace: true,
        },
      ],
    }));

  const sprayRows: ReportSectionRow[] = preview.data.spray
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `spr-${row.date}-${index}`,
      lines: [
        { label: t('reports.export.table.date'), value: row.date },
        { label: t('reports.export.table.chemical'), value: row.chemical },
        { label: t('reports.export.table.dose'), value: row.dose },
      ],
    }));

  const fertigationRows: ReportSectionRow[] = preview.data.fertigation
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `fert-${row.date}-${index}`,
      lines: [
        { label: t('reports.export.table.date'), value: row.date },
        { label: t('reports.formal.table.fertilizers'), value: row.fertilizers },
      ],
    }));

  const harvestRows: ReportSectionRow[] = preview.data.harvest
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `har-${row.date}-${index}`,
      lines: [
        { label: t('reports.export.table.date'), value: row.date },
        {
          label: t('reports.export.table.quantity'),
          value: `${formatNumber(row.quantity)} kg`,
          monospace: true,
        },
        { label: t('reports.export.table.grade'), value: row.grade },
        {
          label: t('reports.export.table.price'),
          value: row.price != null ? formatCurrency(row.price, preferredCurrency) : '-',
          monospace: true,
        },
      ],
    }));

  const expenseRows: ReportSectionRow[] = preview.data.expense
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `exp-${row.date}-${index}`,
      lines: [
        { label: t('reports.export.table.date'), value: row.date },
        { label: t('reports.export.table.type'), value: row.type },
        {
          label: t('reports.export.table.cost'),
          value: formatCurrency(row.cost, preferredCurrency),
          monospace: true,
        },
        { label: t('reports.export.table.remarks'), value: row.remarks || '-' },
      ],
    }));

  const fpcDays = preview.data.fpcActivity ?? [];
  const fpcRows: ReportSectionRow[] = fpcDays.slice(0, ROW_LIMIT).map((day) => ({
    id: `fpc-${day.isoDate}`,
    lines: [
      { label: t('reports.export.table.date'), value: day.date },
      {
        label: t('reports.fpc.day'),
        value: day.daysAfterPruning != null ? String(day.daysAfterPruning) : '-',
        monospace: true,
      },
      ...(fpcColumns.irrigation && day.irrigationHours != null
        ? [
            {
              label: t('reports.fpc.irrigation'),
              value: `${formatNumber(day.irrigationHours)} h${
                day.waterMm != null ? ` · ${formatNumber(day.waterMm)} mm` : ''
              }`,
              monospace: true,
            },
          ]
        : []),
      {
        label: t('reports.fpc.products'),
        value:
          day.products.length > 0
            ? day.products
                .map(
                  (product) =>
                    `${product.marketName} (${product.totalQtyDisplay ?? product.asLogged})`,
                )
                .join(', ')
            : t('reports.fpc.noProducts'),
      },
    ],
  }));

  const matchedStockRows = preview.data.stock.filter((row) => row.matchStrategy !== 'unmatched');

  const stockRows: ReportSectionRow[] = matchedStockRows.slice(0, ROW_LIMIT).map((row, index) => ({
    id: `stock-${row.type}-${row.itemName}-${row.unit}-${index}`,
    lines: [
      { label: t('reports.export.table.type'), value: `${row.itemName} (${row.type})` },
      {
        label: t('reports.stockDetails.used'),
        value: `${formatNumber(row.quantityUsed)} ${row.unit}`,
        monospace: true,
      },
      {
        label: t('reports.stockDetails.currentStock'),
        value:
          row.currentStockQuantity != null
            ? `${formatNumber(row.currentStockQuantity)} ${row.unit}`
            : t('reports.stockDetails.na'),
        monospace: true,
      },
      {
        label: t('reports.stockDetails.estimatedOpeningStock'),
        value:
          row.estimatedOpeningStockQuantity != null
            ? `${formatNumber(row.estimatedOpeningStockQuantity)} ${row.unit}`
            : t('reports.stockDetails.na'),
        monospace: true,
      },
      {
        label: t('reports.stockDetails.consumedPercent'),
        value:
          row.estimatedConsumedPercent != null
            ? `${formatNumber(row.estimatedConsumedPercent)}%`
            : t('reports.stockDetails.na'),
        monospace: true,
      },
      {
        label: t('reports.stockDetails.match'),
        value: row.matchStrategy ?? t('reports.stockDetails.na'),
      },
    ],
  }));

  // ── Usage lens rows (kernel-derived, issue #198) ───────────────────────

  const usage = preview.data.usage;

  const verbatimRows = (rows: UsageVerbatimRow[], prefix: string): ReportSectionRow[] =>
    rows.slice(0, ROW_LIMIT).map((row) => ({
      id: `${prefix}-${row.key}`,
      lines: [
        { label: t('reports.lenses.product'), value: row.name },
        {
          label: t('reports.lenses.asLogged'),
          value: `${formatNumber(row.quantity)} ${row.unit}`,
          monospace: true,
        },
        { label: t('reports.lenses.uses'), value: String(row.usageCount), monospace: true },
      ],
    }));

  const perPlotRows: ReportSectionRow[] = (usage?.perPlot.rows ?? [])
    .slice(0, ROW_LIMIT)
    .map((row) => ({
      id: `lens-plot-${row.key}`,
      lines: [
        { label: t('reports.lenses.product'), value: row.name },
        {
          label: t('reports.lenses.total'),
          value: row.totals.map((figure) => figure.display).join(' · '),
          monospace: true,
        },
        { label: t('reports.lenses.uses'), value: String(row.usageCount), monospace: true },
      ],
    }));

  const perAcreLensRows: ReportSectionRow[] = (usage?.perAcre.rows ?? [])
    .slice(0, ROW_LIMIT)
    .map((row) => ({
      id: `lens-acre-${row.key}`,
      lines: [
        { label: t('reports.lenses.product'), value: row.name },
        {
          label: t('reports.lenses.perAcre'),
          value: row.perAcre.map((figure) => figure.display).join(' · '),
          monospace: true,
        },
      ],
    }));

  const complianceRows: ReportSectionRow[] = (usage?.perAcre.compliance ?? [])
    .slice(0, ROW_LIMIT)
    .map((row) => ({
      id: `lens-compliance-${row.planItemId}`,
      lines: [
        { label: t('reports.lenses.product'), value: row.name },
        {
          label: t('reports.lenses.prescribed'),
          value: row.prescribedDisplay,
          monospace: true,
        },
        {
          label: t('reports.lenses.applied'),
          value:
            row.appliedDisplay ??
            t(
              row.matchLevel === 'unresolved'
                ? 'reports.lenses.unresolved'
                : 'reports.lenses.notLogged',
            ),
          monospace: true,
        },
        {
          label: t('reports.lenses.match'),
          value:
            row.matchLevel === 'verified'
              ? t('reports.lenses.verified')
              : row.matchLevel === 'approximate'
                ? t('reports.lenses.approximate')
                : row.matchLevel === 'unresolved'
                  ? t('reports.lenses.unresolved')
                  : '-',
        },
      ],
    }));

  const perLiterRows: ReportSectionRow[] = (usage?.perLiter.rows ?? [])
    .slice(0, ROW_LIMIT)
    .map((row) => ({
      id: `lens-liter-${row.key}`,
      lines: [
        { label: t('reports.lenses.product'), value: row.name },
        { label: t('reports.lenses.concentration'), value: row.display, monospace: true },
        {
          label: t('reports.lenses.eventsWithWater'),
          value: String(row.eventCount),
          monospace: true,
        },
      ],
    }));

  const hasPerPlotContent =
    (usage?.perPlot.rows.length ?? 0) > 0 || (usage?.perPlot.rateOnly.length ?? 0) > 0;

  // ── Section card wrapper with left accent bar ──────────────────────────

  const renderSectionCard = (accentColor: string, children: React.ReactNode) => (
    <View
      style={[
        panelStyle,
        {
          flexDirection: 'row',
          overflow: 'hidden',
          borderCurve: 'continuous',
        },
      ]}
    >
      {/* Left accent bar */}
      <View
        style={{
          width: 4,
          backgroundColor: accentColor,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      />
      <View style={{ flex: 1, paddingLeft: spacing[3] }}>{children}</View>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={{ gap: spacing[5] }}>
      {/* FPC activity register (Fratelli format) */}
      {visibleSections.has('fpc-activity')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.fertigation,
            <ReportSectionBlock
              title={t('reports.fpc.sectionTitle', { count: fpcDays.length })}
              rows={fpcRows}
              hiddenCount={Math.max(0, fpcDays.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.fpcActivity}
              accentColor={SECTION_ACCENT_COLORS.fertigation}
              emptyMessage={t('reports.fpc.empty')}
            />,
          )
        : null}

      {/* Operations sections */}
      {visibleSections.has('irrigation')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.irrigation,
            <ReportSectionBlock
              title={t('reports.export.sections.irrigationRecords', {
                count: preview.data.irrigation.length,
              })}
              rows={irrigationRows}
              hiddenCount={Math.max(0, preview.data.irrigation.length - ROW_LIMIT)}
              variant="compact-two-col"
              icon={SECTION_ICONS.irrigation}
              accentColor={SECTION_ACCENT_COLORS.irrigation}
            />,
          )
        : null}

      {visibleSections.has('spray')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.spray,
            <ReportSectionBlock
              title={t('reports.export.sections.sprayRecords', {
                count: preview.data.spray.length,
              })}
              rows={sprayRows}
              hiddenCount={Math.max(0, preview.data.spray.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.spray}
              accentColor={SECTION_ACCENT_COLORS.spray}
            />,
          )
        : null}

      {visibleSections.has('fertigation')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.fertigation,
            <ReportSectionBlock
              title={t('reports.formal.sections.fertigationRecords', {
                count: preview.data.fertigation.length,
              })}
              rows={fertigationRows}
              hiddenCount={Math.max(0, preview.data.fertigation.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.fertigation}
              accentColor={SECTION_ACCENT_COLORS.fertigation}
            />,
          )
        : null}

      {visibleSections.has('harvest')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.harvest,
            <ReportSectionBlock
              title={t('reports.export.sections.harvestRecords', {
                count: preview.data.harvest.length,
              })}
              rows={harvestRows}
              hiddenCount={Math.max(0, preview.data.harvest.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.harvest}
              accentColor={SECTION_ACCENT_COLORS.harvest}
            />,
          )
        : null}

      {/* Financial section */}
      {visibleSections.has('expense')
        ? renderSectionCard(
            SECTION_ACCENT_COLORS.expense,
            <ReportSectionBlock
              title={t('reports.export.sections.expenseRecords', {
                count: preview.data.expense.length,
              })}
              rows={expenseRows}
              hiddenCount={Math.max(0, preview.data.expense.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.expense}
              accentColor={SECTION_ACCENT_COLORS.expense}
            />,
          )
        : null}

      {/* Stock section */}
      {visibleSections.has('stock')
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={`${t('reports.stockDetails.title')} (${matchedStockRows.length}/${preview.data.stock.length})`}
              rows={stockRows}
              hiddenCount={Math.max(0, matchedStockRows.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.stock}
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {/* Usage lenses (issue #198): per plot / per acre / per liter */}
      {visibleSections.has('stock') && usage && usage.perPlot.rows.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.perPlotTitle')}
              rows={perPlotRows}
              hiddenCount={Math.max(0, usage.perPlot.rows.length - ROW_LIMIT)}
              variant="compact-inline"
              icon="chart.bar.fill"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {visibleSections.has('stock') && usage && usage.perPlot.other.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.otherTitle')}
              rows={verbatimRows(usage.perPlot.other, 'lens-other')}
              hiddenCount={Math.max(0, usage.perPlot.other.length - ROW_LIMIT)}
              variant="compact-inline"
              icon="questionmark.circle"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {visibleSections.has('stock') && usage && usage.perPlot.concentrationOnly.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.concentrationOnlyTitle')}
              rows={verbatimRows(usage.perPlot.concentrationOnly, 'lens-conc')}
              hiddenCount={Math.max(0, usage.perPlot.concentrationOnly.length - ROW_LIMIT)}
              variant="compact-inline"
              icon="drop.circle.fill"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {visibleSections.has('stock') && usage && usage.perPlot.rateOnly.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.rateOnlyTitle')}
              rows={verbatimRows(usage.perPlot.rateOnly, 'lens-rate')}
              hiddenCount={Math.max(0, usage.perPlot.rateOnly.length - ROW_LIMIT)}
              variant="compact-inline"
              icon="questionmark.circle"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {visibleSections.has('stock') && usage && hasPerPlotContent
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.perAcreTitle')}
              rows={usage.perAcre.available ? perAcreLensRows : []}
              hiddenCount={
                usage.perAcre.available ? Math.max(0, usage.perAcre.rows.length - ROW_LIMIT) : 0
              }
              variant="compact-inline"
              icon="square.grid.2x2.fill"
              accentColor={stockAccentColor}
              emptyMessage={t('reports.lenses.perAcreUnavailable')}
            />,
          )
        : null}

      {visibleSections.has('stock') && usage && usage.perAcre.compliance.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <View>
              <ReportSectionBlock
                title={t('reports.lenses.complianceTitle')}
                rows={complianceRows}
                hiddenCount={Math.max(0, usage.perAcre.compliance.length - ROW_LIMIT)}
                variant="compact-inline"
                icon="checkmark.seal.fill"
                accentColor={stockAccentColor}
              />
              <Text
                selectable
                style={{
                  color: m3.colorScheme.onSurfaceVariant,
                  fontSize: fontSize.xs,
                  paddingVertical: spacing[2],
                  paddingRight: spacing[3],
                }}
              >
                {t('reports.lenses.complianceNote')}
              </Text>
            </View>,
          )
        : null}

      {visibleSections.has('stock') && usage && usage.perLiter.rows.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <View>
              <ReportSectionBlock
                title={t('reports.lenses.perLiterTitle')}
                rows={perLiterRows}
                hiddenCount={Math.max(0, usage.perLiter.rows.length - ROW_LIMIT)}
                variant="compact-inline"
                icon="drop.fill"
                accentColor={stockAccentColor}
              />
              <Text
                selectable
                style={{
                  color: m3.colorScheme.onSurfaceVariant,
                  fontSize: fontSize.xs,
                  paddingVertical: spacing[2],
                  paddingRight: spacing[3],
                }}
              >
                {t('reports.lenses.waterCoverage', {
                  withWater: usage.perLiter.sprayEventsWithWater,
                  total: usage.perLiter.sprayEventsTotal,
                })}
              </Text>
            </View>,
          )
        : null}

      {/* Nutrient ledger (issue #200): renders its own card via panelStyle.
          Shown even at 0% coverage — the component's empty/zero states carry
          the honesty message; hiding it would read as "nothing was applied". */}
      {visibleSections.has('nutrient-ledger') && preview.data.nutrientLedger ? (
        <NutrientLedgerSection ledger={preview.data.nutrientLedger} panelStyle={panelStyle} />
      ) : null}
    </View>
  );
}
