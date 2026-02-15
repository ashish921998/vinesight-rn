import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { getSectionsForReportType, type ReportPreview, type ReportType } from '@/types/report';
import { ReportSectionBlock, type ReportSectionRow } from './report-section-block';

const ROW_LIMIT = 12;

/** SF Symbol icon names for each report section. */
const SECTION_ICONS = {
  irrigation: 'drop.fill',
  spray: 'spraycan.fill',
  fertigation: 'leaf.fill',
  harvest: 'basket.fill',
  expense: 'dollarsign.circle.fill',
  stock: 'cube.fill',
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
  panelStyle: object;
}

export function ReportDocumentBody({
  preview,
  reportType,
  preferredCurrency,
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

  const stockRows: ReportSectionRow[] = preview.data.stock
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
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
              title={t('reports.stockDetails.title')}
              rows={stockRows}
              hiddenCount={Math.max(0, preview.data.stock.length - ROW_LIMIT)}
              variant="compact-inline"
              icon={SECTION_ICONS.stock}
              accentColor={stockAccentColor}
            />,
          )
        : null}
    </View>
  );
}
