import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { Symbol as Icon } from '@/components/ui/symbol';
import {
  getSectionsForReportType,
  type ReportPreview,
  type ReportType,
  type UsageVerbatimRow,
  type FpcColumnOptions,
  FPC_LEAN_COLUMNS,
} from '@/types/report';
import { useLogPresentation } from '@/hooks/use-log-presentation';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import {
  ReportSectionBlock,
  type ReportSectionRecord,
  type ReportSectionRow,
} from './report-section-block';
import { ReportFpcColumnToggles } from './report-fpc-column-toggles';
import { NutrientLedgerSection } from './nutrient-ledger-section';

const ROW_LIMIT = 12;

/**
 * Sections with no log type of their own. The five dated activity sections take
 * their icon, colour and label from `useLogPresentation` instead — the canonical
 * LOG_TYPES + dark-aware domain ramp that the home screen's recent-activity list
 * already uses, so the same irrigation log is not one green on home and another
 * green here. `stock` has no LogTypeId, so it keeps its own pair.
 */
const SECTION_ICONS = {
  stock: 'cube.fill',
  fpcActivity: 'doc.text.fill',
} as const;

interface ReportDocumentBodyProps {
  preview: ReportPreview;
  reportType: ReportType;
  preferredCurrency: string;
  /** FPC register column visibility — mirrors the register export so the
   *  disclosure below shows exactly what will be exported. Lean by default. */
  fpcColumns?: FpcColumnOptions;
  /** Omit to render the register columns as read-only. */
  onFpcColumnsChange?: (columns: FpcColumnOptions) => void;
  /** Omit to hide the register's export action (e.g. in tests/snapshots). */
  onExportRegister?: () => void;
  panelStyle: object;
}

