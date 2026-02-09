/**
 * Report Types for Vinesight
 * Types for report generation and export
 */

export type ReportFormat = 'pdf' | 'csv';
export type ReportType = 'operations' | 'financial' | 'comprehensive' | 'stock-usage';

export interface DateRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;
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
  irrigation: ReportIrrigationRecord[];
  spray: ReportSprayRecord[];
  fertigation: ReportFertigationRecord[];
  harvest: ReportHarvestRecord[];
  expense: ReportExpenseRecord[];
  stock: ReportStockUsageRecord[];
}

export interface ReportStockUsageRecord {
  itemName: string;
  type: 'fertilizer' | 'spray' | 'other';
  quantityUsed: number;
  unit: string;
  areaTreated: number; // Total area this item was applied to
  cost?: number; // Estimated cost
  usageCount: number; // Number of times used
}

export interface ReportIrrigationRecord {
  date: string;
  duration: number;
  area: number;
  growthStage: string;
  moistureStatus: string;
  systemDischarge: number;
  notes?: string;
}

export interface ReportSprayRecord {
  date: string;
  chemical: string;
  dose: string;
  area: number;
  weather: string;
  operator: string;
  notes?: string;
}

export interface ReportFertigationRecord {
  date: string;
  fertilizers: string;
  area: number;
  notes?: string;
}

export interface ReportHarvestRecord {
  date: string;
  quantity: number;
  grade: string;
  price?: number;
  buyer?: string;
  notes?: string;
}

export interface ReportExpenseRecord {
  date: string;
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
