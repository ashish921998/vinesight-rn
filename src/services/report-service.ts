/**
 * Report Service for Vinesight
 * Handles report generation for CSV and PDF exports
 *
 * Thin facade over the `src/services/report/` module group. The actual
 * implementation lives in the focused submodules:
 *   - report-format   leaf helpers (escaping, season/format labels, filters)
 *   - report-units    unit/quantity normalization helpers
 *   - report-compute  data + summary + preview generation
 *   - report-csv      CSV rendering
 *   - report-pdf      PDF HTML rendering
 *   - report-io       file export/download (expo-print / expo-sharing / expo-file-system)
 *
 * This file preserves the historical `ReportService` static-class surface so
 * existing callers (`use-reports.ts`, tests) keep working unchanged.
 */

import * as compute from './report/report-compute';
import * as csv from './report/report-csv';
import * as pdf from './report/report-pdf';
import * as io from './report/report-io';
import * as fmt from './report/report-format';

export type { FpcReportLookups } from './report/report-types';

export class ReportService {
  static filterByDateRange = fmt.filterByDateRange;
  static generateReportData = compute.generateReportData;
  static calculateSummary = compute.calculateSummary;
  static generatePreview = compute.generatePreview;
  static generateCSV = csv.generateCSV;
  static generatePDFHtml = pdf.generatePDFHtml;
  static exportCSV = io.exportCSV;
  static downloadCSV = io.downloadCSV;
  static exportPDF = io.exportPDF;
  static downloadPDF = io.downloadPDF;
  static exportXLSX = io.exportXLSX;
  static downloadXLSX = io.downloadXLSX;
}
