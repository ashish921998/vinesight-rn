import {
  ReportData,
  ReportType,
  FpcColumnOptions,
  FPC_LEAN_COLUMNS,
  NutrientLedger,
  FpcActivityDayRow,
  FpcActivityProductRow,
  ReportUsageLenses,
} from '../../types/report';
import { formatDate } from '@/i18n/format';
import type { AreaUnitPreference } from '@/utils/preferences';
import {
  escapeCSV,
  getVisibleSections,
  formatReportType,
  formatSeasonContextLabel,
  formatSeasonCell,
  formatDaysAfterPruningValue,
  formatAreaAcres,
  countFpcProductOptionalCols,
  EMPTY_SECTION_TEXT,
} from './report-format';

/**
 * FPC activity register CSV: date columns written once per day block,
 * one row per product under them — the shape FPC field officers keep in
 * their own Excel registers. No row cap: a buyer audit needs the full
 * season, not the first 20 rows.
 */
function appendFpcActivityCSV(
  rows: string[],
  days: FpcActivityDayRow[],
  cols: FpcColumnOptions,
): void {
  const productCount = days.reduce((sum, day) => sum + day.products.length, 0);
  if (days.length === 0) {
    rows.push('FPC ACTIVITY REGISTER');
    rows.push(EMPTY_SECTION_TEXT);
    rows.push('');
    return;
  }

  rows.push(`FPC ACTIVITY REGISTER (${days.length} days, ${productCount} product applications)`);
  rows.push(
    [
      'Date',
      'Day',
      ...(cols.irrigation ? ['Irrigation (hrs)', 'Water (mm)'] : []),
      'Stage',
      'Market Name',
      ...(cols.technicalName ? ['Technical Name'] : []),
      'Qty/Acre',
      'Total Qty/Plot',
      'As Logged',
      ...(cols.phi ? ['PHI (days)'] : []),
      ...(cols.safeHarvest ? ['Safe Harvest'] : []),
      ...(cols.mrl ? ['MRL'] : []),
      'Details',
    ].join(','),
  );

  // Product-level column count (used to blank a no-product day's row):
  // 4 fixed CSV product columns (Market, Qty/Acre, Total, As Logged) plus
  // any enabled optionals — derived from the same flags as the header/cells.
  const productColCount = 4 + countFpcProductOptionalCols(cols);

  const productCells = (product: FpcActivityProductRow): string[] => [
    escapeCSV(product.marketName),
    ...(cols.technicalName ? [escapeCSV(product.technicalName ?? '')] : []),
    escapeCSV(product.qtyPerAcreDisplay ?? ''),
    escapeCSV(product.totalQtyDisplay ?? ''),
    escapeCSV(product.asLogged),
    ...(cols.phi ? [product.phiDays != null ? String(product.phiDays) : ''] : []),
    ...(cols.safeHarvest ? [escapeCSV(product.safeHarvestDate ?? '')] : []),
    ...(cols.mrl ? [escapeCSV(product.mrl ?? '')] : []),
  ];

  days.forEach((day) => {
    const dayCells = [
      escapeCSV(day.date),
      formatDaysAfterPruningValue(day.daysAfterPruning),
      ...(cols.irrigation
        ? [
            day.irrigationHours != null ? String(day.irrigationHours) : '',
            day.waterMm != null ? String(day.waterMm) : '',
          ]
        : []),
      escapeCSV(day.growthStage ?? ''),
    ];
    const blankDayCells = dayCells.map(() => '');
    const notesCell = escapeCSV(day.notes ?? '');

    if (day.products.length === 0) {
      rows.push([...dayCells, ...Array(productColCount).fill(''), notesCell].join(','));
      return;
    }

    day.products.forEach((product, index) => {
      rows.push(
        [
          ...(index === 0 ? dayCells : blankDayCells),
          ...productCells(product),
          index === 0 ? notesCell : '',
        ].join(','),
      );
    });
  });
  rows.push('');
}

/**
 * Nutrient ledger (issue #200). Elemental figures match petiole/soil lab
 * reports; bag-grade oxide (P₂O₅/K₂O …) matches fertilizer bags. Coverage
 * is stated on every export — 0% renders the empty text, never zeros
 * presented as truth.
 */
