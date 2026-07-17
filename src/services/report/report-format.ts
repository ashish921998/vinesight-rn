import {
  DateRange,
  ReportType,
  ReportSectionKey,
  ReportSeasonContext,
  FpcColumnOptions,
  getSectionsForReportType,
} from '../../types/report';
import { SprayRecord, SprayChemicalItem } from '../../types/database';
import type { Measure } from '@/lib/quantity';
import { normalizeProductName } from '../report-usage-lenses';

export const EMPTY_SECTION_TEXT = 'No records in selected range';

/**
 * Escape a value for CSV output.
 * Guards against formula injection by prefixing cells that start with
 * characters Excel/Google Sheets would interpret as formulas.
 */
export function escapeCSV(value: string): string {
  let safe = value;
  if (safe.length > 0 && /^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Escape a value for safe HTML interpolation.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Filter records by date range.
 * Uses ISO string comparison (YYYY-MM-DD) to avoid timezone drift
 * that occurs when parsing date-only strings as UTC Date objects.
 */
export function filterByDateRange<T extends { date: string }>(
  records: T[],
  dateRange: DateRange,
): T[] {
  const from = dateRange.from; // YYYY-MM-DD
  const to = dateRange.to; // YYYY-MM-DD

  return records.filter((record) => {
    const recordDate = record.date.slice(0, 10); // normalize timestamps to YYYY-MM-DD
    return recordDate >= from && recordDate <= to;
  });
}

export function sortRecordsByDateDesc<T extends { date: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const aTs = new Date(a.date).getTime();
    const bTs = new Date(b.date).getTime();
    return bTs - aTs;
  });
}

export function getVisibleSections(reportType: ReportType): Set<ReportSectionKey> {
  return new Set(getSectionsForReportType(reportType));
}

export function formatReportType(reportType: ReportType): string {
  switch (reportType) {
    case 'operations':
      return 'Operations';
    case 'financial':
      return 'Financial';
    case 'stock-usage':
      return 'Stock Usage';
    case 'fpc-activity':
      return 'FPC Activity Register';
    case 'comprehensive':
    default:
      return 'Comprehensive';
  }
}

export function resolveSeasonName(
  seasonId: number | null | undefined,
  seasonNameById?: Record<number, string>,
): string | null {
  if (seasonId == null) return null;
  return seasonNameById?.[seasonId] ?? `Season ${seasonId}`;
}

export function resolveSeasonWindow(
  seasonId: number | null | undefined,
  seasonWindowById?: Record<number, string>,
): string | null {
  if (seasonId == null) return null;
  return seasonWindowById?.[seasonId] ?? null;
}

export function formatSeasonContextLabel(seasonContext?: ReportSeasonContext): string {
  if (!seasonContext || seasonContext.mode === 'all') {
    return 'All seasons';
  }
  if (seasonContext.seasonName && seasonContext.seasonName.trim().length > 0) {
    return seasonContext.seasonName;
  }
  if (seasonContext.seasonId != null) {
    return `Season ${seasonContext.seasonId}`;
  }
  return 'Selected season';
}

export function formatSeasonCell(
  seasonContext: ReportSeasonContext | undefined,
  seasonId: number | null | undefined,
  seasonName: string | null | undefined,
  seasonWindow: string | null | undefined,
): string {
  if (seasonContext?.mode === 'all') {
    if (seasonWindow && seasonWindow.trim().length > 0) return seasonWindow;
    return '-';
  }
  if (seasonName && seasonName.trim().length > 0) return seasonName;
  if (seasonId != null) return `Season ${seasonId}`;
  return '-';
}

export function formatDaysAfterPruningValue(daysAfterPruning: number | null | undefined): string {
  if (daysAfterPruning == null || !Number.isFinite(daysAfterPruning)) return '-';
  return String(daysAfterPruning);
}

export function formatDaysAfterPruningTag(daysAfterPruning: number | null | undefined): string {
  if (daysAfterPruning == null || !Number.isFinite(daysAfterPruning)) return '-';
  return `${daysAfterPruning}d`;
}

export function resolveSprayChemicalLabel(record: SprayRecord): string {
  const chemicalItems = (record.chemical_items ?? []) as SprayChemicalItem[];
  const names = chemicalItems.map((item) => item.name?.trim()).filter(Boolean);
  if (names.length > 0) return names.join(', ');
  return record.chemical?.trim() || 'N/A';
}

export function resolveSprayDoseLabel(record: SprayRecord): string {
  const chemicalItems = (record.chemical_items ?? []) as SprayChemicalItem[];
  const dosageItems = chemicalItems
    .filter(
      (item) =>
        item.name?.trim() &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        item.unit?.trim(),
    )
    .map((item) => {
      const quantityBasis = item.quantity_basis ?? 'total';
      const normalizedUnit = item.unit.trim();
      const needsPerAcreSuffix =
        quantityBasis === 'per_acre' && !normalizedUnit.toLowerCase().includes('/acre');
      return `${item.quantity} ${normalizedUnit}${needsPerAcreSuffix ? '/acre' : ''}`;
    });

  const waterMatch = record.dose?.match(/Water:\s*([0-9]+(?:\.[0-9]+)?)\s*L/i);
  const waterLabel = waterMatch?.[1] ? `Water: ${waterMatch[1]}L` : null;

  if (dosageItems.length > 0 && waterLabel) {
    return `${dosageItems.join(', ')}; ${waterLabel}`;
  }
  if (dosageItems.length > 0) {
    return dosageItems.join(', ');
  }
  return record.dose?.trim() || 'N/A';
}

export function normalizeName(value: string): string {
  // One normalization rule, shared with the lens compliance matcher —
  // divergence here would split stock rows from compliance rows.
  return normalizeProductName(value);
}

/**
 * Area for section headings. Hectare-preference farms convert to a long
 * float (2 ha → 4.942108…) — round at render like every other lens figure.
 */
export function formatAreaAcres(area: number | null): string {
  return area == null ? '-' : String(Number(area.toFixed(2)));
}

/** Stock-usage row label for a kernel measure (kept from the pre-kernel vocabulary). */
export function measureUnitLabel(measure: Measure): string {
  return measure === 'mass' ? 'kg' : measure === 'volume' ? 'liter' : 'unit';
}

/**
 * Count of enabled optional PRODUCT-level columns (technical name, PHI, safe
 * harvest, MRL). Irrigation is a DAY-level column and is deliberately
 * excluded. Shared by the CSV and PDF renderers so the header, product cells
 * and the blank-row padding for a product-less day can never drift apart.
 */
export function countFpcProductOptionalCols(cols: FpcColumnOptions): number {
  return (
    (cols.technicalName ? 1 : 0) +
    (cols.phi ? 1 : 0) +
    (cols.safeHarvest ? 1 : 0) +
    (cols.mrl ? 1 : 0)
  );
}
