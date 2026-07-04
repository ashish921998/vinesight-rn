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
  /** Kernel-computed quantity lenses (issue #198). Optional so hand-built fixtures stay valid. */
  usage?: ReportUsageLenses;
}

// ============================================================
// MARK: - Usage lenses (issue #198)
// ============================================================

export type UsageLensMeasure = 'mass' | 'volume' | 'count';

/**
 * One canonical figure of a lens row. `value` is full precision (kg / L /
 * count); `display` is render-rounded by the kernel's format() and carries
 * the "≈ " prefix because every lens figure is derived (folded/divided),
 * never a value the farmer typed.
 */
export interface UsageLensFigure {
  measure: UsageLensMeasure;
  value: number;
  display: string;
}

export interface UsagePerPlotRow {
  key: string;
  name: string;
  type: 'spray' | 'fertilizer';
  usageCount: number;
  /** One figure per measure — mass, volume and count never merge into one number. */
  totals: UsageLensFigure[];
}

/**
 * A row shown as logged, without any conversion: unrecognized-unit items
 * ("Other"), concentration items missing their water volume
 * ("concentration-only"), and per-acre rates missing the farm area.
 */
export interface UsageVerbatimRow {
  key: string;
  name: string;
  type: 'spray' | 'fertilizer';
  unit: string;
  quantity: number;
  usageCount: number;
}

export interface UsagePerAcreRow {
  key: string;
  name: string;
  type: 'spray' | 'fertilizer';
  perAcre: UsageLensFigure[];
}

/**
 * 'verified' — every applied contribution came from a record item stamped
 * with this plan item's id. 'approximate' — at least one contribution was
 * matched only by normalized product name; never presented as verified.
 */
export type UsageComplianceMatchLevel = 'verified' | 'approximate';

export interface UsageComplianceRow {
  planItemId: string;
  name: string;
  measure: UsageLensMeasure;
  prescribedPerAcre: number;
  prescribedDisplay: string;
  appliedPerAcre: number | null;
  appliedDisplay: string | null;
  matchLevel: UsageComplianceMatchLevel | null;
}

export interface UsagePerLiterRow {
  key: string;
  name: string;
  measure: 'mass' | 'volume';
  /** Σ chemical canonical ÷ Σ water volume — weighted by water, never a plain average. */
  concentration: number;
  display: string;
  /** Spray events with logged water that back this figure. */
  eventCount: number;
}

export interface ReportUsageLenses {
  perPlot: {
    rows: UsagePerPlotRow[];
    other: UsageVerbatimRow[];
    concentrationOnly: UsageVerbatimRow[];
    rateOnly: UsageVerbatimRow[];
  };
  perAcre: {
    /** False when the farm area is missing/zero/non-finite — the lens is hidden, never divided by a guess. */
    available: boolean;
    areaAcres: number | null;
    rows: UsagePerAcreRow[];
    compliance: UsageComplianceRow[];
  };
  perLiter: {
    rows: UsagePerLiterRow[];
    sprayEventsWithWater: number;
    sprayEventsTotal: number;
  };
}

/** Minimal plan-item shape the compliance delta joins against. */
export interface ReportPlanItemInput {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
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

/** Period-over-period change for a single KPI tile. */
export interface MetricDelta {
  /**
   * Signed percentage change vs the baseline, computed as
   * (current - baseline) / |baseline| * 100. The |baseline| denominator keeps
   * the sign aligned to the real direction even for signed metrics like net
   * profit (e.g. -1000 → -500 reads as a positive change). Null when `isNew`.
   */
  deltaPct: number | null;
  /** Direction of (current - baseline): 1 up, -1 down, 0 unchanged. */
  direction: -1 | 0 | 1;
  /** Baseline was 0 and current > 0, so a percentage is meaningless. */
  isNew: boolean;
}

/** Per-tile deltas for the executive-summary grid, keyed by tile key. */
export interface ReportComparison {
  deltas: Record<string, MetricDelta>;
}

export interface ReportPreview {
  data: ReportData;
  summary: ReportSummary;
}
