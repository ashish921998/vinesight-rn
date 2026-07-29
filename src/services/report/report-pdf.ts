import {
  ReportData,
  ReportSummary,
  ReportType,
  FpcColumnOptions,
  FPC_LEAN_COLUMNS,
  isFpcSimpleReport,
} from '../../types/report';
import { formatDate, formatCurrency } from '@/i18n/format';
import { getDefaultCurrency } from '@/i18n/currency';
import type { AreaUnitPreference } from '@/utils/preferences';
import { format as formatQuantity } from '@/lib/quantity';
import {
  escapeHtml,
  getVisibleSections,
  formatReportType,
  formatSeasonContextLabel,
  formatSeasonCell,
  formatDaysAfterPruningValue,
  formatDaysAfterPruningTag,
  formatAreaAcres,
  countFpcProductOptionalCols,
  EMPTY_SECTION_TEXT,
} from './report-format';
import { FPC_SIMPLE_HEADERS, buildFpcSimpleRows } from './report-fpc-simple';

/**
 * Generate PDF HTML content
 */
export function generatePDFHtml(
  data: ReportData,
  summary: ReportSummary,
  reportType: ReportType,
  preferredCurrency: string = getDefaultCurrency(),
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): string {
  const visibleSections = getVisibleSections(reportType, fpcColumns);
  const maxRowsPerSection = 20;
  const areaUnitLabel = areaUnit === 'hectares' ? 'hectares' : 'acres';
  const matchedStockRows = data.stock.filter((row) => row.matchStrategy !== 'unmatched');
  const unmatchedStockRows = data.stock.filter((row) => row.matchStrategy === 'unmatched');

  const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { color: #1a5d1a; margin-bottom: 10px; }
        h2 { color: #333; margin-top: 25px; border-bottom: 2px solid #1a5d1a; padding-bottom: 5px; }
        .header { margin-bottom: 20px; }
        .meta { color: #666; font-size: 14px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .summary-item { padding: 10px; background: white; border-radius: 4px; }
        .summary-value { font-size: 20px; font-weight: bold; color: #1a5d1a; }
        .summary-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background: #1a5d1a; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .profit { color: #16a34a; }
        .loss { color: #dc2626; }
        .empty-section { color: #666; font-style: italic; margin: 10px 0 0; }
        tr.fpc-day-start td { border-top: 2px solid #1a5d1a; }
        .more-records { color: #666; font-size: 12px; margin-top: 6px; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
      </style>
    `;

  const summaryItems = [
    {
      label: 'Total Records',
      value: String(summary.totalRecords),
      className: '',
    },
    ...(visibleSections.has('stock')
      ? [
          {
            label: 'Unique Stock Items Used',
            value: String(summary.stockUsageCount),
            className: '',
          },
        ]
      : []),
    ...(visibleSections.has('irrigation') ||
    visibleSections.has('spray') ||
    visibleSections.has('fertigation') ||
    visibleSections.has('harvest')
      ? [
          {
            label: 'Total Harvest',
            value: `${summary.totalHarvest} kg`,
            className: '',
          },
        ]
      : []),
    ...(visibleSections.has('harvest') && visibleSections.has('expense')
      ? [
          {
            label: 'Revenue',
            value: formatCurrency(summary.totalRevenue, preferredCurrency, {
              minimumFractionDigits: 0,
            }),
            className: '',
          },
        ]
      : []),
    ...(visibleSections.has('expense')
      ? [
          {
            label: 'Expenses',
            value: formatCurrency(summary.totalExpenses, preferredCurrency, {
              minimumFractionDigits: 0,
            }),
            className: '',
          },
        ]
      : []),
    ...(visibleSections.has('harvest') && visibleSections.has('expense')
      ? [
          {
            label: 'Net Profit',
            value: formatCurrency(summary.netProfit, preferredCurrency, {
              minimumFractionDigits: 0,
            }),
            className: summary.netProfit >= 0 ? 'profit' : 'loss',
          },
        ]
      : []),
  ];

  const header =
    reportType === 'fpc-activity'
      ? `
        <div class="header">
          <h1>${escapeHtml(data.farmName)}</h1>
          <p class="meta">
            Farmer Name: ${escapeHtml(data.farmName)}<br>
            Variety: ${escapeHtml(data.farmVariety ?? '-')}<br>
            Pruning Date: ${data.pruningDate ? formatDate(data.pruningDate) : '-'}
          </p>
        </div>
      `
      : `
        <div class="header">
          <h1>🍇 ${escapeHtml(data.farmName)}</h1>
          <p class="meta">
            Report Type: ${escapeHtml(formatReportType(reportType))}<br>
            Region: ${escapeHtml(data.farmRegion)} | Area: ${data.farmArea} ${areaUnitLabel}<br>
            Report Period: ${formatDate(data.dateRange.from)} to ${formatDate(data.dateRange.to)}<br>
            Season: ${escapeHtml(formatSeasonContextLabel(data.seasonContext))}
            ${
              data.seasonContext?.mode === 'season'
                ? `<br>Season Window: ${data.seasonContext.seasonStart ? formatDate(data.seasonContext.seasonStart) : '-'} to ${data.seasonContext.seasonEnd ? formatDate(data.seasonContext.seasonEnd) : 'Active'}`
                : ''
            }
          </p>
        </div>
      `;
  const summaryMarkup =
    reportType === 'fpc-activity'
      ? ''
      : `
        <div class="summary">
          <h3 style="margin-top: 0;">Summary</h3>
          <div class="summary-grid">
            ${summaryItems
              .map(
                (item) =>
                  `<div class="summary-item"><div class="summary-value ${item.className}">${item.value}</div><div class="summary-label">${item.label}</div></div>`,
              )
              .join('')}
          </div>
        </div>
      `;

  let html = `
      <!DOCTYPE html>
      <html>
      <head>${styles}</head>
      <body>
        ${header}
        ${summaryMarkup}
    `;

  const appendSectionTable = (
    title: string,
    headers: string[],
    rowMarkup: string[],
    hiddenCount: number = 0,
  ) => {
    html += `<h2>${title}</h2>`;
    if (rowMarkup.length === 0) {
      html += `<p class="empty-section">${EMPTY_SECTION_TEXT}</p>`;
      return;
    }
    html += `
        <table>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          ${rowMarkup.join('')}
        </table>
        ${hiddenCount > 0 ? `<p class="more-records">... and ${hiddenCount} more records</p>` : ''}
      `;
  };

  if (visibleSections.has('fpc-activity')) {
    // No row cap: the register exists for buyer/FPC audits, which need the
    // full window — truncation would silently misrepresent the season.
    const days = data.fpcActivity ?? [];
    const productCount = days.reduce((sum, day) => sum + day.products.length, 0);
    html += `<h2>📋 FPC Activity Register (${days.length} days, ${productCount} product applications)</h2>`;
    if (days.length === 0) {
      html += `<p class="empty-section">${EMPTY_SECTION_TEXT}</p>`;
    } else {
      const cols = fpcColumns;
      const simple = isFpcSimpleReport(cols);
      const headers = simple
        ? [...FPC_SIMPLE_HEADERS]
        : [
            'Date',
            'Day',
            ...(cols.irrigation ? ['Irrigation (hrs)', 'Water (mm)'] : []),
            'Stage',
            'Market Name',
            ...(cols.technicalName ? ['Technical Name'] : []),
            'Qty/Acre',
            'Total Qty/Plot',
            ...(cols.phi ? ['PHI (days)'] : []),
            ...(cols.safeHarvest ? ['Safe Harvest'] : []),
            ...(cols.mrl ? ['MRL'] : []),
            'Details',
          ];
      // Product-level column count: 3 fixed PDF product columns (Market,
      // Qty/Acre, Total) plus enabled optionals — derived from the same flags
      // as the header/cells so a day with no products fills the right width.
      const productColCount = 3 + countFpcProductOptionalCols(cols);
      const cell = (value: string | null | undefined) =>
        `<td>${escapeHtml(value ?? '') || '-'}</td>`;
      const bodyRows = simple
        ? buildFpcSimpleRows(days)
            .map(
              (row) =>
                `<tr class="${row.lead ? 'fpc-day-start' : ''}">${cell(row.srNo)}${cell(row.days)}${cell(row.date)}${cell(row.productName)}${cell(row.technicalName)}${cell(row.qtyPerLiter)}${cell(row.phi)}${cell(row.mrl)}</tr>`,
            )
            .join('')
        : days
            .map((day) => {
              const span = Math.max(1, day.products.length);
              const dayCells =
                `<td rowspan="${span}">${escapeHtml(day.date)}</td>` +
                `<td rowspan="${span}">${formatDaysAfterPruningValue(day.daysAfterPruning)}</td>` +
                (cols.irrigation
                  ? `<td rowspan="${span}">${day.irrigationHours ?? '-'}</td>` +
                    `<td rowspan="${span}">${day.waterMm ?? '-'}</td>`
                  : '') +
                `<td rowspan="${span}">${escapeHtml(day.growthStage ?? '') || '-'}</td>`;
              const notesCell = `<td rowspan="${span}">${escapeHtml(day.notes ?? '') || '-'}</td>`;
              if (day.products.length === 0) {
                return `<tr class="fpc-day-start">${dayCells}${'<td>-</td>'.repeat(productColCount)}${notesCell}</tr>`;
              }
              return day.products
                .map((product, index) => {
                  const productCells =
                    cell(product.marketName) +
                    (cols.technicalName ? cell(product.technicalName) : '') +
                    // Qty/Acre and Total fall back to the verbatim entry so an
                    // unresolvable unit is still visible, marked as-logged.
                    cell(product.qtyPerAcreDisplay ?? `${product.asLogged} (as logged)`) +
                    cell(product.totalQtyDisplay ?? `${product.asLogged} (as logged)`) +
                    (cols.phi
                      ? `<td>${product.phiDays != null ? product.phiDays : '-'}</td>`
                      : '') +
                    (cols.safeHarvest ? cell(product.safeHarvestDate) : '') +
                    (cols.mrl ? cell(product.mrl) : '');
                  return index === 0
                    ? `<tr class="fpc-day-start">${dayCells}${productCells}${notesCell}</tr>`
                    : `<tr>${productCells}</tr>`;
                })
                .join('');
            })
            .join('');
      html += `
          <table>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
            ${bodyRows}
          </table>
        `;
    }
  }

  if (visibleSections.has('irrigation')) {
    const visibleRows = data.irrigation.slice(0, maxRowsPerSection);
    appendSectionTable(
      `💧 Irrigation Records (${data.irrigation.length})`,
      ['Date', 'DAP', 'Season', 'Duration', 'Growth Stage'],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.date)}</td><td>${formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${escapeHtml(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${r.duration}h</td><td>${escapeHtml(r.growthStage)}</td></tr>`,
      ),
      Math.max(0, data.irrigation.length - maxRowsPerSection),
    );
  }

  if (visibleSections.has('spray')) {
    const visibleRows = data.spray.slice(0, maxRowsPerSection);
    appendSectionTable(
      `🧪 Spray Records (${data.spray.length})`,
      ['Date', 'DAP', 'Season', 'Chemical', 'Dose'],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.date)}</td><td>${formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${escapeHtml(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${escapeHtml(r.chemical)}</td><td>${escapeHtml(r.dose)}</td></tr>`,
      ),
      Math.max(0, data.spray.length - maxRowsPerSection),
    );
  }

  if (visibleSections.has('fertigation')) {
    const visibleRows = data.fertigation.slice(0, maxRowsPerSection);
    appendSectionTable(
      `🧴 Fertigation Records (${data.fertigation.length})`,
      ['Date', 'DAP', 'Season', 'Fertilizers'],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.date)}</td><td>${formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${escapeHtml(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${escapeHtml(r.fertilizers)}</td></tr>`,
      ),
      Math.max(0, data.fertigation.length - maxRowsPerSection),
    );
  }

  if (visibleSections.has('harvest')) {
    const visibleRows = data.harvest.slice(0, maxRowsPerSection);
    appendSectionTable(
      `🍇 Harvest Records (${data.harvest.length})`,
      ['Date', 'DAP', 'Season', 'Quantity', 'Grade', 'Price', 'Buyer'],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.date)}</td><td>${formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${escapeHtml(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${r.quantity} kg</td><td>${escapeHtml(r.grade)}</td><td>${r.price ? formatCurrency(r.price, preferredCurrency, { minimumFractionDigits: 0 }) : '-'}</td><td>${escapeHtml(r.buyer || '-')}</td></tr>`,
      ),
      Math.max(0, data.harvest.length - maxRowsPerSection),
    );
  }

  if (visibleSections.has('expense')) {
    const visibleRows = data.expense.slice(0, maxRowsPerSection);
    appendSectionTable(
      `💰 Expense Records (${data.expense.length})`,
      ['Date', 'DAP', 'Season', 'Type', 'Cost', 'Remarks'],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.date)}</td><td>${formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${escapeHtml(formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${escapeHtml(r.type)}</td><td>${formatCurrency(r.cost, preferredCurrency, { minimumFractionDigits: 0 })}</td><td>${escapeHtml(r.remarks || '-')}</td></tr>`,
      ),
      Math.max(0, data.expense.length - maxRowsPerSection),
    );
  }

  if (visibleSections.has('stock')) {
    const visibleRows = matchedStockRows.slice(0, maxRowsPerSection);
    appendSectionTable(
      `📦 Stock Usage Summary (Matched ${matchedStockRows.length} of ${data.stock.length})`,
      [
        'Item',
        'Type',
        'Total Qty',
        'Unit',
        'Area Treated',
        'Count',
        'Current Stock',
        'Estimated Opening',
        'Estimated Consumed %',
        'Match',
      ],
      visibleRows.map(
        (r) =>
          `<tr><td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.type)}</td><td>${r.quantityUsed}</td><td>${escapeHtml(r.unit)}</td><td>${r.areaTreated}</td><td>${r.usageCount}</td><td>${r.currentStockQuantity ?? '-'}</td><td>${r.estimatedOpeningStockQuantity ?? '-'}</td><td>${r.estimatedConsumedPercent != null ? `${r.estimatedConsumedPercent}%` : '-'}</td><td>${escapeHtml(r.matchStrategy ?? '-')}</td></tr>`,
      ),
      Math.max(0, matchedStockRows.length - maxRowsPerSection),
    );
    if (unmatchedStockRows.length > 0) {
      const visibleUnmatchedRows = unmatchedStockRows.slice(0, maxRowsPerSection);
      appendSectionTable(
        `⚠️ Unmatched Log Items (${unmatchedStockRows.length})`,
        ['Item', 'Type', 'Total Qty', 'Unit', 'Area Treated', 'Count', 'Reason'],
        visibleUnmatchedRows.map(
          (r) =>
            `<tr><td>${escapeHtml(r.itemName)}</td><td>${escapeHtml(r.type)}</td><td>${r.quantityUsed}</td><td>${escapeHtml(r.unit)}</td><td>${r.areaTreated}</td><td>${r.usageCount}</td><td>No warehouse match or missing water volume</td></tr>`,
        ),
        Math.max(0, unmatchedStockRows.length - maxRowsPerSection),
      );
    }

    if (data.usage) {
      const { perPlot, perAcre, perLiter } = data.usage;

      if (perPlot.rows.length > 0) {
        appendSectionTable(
          '⚖️ Applied Quantities — Per Plot',
          ['Product', 'Type', 'Total Applied', 'Uses'],
          perPlot.rows.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.totals.map((figure) => figure.display).join(' · '))}</td><td>${r.usageCount}</td></tr>`,
          ),
        );
      }

      if (perPlot.other.length > 0) {
        appendSectionTable(
          'Other Products (unit not recognized — shown as logged)',
          ['Product', 'Type', 'Quantity As Logged', 'Uses'],
          perPlot.other.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
          ),
        );
      }

      if (perPlot.concentrationOnly.length > 0) {
        appendSectionTable(
          'Concentration-Only (water volume not logged)',
          ['Product', 'Type', 'Concentration As Logged', 'Uses'],
          perPlot.concentrationOnly.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
          ),
        );
      }

      if (perPlot.rateOnly.length > 0) {
        appendSectionTable(
          'Rate-Only (farm area unavailable)',
          ['Product', 'Type', 'Rate As Logged', 'Uses'],
          perPlot.rateOnly.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
          ),
        );
      }

      if (perAcre.available && perAcre.rows.length > 0) {
        appendSectionTable(
          `⚖️ Applied Quantities — Per Acre (farm area: ${formatAreaAcres(perAcre.areaAcres)} acres)`,
          ['Product', 'Type', 'Per Acre'],
          perAcre.rows.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.perAcre.map((figure) => figure.display).join(' · '))}</td></tr>`,
          ),
        );
      } else if (!perAcre.available && (perPlot.rows.length > 0 || perPlot.rateOnly.length > 0)) {
        html += `<h2>⚖️ Applied Quantities — Per Acre</h2><p class="empty-section">Unavailable: farm area is missing or invalid — never divided by a guess.</p>`;
      }

      if (perAcre.available && perAcre.compliance.length > 0) {
        appendSectionTable(
          '📋 Plan Compliance (prescribed vs applied, per acre)',
          ['Product', 'Prescribed', 'Applied', 'Match'],
          perAcre.compliance.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.prescribedDisplay)}</td><td>${escapeHtml(r.appliedDisplay ?? (r.matchLevel === 'unresolved' ? 'logged — unit not comparable' : 'not logged'))}</td><td>${escapeHtml(r.matchLevel ?? '-')}</td></tr>`,
          ),
        );
        html += `<p class="more-records">verified = applied records logged from this plan item; approximate = matched by product name only — never presented as verified.</p>`;
      }

      if (perLiter.rows.length > 0) {
        appendSectionTable(
          `💦 Per Liter of Water (spray concentration, weighted by water volume; based on ${perLiter.sprayEventsWithWater} of ${perLiter.sprayEventsTotal} spray events with logged water)`,
          ['Product', 'Concentration', 'Events'],
          perLiter.rows.map(
            (r) =>
              `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.display)}</td><td>${r.eventCount}</td></tr>`,
          ),
        );
      }
    }
  }

  if (visibleSections.has('nutrient-ledger') && data.nutrientLedger) {
    const ledger = data.nutrientLedger;
    if (ledger.rows.length > 0) {
      // Human-facing masses go through the kernel's scale picker (issue
      // #235): micronutrient totals are gram/milligram scale, and a raw
      // "0.0004" under a kg header reads as zero.
      const massCell = (kg: number | null | undefined): string =>
        kg != null && Number.isFinite(kg) ? formatQuantity(kg, 'mass') : '-';
      appendSectionTable(
        `🌱 Nutrient Ledger — Nutrients Applied (nutrients from ${ledger.coveragePercent}% of applied quantity)`,
        [
          'Element',
          'Elemental',
          'Elemental /acre',
          'Bag-grade',
          'Bag-grade qty',
          'Bag-grade /acre',
        ],
        ledger.rows.map(
          (r) =>
            `<tr><td>${escapeHtml(r.element)}</td><td>${massCell(r.elementalKg)}</td><td>${massCell(r.elementalKgPerAcre)}</td><td>${escapeHtml(r.oxideSymbol ?? '-')}</td><td>${massCell(r.oxideKg)}</td><td>${massCell(r.oxideKgPerAcre)}</td></tr>`,
        ),
      );
      html += `<p class="more-records">Elemental values match petiole/soil lab reports. Bag-grade (N-P₂O₅-K₂O) matches what is printed on fertilizer bags.</p>`;
    } else {
      // Same split as the CSV: no applications at all is a different truth
      // than applications whose composition is missing.
      html += `<h2>🌱 Nutrient Ledger — Nutrients Applied</h2><p class="empty-section">${
        ledger.itemCount === 0
          ? EMPTY_SECTION_TEXT
          : 'No composition data — nutrients cannot be calculated (coverage 0%).'
      }</p>`;
    }
  }

  html += `
        <div class="footer">
          Generated by Vinesight on ${formatDate(new Date(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </body>
      </html>
    `;

  return html;
}