function appendNutrientLedgerCSV(rows: string[], ledger: NutrientLedger): void {
  rows.push('NUTRIENT LEDGER - NUTRIENTS APPLIED');
  rows.push(
    escapeCSV(
      `Nutrients from ${ledger.coveragePercent}% of applied quantity (${ledger.composedItemCount} of ${ledger.itemCount} items with composition)`,
    ),
  );
  if (ledger.rows.length === 0) {
    // itemCount === 0 means no applications logged; itemCount > 0 with 0%
    // coverage means applications exist but none carried a composition —
    // the coverage line above already states "0 of N", so calling it "no
    // records" would contradict it and misreport missing composition as
    // missing applications.
    rows.push(
      ledger.itemCount === 0
        ? EMPTY_SECTION_TEXT
        : 'No composition data — nutrients cannot be calculated',
    );
    rows.push('');
    return;
  }
  rows.push(
    'Element,Elemental (kg),Elemental (kg/acre),Bag-grade,Bag-grade (kg),Bag-grade (kg/acre)',
  );
  ledger.rows.forEach((row) => {
    rows.push(
      `${row.element},${row.elementalKg},${row.elementalKgPerAcre ?? ''},${escapeCSV(
        row.oxideSymbol ?? '',
      )},${row.oxideKg ?? ''},${row.oxideKgPerAcre ?? ''}`,
    );
  });
  rows.push('');
}

/**
 * Applied-quantity lenses (issue #198). Every figure is derived (folded /
 * divided) and carries the "≈" prefix; verbatim buckets show quantities
 * exactly as logged, never converted.
 */
