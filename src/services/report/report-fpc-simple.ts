import type { FpcActivityDayRow } from '../../types/report';
import { formatDaysAfterPruningValue } from './report-format';

/**
 * Fratelli's fixed eight-column buyer register. The columns, their order, and
 * the "blank the serial / day-count / date cells on a product's continuation
 * rows" rule are fixed by the buyer's own Excel template. They live here once —
 * the CSV, XLSX and PDF emitters all read from this model rather than
 * re-deriving the serial logic and header list in each file.
 */
export const FPC_SIMPLE_HEADERS = [
  'Sr.No',
  'Days',
  'Date',
  'Product Name',
  'Technical Name',
  'Qty Per Liter',
  'PHI',
  'MRL',
] as const;

export interface FpcSimpleRow {
  /** Serial number, only on each day's first product row. */
  srNo: string;
  /** Days after pruning, only on each day's first product row. */
  days: string;
  /** Day's ISO date, only on each day's first product row. */
  date: string;
  productName: string;
  technicalName: string;
  qtyPerLiter: string;
  phi: string;
  mrl: string;
  /** True on the first product row of a day — used for day-group styling. */
  lead: boolean;
}

/**
 * Cell values for one simple-register row, in header order. The CSV, XLSX and
 * PDF emitters all read from this so the column order is owned in one place
 * alongside FPC_SIMPLE_HEADERS — each emitter only escapes for its own target.
 */
export function fpcSimpleRowCells(row: FpcSimpleRow): string[] {
  return [
    row.srNo,
    row.days,
    row.date,
    row.productName,
    row.technicalName,
    row.qtyPerLiter,
    row.phi,
    row.mrl,
  ];
}

/**
 * Flatten FPC activity days into one row per product, stamping the serial /
 * day-count / date onto the first product of each day and blanking them on the
 * rest. Values are raw and format-agnostic — each emitter escapes for its own
 * target (CSV / HTML / XML).
 */
export function buildFpcSimpleRows(days: readonly FpcActivityDayRow[]): FpcSimpleRow[] {
  const rows: FpcSimpleRow[] = [];
  let serial = 0;
  for (const day of days) {
    if (day.products.length > 0) serial += 1;
    day.products.forEach((product, index) => {
      const lead = index === 0;
      rows.push({
        srNo: lead ? String(serial) : '',
        days: lead ? formatDaysAfterPruningValue(day.daysAfterPruning) : '',
        date: lead ? day.date : '',
        productName: product.marketName,
        technicalName: product.technicalName ?? '',
        qtyPerLiter: product.asLogged,
        phi: product.phiDays != null ? String(product.phiDays) : '',
        mrl: product.mrl ?? '',
        lead,
      });
    });
  }
  return rows;
}
