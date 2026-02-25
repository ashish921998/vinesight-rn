/**
 * Report Types for Vinesight
 * Types for report generation and export
 */

export type ReportFormat = 'pdf' | 'csv';
export type ReportType = 'operations' | 'financial' | 'comprehensive' | 'stock-usage';
export type ReportCompareMode = 'previous' | 'yoy';
export type ReportSectionKey =
  | 'meta'
  | 'executive'
  | 'irrigation'
  | 'spray'
  | 'fertigation'
  | 'harvest'
  | 'expense'
  | 'stock';

export const REPORT_SECTION_ORDER: ReportSectionKey[] = [
  'meta',
  'executive',
  'irrigation',
  'spray',
  'fertigation',
  'harvest',
  'expense',
  'stock',
];

const REPORT_TYPE_SECTION_MAP: Record<ReportType, ReportSectionKey[]> = {
  comprehensive: [
    'meta',
    'executive',
    'irrigation',
    'spray',
    'fertigation',
    'harvest',
    'expense',
    'stock',
  ],
  operations: ['meta', 'executive', 'irrigation', 'spray', 'fertigation', 'harvest'],
  financial: ['meta', 'executive', 'expense'],
  'stock-usage': ['meta', 'executive', 'stock'],
};

export function getSectionsForReportType(reportType: ReportType): ReportSectionKey[] {
  return [...REPORT_TYPE_SECTION_MAP[reportType]];
}

export interface DateRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;
}

export interface ReportCompareOptions {
  enabled: boolean;
  baselineSeasonId?: number;
  mode?: ReportCompareMode;
}

export interface ReportFilters {
  farmId: number | null;
  dateRange: DateRange;
  seasonId?: number;
  includeUnassigned?: boolean;
  compare?: ReportCompareOptions;
}

export interface ReportSeasonContext {
  mode: 'all' | 'season';
  seasonId?: number | null;
  seasonName?: string | null;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  includeUnassigned?: boolean;
}

export interface ExportOptions {
  farmId: number;
  dateRange: DateRange;
  includeTypes: ReportDataType[];
  format: ReportFormat;
  reportType: ReportType;
}

export type ReportDataType =
  | 'irrigation'
  | 'spray'
  | 'fertigation'
  | 'harvest'
  | 'expense'
  | 'stock';

export interface ReportData {
  farmName: string;
  farmArea: number;
  farmRegion: string;
  dateRange: DateRange;
  seasonContext?: ReportSeasonContext;
  irrigation: ReportIrrigationRecord[];
  spray: ReportSprayRecord[];
  fertigation: ReportFertigationRecord[];
  harvest: ReportHarvestRecord[];
  expense: ReportExpenseRecord[];
  stock: ReportStockUsageRecord[];
}

export interface ReportStockUsageRecord {
  itemName: string;
  type: 'fertilizer' | 'spray';
  quantityUsed: number;
  unit: string;
  areaTreated: number; // Total area this item was applied to
  cost?: number; // Estimated cost
  usageCount: number; // Number of times used
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  currentStockQuantity?: number | null;
  estimatedOpeningStockQuantity?: number | null;
  estimatedConsumedPercent?: number | null;
  matchStrategy?: 'warehouse_item_id' | 'catalog_product_id' | 'name_unit_fallback' | 'unmatched';
}

export interface ReportIrrigationRecord {
  date: string;
  daysAfterPruning?: number | null;
  seasonId?: number | null;
  seasonName?: string | null;
  seasonWindow?: string | null;
  duration: number;
  area: number;
  growthStage: string;
  moistureStatus: string;
  systemDischarge: number;
  notes?: string;
}

export interface ReportSprayRecord {
  date: string;
  daysAfterPruning?: number | null;
  seasonId?: number | null;
  seasonName?: string | null;
  seasonWindow?: string | null;
  chemical: string;
  dose: string;
  area: number;
  weather: string;
  operator: string;
  notes?: string;
}

export interface ReportFertigationRecord {
  date: string;
  daysAfterPruning?: number | null;
  seasonId?: number | null;
  seasonName?: string | null;
  seasonWindow?: string | null;
  fertilizers: string;
  area: number;
  notes?: string;
}

export interface ReportHarvestRecord {
  date: string;
  daysAfterPruning?: number | null;
  seasonId?: number | null;
  seasonName?: string | null;
  seasonWindow?: string | null;
  quantity: number;
  grade: string;
  price?: number;
  buyer?: string;
  notes?: string;
}

export interface ReportExpenseRecord {
  date: string;
  daysAfterPruning?: number | null;
  seasonId?: number | null;
  seasonName?: string | null;
  seasonWindow?: string | null;
  type: string;
  cost: number;
  remarks?: string;
}

export interface ReportSummary {
  totalRecords: number;
  dateRange: string;
  totalIrrigationHours: number;
  totalWaterUsage: number;
  totalHarvest: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  irrigationCount: number;
  sprayCount: number;
  fertigationCount: number;
  harvestCount: number;
  expenseCount: number;
  stockUsageCount: number;
}

export interface ReportPreview {
  data: ReportData;
  summary: ReportSummary;
}