function appendUsageLensesCSV(rows: string[], usage: ReportUsageLenses): void {
  const { perPlot, perAcre, perLiter } = usage;

  if (perPlot.rows.length > 0) {
    rows.push(escapeCSV('APPLIED QUANTITIES - PER PLOT (per product, per measure)'));
    rows.push('Product,Type,Total Applied,Uses');
    perPlot.rows.forEach((row) => {
      rows.push(
        `${escapeCSV(row.name)},${row.type},${escapeCSV(
          row.totals.map((figure) => figure.display).join(' | '),
        )},${row.usageCount}`,
      );
    });
    rows.push('');
  }

  if (perPlot.other.length > 0) {
    rows.push(escapeCSV('OTHER PRODUCTS (unit not recognized - shown as logged, no conversion)'));
    rows.push('Product,Type,Quantity As Logged,Uses');
    perPlot.other.forEach((row) => {
      rows.push(
        `${escapeCSV(row.name)},${row.type},${escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
      );
    });
    rows.push('');
  }

  if (perPlot.concentrationOnly.length > 0) {
    rows.push('CONCENTRATION-ONLY (water volume not logged - cannot resolve to a total)');
    rows.push('Product,Type,Concentration As Logged,Uses');
    perPlot.concentrationOnly.forEach((row) => {
      rows.push(
        `${escapeCSV(row.name)},${row.type},${escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
      );
    });
    rows.push('');
  }

  if (perPlot.rateOnly.length > 0) {
    rows.push('RATE-ONLY (farm area unavailable - cannot resolve to a total)');
    rows.push('Product,Type,Rate As Logged,Uses');
    perPlot.rateOnly.forEach((row) => {
      rows.push(
        `${escapeCSV(row.name)},${row.type},${escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
      );
    });
    rows.push('');
  }

  if (perAcre.available) {
    if (perAcre.rows.length > 0) {
      rows.push(
        `APPLIED QUANTITIES - PER ACRE (farm area: ${formatAreaAcres(perAcre.areaAcres)} acres)`,
      );
      rows.push('Product,Type,Per Acre');
      perAcre.rows.forEach((row) => {
        rows.push(
          `${escapeCSV(row.name)},${row.type},${escapeCSV(
            row.perAcre.map((figure) => figure.display).join(' | '),
          )}`,
        );
      });
      rows.push('');
    }
    if (perAcre.compliance.length > 0) {
      rows.push(escapeCSV('PLAN COMPLIANCE (prescribed vs applied, per acre)'));
      rows.push('Product,Prescribed,Applied,Match');
      perAcre.compliance.forEach((row) => {
        rows.push(
          `${escapeCSV(row.name)},${escapeCSV(row.prescribedDisplay)},${escapeCSV(
            row.appliedDisplay ??
              (row.matchLevel === 'unresolved' ? 'logged - unit not comparable' : 'not logged'),
          )},${row.matchLevel ?? '-'}`,
        );
      });
      rows.push(
        'Note: verified = applied records logged from this plan item; approximate = matched by product name only - never presented as verified.',
      );
      rows.push('');
    }
  } else if (perPlot.rows.length > 0 || perPlot.rateOnly.length > 0) {
    rows.push('APPLIED QUANTITIES - PER ACRE');
    rows.push('Unavailable: farm area is missing or invalid - never divided by a guess.');
    rows.push('');
  }

  if (perLiter.rows.length > 0) {
    rows.push(
      `PER LITER OF WATER (spray concentration, weighted by water volume; based on ${perLiter.sprayEventsWithWater} of ${perLiter.sprayEventsTotal} spray events with logged water)`,
    );
    rows.push('Product,Concentration,Events');
    perLiter.rows.forEach((row) => {
      rows.push(`${escapeCSV(row.name)},${escapeCSV(row.display)},${row.eventCount}`);
    });
    rows.push('');
  }
}

/**
 * Generate CSV content from report data
 */
export function generateCSV(
  data: ReportData,
  reportType: ReportType,
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): string {
  const rows: string[] = [];
  const visibleSections = getVisibleSections(reportType);
  const areaUnitLabel = areaUnit === 'hectares' ? 'hectares' : 'acres';
  const pushEmptySection = (title: string) => {
    rows.push(title);
    rows.push(EMPTY_SECTION_TEXT);
    rows.push('');
  };
  const matchedStockRows = data.stock.filter((row) => row.matchStrategy !== 'unmatched');
  const unmatchedStockRows = data.stock.filter((row) => row.matchStrategy === 'unmatched');

  // Header
  rows.push(`Farm Report - ${data.farmName}`);
  rows.push(`Report Type: ${formatReportType(reportType)}`);
  rows.push(`Region: ${data.farmRegion}`);
  // farm.area is stored as the raw number typed under the user's area-unit
  // preference — print it verbatim with its label. Converting "from acres"
  // here contradicted the per-acre lens heading on hectare farms.
  rows.push(`Area: ${data.farmArea} ${areaUnitLabel}`);
  rows.push(`Date Range: ${formatDate(data.dateRange.from)} to ${formatDate(data.dateRange.to)}`);
  rows.push(`Season: ${formatSeasonContextLabel(data.seasonContext)}`);
  if (data.seasonContext?.mode === 'season') {
    rows.push(
      `Season Window: ${data.seasonContext.seasonStart ? formatDate(data.seasonContext.seasonStart) : '-'} to ${data.seasonContext.seasonEnd ? formatDate(data.seasonContext.seasonEnd) : 'Active'}`,
    );
  }
  rows.push(
    `Generated: ${formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}`,
  );
  rows.push('');

  if (visibleSections.has('fpc-activity')) {
    appendFpcActivityCSV(rows, data.fpcActivity ?? [], fpcColumns);
  }

  if (visibleSections.has('irrigation')) {
    if (data.irrigation.length === 0) {
      pushEmptySection('IRRIGATION RECORDS');
    } else {
      rows.push(`IRRIGATION RECORDS (${data.irrigation.length})`);
      rows.push(`Date,Days After Pruning,Season,Duration (hrs),Growth Stage,Moisture Status,Notes`);
      data.irrigation.forEach((r) => {
        rows.push(
          `${escapeCSV(r.date)},${formatDaysAfterPruningValue(r.daysAfterPruning)},${escapeCSV(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${r.duration},${escapeCSV(r.growthStage)},${escapeCSV(r.moistureStatus)},${escapeCSV(r.notes || '')}`,
        );
      });
      rows.push('');
    }
  }

  if (visibleSections.has('spray')) {
    if (data.spray.length === 0) {
      pushEmptySection('SPRAY RECORDS');
    } else {
      rows.push(`SPRAY RECORDS (${data.spray.length})`);
      rows.push(`Date,Days After Pruning,Season,Chemical,Dose,Operator,Notes`);
      data.spray.forEach((r) => {
        rows.push(
          `${escapeCSV(r.date)},${formatDaysAfterPruningValue(r.daysAfterPruning)},${escapeCSV(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${escapeCSV(r.chemical)},${escapeCSV(r.dose)},${escapeCSV(r.operator)},${escapeCSV(r.notes || '')}`,
        );
      });
      rows.push('');
    }
  }

  if (visibleSections.has('fertigation')) {
    if (data.fertigation.length === 0) {
      pushEmptySection('FERTIGATION RECORDS');
    } else {
      rows.push(`FERTIGATION RECORDS (${data.fertigation.length})`);
      rows.push(`Date,Days After Pruning,Season,Fertilizers,Notes`);
      data.fertigation.forEach((r) => {
        rows.push(
          `${escapeCSV(r.date)},${formatDaysAfterPruningValue(r.daysAfterPruning)},${escapeCSV(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${escapeCSV(r.fertilizers)},${escapeCSV(r.notes || '')}`,
        );
      });
      rows.push('');
    }
  }

  if (visibleSections.has('harvest')) {
    if (data.harvest.length === 0) {
      pushEmptySection('HARVEST RECORDS');
    } else {
      rows.push(`HARVEST RECORDS (${data.harvest.length})`);
      rows.push('Date,Days After Pruning,Season,Quantity (kg),Grade,Price,Buyer,Notes');
      data.harvest.forEach((r) => {
        rows.push(
          `${escapeCSV(r.date)},${formatDaysAfterPruningValue(r.daysAfterPruning)},${escapeCSV(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${r.quantity},${escapeCSV(r.grade)},${r.price ?? ''},${escapeCSV(r.buyer || '')},${escapeCSV(r.notes || '')}`,
        );
      });
      rows.push('');
    }
  }

  if (visibleSections.has('expense')) {
    if (data.expense.length === 0) {
      pushEmptySection('EXPENSE RECORDS');
    } else {
      rows.push(`EXPENSE RECORDS (${data.expense.length})`);
      rows.push('Date,Days After Pruning,Season,Type,Cost,Remarks');
      data.expense.forEach((r) => {
        rows.push(
          `${escapeCSV(r.date)},${formatDaysAfterPruningValue(r.daysAfterPruning)},${escapeCSV(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${escapeCSV(r.type)},${r.cost},${escapeCSV(r.remarks || '')}`,
        );
      });
      rows.push('');
    }
  }

  if (visibleSections.has('stock')) {
    if (matchedStockRows.length === 0) {
      pushEmptySection('STOCK USAGE SUMMARY');
    } else {
      rows.push(`STOCK USAGE SUMMARY (Matched ${matchedStockRows.length} of ${data.stock.length})`);
      rows.push(
        'Item,Type,Total Quantity Used,Unit,Total Area Treated,Usage Count,Current Stock,Estimated Opening Stock,Estimated Consumed %,Match',
      );
      matchedStockRows.forEach((r) => {
        rows.push(
          `${escapeCSV(r.itemName)},${r.type},${r.quantityUsed},${r.unit},${r.areaTreated},${r.usageCount},${r.currentStockQuantity ?? ''},${r.estimatedOpeningStockQuantity ?? ''},${r.estimatedConsumedPercent ?? ''},${r.matchStrategy ?? ''}`,
        );
      });
      rows.push('');
    }
    if (unmatchedStockRows.length > 0) {
      rows.push(`UNMATCHED LOG ITEMS (${unmatchedStockRows.length})`);
      rows.push('Item,Type,Total Quantity Used,Unit,Total Area Treated,Usage Count,Reason');
      unmatchedStockRows.forEach((r) => {
        rows.push(
          `${escapeCSV(r.itemName)},${r.type},${r.quantityUsed},${r.unit},${r.areaTreated},${r.usageCount},No warehouse match or missing water volume`,
        );
      });
      rows.push('');
    }

    if (data.usage) {
      appendUsageLensesCSV(rows, data.usage);
    }
  }

  if (visibleSections.has('nutrient-ledger') && data.nutrientLedger) {
    appendNutrientLedgerCSV(rows, data.nutrientLedger);
  }

  return rows.join('\n');
}
