import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  copyAsync,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import {
  ReportData,
  ReportSummary,
  ReportType,
  FpcColumnOptions,
  FPC_LEAN_COLUMNS,
} from '../../types/report';
import { getDefaultCurrency } from '@/i18n/currency';
import type { AreaUnitPreference } from '@/utils/preferences';
import { generateCSV } from './report-csv';
import { generatePDFHtml } from './report-pdf';
import { generateFpcWorkbook, XLSX_MIME } from './report-xlsx';

const REPORTS_DIR_NAME = 'reports';

function sanitizeFileNamePart(value: string, fallback: string = 'farm'): string {
  const sanitized = Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return sanitized || fallback;
}

function buildReportFileName(farmName: string, extension: 'csv' | 'pdf' | 'xlsx'): string {
  const safeFarmName = sanitizeFileNamePart(farmName);
  const timestamp = Date.now();
  return `${safeFarmName}_report_${new Date().toISOString().split('T')[0]}_${timestamp}.${extension}`;
}

async function writeWorkbook(data: ReportData, directory: string): Promise<string> {
  const filename = buildReportFileName(data.farmName, 'xlsx');
  const fileUri = joinUri(directory, filename);
  const workbook = generateFpcWorkbook(data);
  await writeAsStringAsync(fileUri, workbook, { encoding: EncodingType.Base64 });
  return fileUri;
}

export async function exportXLSX(data: ReportData): Promise<void> {
  if (!cacheDirectory) throw new Error('Cache directory is not available on this device');
  const fileUri = await writeWorkbook(data, cacheDirectory);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: XLSX_MIME,
    dialogTitle: 'Export Activity Register',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

export async function downloadXLSX(data: ReportData): Promise<string> {
  return writeWorkbook(data, await ensureReportsDirectory());
}

function joinUri(base: string, filename: string): string {
  return base.endsWith('/') ? `${base}${filename}` : `${base}/${filename}`;
}

async function ensureReportsDirectory(): Promise<string> {
  const baseDir = documentDirectory ?? cacheDirectory;
  if (!baseDir) {
    throw new Error('No writable directory is available on this device');
  }

  const reportsDir = joinUri(baseDir, REPORTS_DIR_NAME);
  const info = await getInfoAsync(reportsDir);
  if (!info.exists) {
    await makeDirectoryAsync(reportsDir, { intermediates: true });
  }
  return reportsDir;
}

/**
 * Export report as CSV file
 */
export async function exportCSV(
  data: ReportData,
  reportType: ReportType,
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): Promise<void> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available on this device');
  }
  const csv = generateCSV(data, reportType, areaUnit, fpcColumns);
  const filename = buildReportFileName(data.farmName, 'csv');
  const fileUri = joinUri(cacheDirectory, filename);
  try {
    await writeAsStringAsync(fileUri, csv);
  } catch (error) {
    const safeFarmName = sanitizeFileNamePart(data.farmName);
    throw new Error(
      `Failed to write report file (${filename}) for farm: ${safeFarmName}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Report',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

/**
 * Download report as CSV file
 */
export async function downloadCSV(
  data: ReportData,
  reportType: ReportType,
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): Promise<string> {
  const csv = generateCSV(data, reportType, areaUnit, fpcColumns);
  const filename = buildReportFileName(data.farmName, 'csv');
  const reportsDirectory = await ensureReportsDirectory();
  const fileUri = joinUri(reportsDirectory, filename);

  try {
    await writeAsStringAsync(fileUri, csv);
  } catch (error) {
    const safeFarmName = sanitizeFileNamePart(data.farmName);
    throw new Error(
      `Failed to write report file (${filename}) for farm: ${safeFarmName}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return fileUri;
}

/**
 * Export report as PDF file
 */
export async function exportPDF(
  data: ReportData,
  summary: ReportSummary,
  reportType: ReportType,
  preferredCurrency: string = getDefaultCurrency(),
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): Promise<void> {
  const html = generatePDFHtml(data, summary, reportType, preferredCurrency, areaUnit, fpcColumns);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export Report',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

/**
 * Download report as PDF file
 */
export async function downloadPDF(
  data: ReportData,
  summary: ReportSummary,
  reportType: ReportType,
  preferredCurrency: string = getDefaultCurrency(),
  areaUnit: AreaUnitPreference = 'acres',
  fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
): Promise<string> {
  const html = generatePDFHtml(data, summary, reportType, preferredCurrency, areaUnit, fpcColumns);

  const { uri: tempUri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const filename = buildReportFileName(data.farmName, 'pdf');
  const reportsDirectory = await ensureReportsDirectory();
  const destinationUri = joinUri(reportsDirectory, filename);

  try {
    await copyAsync({ from: tempUri, to: destinationUri });
  } finally {
    deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  }
  return destinationUri;
}