function ReportDocumentBodyComponent({
  preview,
  reportType,
  preferredCurrency,
  fpcColumns = FPC_LEAN_COLUMNS,
  onFpcColumnsChange,
  onExportRegister,
  panelStyle,
}: ReportDocumentBodyProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const log = useLogPresentation();
  const visibleSections = new Set(getSectionsForReportType(reportType, fpcColumns));

  // The buyer's register is a different document for a different reader, so it
  // stays collapsed — out of the farmer's reading path, but expandable so the
  // register export is never blind.
  const [registerOpen, setRegisterOpen] = React.useState(false);

  const stockAccentColor = m3.colorScheme.secondary;

  // ── Data rows ──────────────────────────────────────────────────────────

  /** Joins the parts of a record's supporting line, dropping the empty ones. */
  const detail = (...parts: (string | null | undefined)[]) =>
    parts.filter((part) => part && part !== '-').join(' · ') || undefined;

  const irrigationRecords: ReportSectionRecord[] = preview.data.irrigation
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `irr-${row.date}-${index}`,
      title: log.irrigation.label,
      detail: detail(`${formatNumber(row.duration)} h`),
      date: row.date,
    }));

  const sprayRecords: ReportSectionRecord[] = preview.data.spray
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `spr-${row.date}-${index}`,
      title: row.chemical || log.spray.label,
      detail: detail(row.dose),
      date: row.date,
    }));

  const fertigationRecords: ReportSectionRecord[] = preview.data.fertigation
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `fert-${row.date}-${index}`,
      title: log.fertigation.label,
      detail: detail(row.fertilizers),
      date: row.date,
    }));

  const harvestRecords: ReportSectionRecord[] = preview.data.harvest
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      id: `har-${row.date}-${index}`,
      title: log.harvest.label,
      detail: detail(
        `${formatNumber(row.quantity)} kg`,
        row.grade,
        row.price != null ? formatCurrency(row.price, preferredCurrency) : null,
      ),
      date: row.date,
    }));

  const expenseRecords: ReportSectionRecord[] = preview.data.expense
    .slice(0, ROW_LIMIT)
    .map((row, index) => ({
      // The category is more useful as the title than the word "Expense".
      id: `exp-${row.date}-${index}`,
      title: row.type || log.expense.label,
      detail: detail(formatCurrency(row.cost, preferredCurrency), row.remarks),
      date: row.date,
    }));

  /**
   * The five dated activity sections, which differ only in their data. Driving
   * them from one list means an added log type can't be styled inconsistently by
   * a copy-pasted block, and it makes "which sections were empty" answerable.
   */
  const datedSections = [
    {
      key: 'irrigation' as const,
      titleKey: 'reports.export.sections.irrigationRecords',
      presentation: log.irrigation,
      records: irrigationRecords,
      total: preview.data.irrigation.length,
      visible: visibleSections.has('irrigation'),
    },
    {
      key: 'spray' as const,
      titleKey: 'reports.export.sections.sprayRecords',
      presentation: log.spray,
      records: sprayRecords,
      total: preview.data.spray.length,
      visible: visibleSections.has('spray'),
    },
    {
      key: 'fertigation' as const,
      titleKey: 'reports.formal.sections.fertigationRecords',
      presentation: log.fertigation,
      records: fertigationRecords,
      total: preview.data.fertigation.length,
      visible: visibleSections.has('fertigation'),
    },
    {
      key: 'harvest' as const,
      titleKey: 'reports.export.sections.harvestRecords',
      presentation: log.harvest,
      records: harvestRecords,
      total: preview.data.harvest.length,
      visible: visibleSections.has('harvest'),
    },
    {
      key: 'expense' as const,
      titleKey: 'reports.export.sections.expenseRecords',
      presentation: log.expense,
      records: expenseRecords,
      total: preview.data.expense.length,
      visible: visibleSections.has('expense'),
    },
  ];

  const emptySectionNames = datedSections
    .filter((section) => section.visible && section.total === 0)
    .map((section) => section.presentation.label);

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

  // ── Section wrapper ────────────────────────────────────────────────────

  const renderSectionCard = (accentColor: string, children: React.ReactNode) => (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colorWithOpacity(accentColor, 0.22),
        paddingTop: spacing[4],
      }}
    >
      {children}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={{ gap: spacing[5] }}>
      {/* Dated activity sections. Empty ones do not render a card — six
          identical "No records in selected range" panels is a wall to scroll
          past, not information. What was empty is named once, below. */}
      {datedSections
        .filter((section) => section.visible && section.total > 0)
        .map((section) => (
          <React.Fragment key={section.key}>
            {renderSectionCard(
              section.presentation.color,
              <ReportSectionBlock
                title={t(section.titleKey, { count: section.total })}
                records={section.records}
                hiddenCount={Math.max(0, section.total - ROW_LIMIT)}
                icon={resolveSymbolIconName(section.presentation.icon)}
                accentColor={section.presentation.color}
              />,
            )}
          </React.Fragment>
        ))}

      {emptySectionNames.length > 0 ? (
        <Text
          selectable
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            fontSize: fontSize.sm,
          }}
        >
          {t('reports.formal.noneLogged', { sections: emptySectionNames.join(', ') })}
        </Text>
      ) : null}

      {/* Stock section */}
      {/* Also hidden when empty — a "Detailed Stock Usage (0/0)" card over an
          empty panel is the same wall as the dated sections above. */}
      {visibleSections.has('stock') && preview.data.stock.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={`${t('reports.stockDetails.title')} (${matchedStockRows.length}/${preview.data.stock.length})`}
              rows={stockRows}
              hiddenCount={Math.max(0, matchedStockRows.length - ROW_LIMIT)}
              icon={SECTION_ICONS.stock}
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {/* Usage lenses (issue #198): per plot / per acre / per liter */}
      {usage != null && usage.perPlot.rows.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.perPlotTitle')}
              rows={perPlotRows}
              hiddenCount={Math.max(0, usage.perPlot.rows.length - ROW_LIMIT)}
              icon="chart.bar.fill"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {usage != null && usage.perPlot.other.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.otherTitle')}
              rows={verbatimRows(usage.perPlot.other, 'lens-other')}
              hiddenCount={Math.max(0, usage.perPlot.other.length - ROW_LIMIT)}
              icon="questionmark.circle"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {usage != null && usage.perPlot.concentrationOnly.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.concentrationOnlyTitle')}
              rows={verbatimRows(usage.perPlot.concentrationOnly, 'lens-conc')}
              hiddenCount={Math.max(0, usage.perPlot.concentrationOnly.length - ROW_LIMIT)}
              icon="drop.circle.fill"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {usage != null && usage.perPlot.rateOnly.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.rateOnlyTitle')}
              rows={verbatimRows(usage.perPlot.rateOnly, 'lens-rate')}
              hiddenCount={Math.max(0, usage.perPlot.rateOnly.length - ROW_LIMIT)}
              icon="questionmark.circle"
              accentColor={stockAccentColor}
            />,
          )
        : null}

      {usage != null && hasPerPlotContent
        ? renderSectionCard(
            stockAccentColor,
            <ReportSectionBlock
              title={t('reports.lenses.perAcreTitle')}
              rows={usage.perAcre.available ? perAcreLensRows : []}
              hiddenCount={
                usage.perAcre.available ? Math.max(0, usage.perAcre.rows.length - ROW_LIMIT) : 0
              }
              icon="square.grid.2x2.fill"
              accentColor={stockAccentColor}
              emptyMessage={t('reports.lenses.perAcreUnavailable')}
            />,
          )
        : null}

      {usage != null && usage.perAcre.compliance.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <View>
              <ReportSectionBlock
                title={t('reports.lenses.complianceTitle')}
                rows={complianceRows}
                hiddenCount={Math.max(0, usage.perAcre.compliance.length - ROW_LIMIT)}
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

      {usage != null && usage.perLiter.rows.length > 0
        ? renderSectionCard(
            stockAccentColor,
            <View>
              <ReportSectionBlock
                title={t('reports.lenses.perLiterTitle')}
                rows={perLiterRows}
                hiddenCount={Math.max(0, usage.perLiter.rows.length - ROW_LIMIT)}
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

      {/* ── Buyer's register (Fratelli format) ──
          Last, and collapsed. Gated on register data rather than on
          `visibleSections`: adding 'fpc-activity' to the comprehensive section
          map would also stamp a buyer-format table into every farmer's report
          export, which is the wrong document for that reader. Previewing it
          here keeps the register export from being blind without changing what
          the comprehensive export contains. */}
      {fpcDays.length > 0 ? (
        <View>
          <Pressable
            onPress={() => setRegisterOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: registerOpen }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              minHeight: 44,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon
              name={SECTION_ICONS.fpcActivity}
              size={16}
              color={m3.colorScheme.onSurfaceVariant}
            />
            <Text
              style={{
                flex: 1,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
                letterSpacing: -0.2,
              }}
            >
              {t('reports.fpc.sectionTitle', { count: fpcDays.length })}
            </Text>
            <Icon
              name={registerOpen ? 'chevron.up' : 'chevron.down'}
              size={14}
              color={m3.colorScheme.onSurfaceVariant}
            />
          </Pressable>

          {registerOpen ? (
            <View style={{ gap: spacing[3], paddingTop: spacing[3] }}>
              {onFpcColumnsChange ? (
                <ReportFpcColumnToggles columns={fpcColumns} onChange={onFpcColumnsChange} />
              ) : null}
              <ReportSectionBlock
                title={t('reports.fpc.detail.title')}
                rows={fpcRows}
                hiddenCount={Math.max(0, fpcDays.length - ROW_LIMIT)}
                icon={SECTION_ICONS.fpcActivity}
                accentColor={m3.colorScheme.onSurfaceVariant}
                emptyMessage={t('reports.fpc.empty')}
              />

              {onExportRegister ? (
                <Pressable
                  onPress={onExportRegister}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing[2],
                    minHeight: 44,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: m3.colorScheme.primary,
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                      : 'transparent',
                  })}
                >
                  <Icon name="square.and.arrow.up" size={16} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.primary,
                    }}
                  >
                    {t('reports.fpc.shareRegister')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const ReportDocumentBody = React.memo(ReportDocumentBodyComponent);
