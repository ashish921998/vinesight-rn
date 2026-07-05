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
  | 'stock'
  | 'nutrient-ledger';

export const REPORT_SECTION_ORDER: ReportSectionKey[] = [
  'meta',
  'executive',
  'irrigation',
  'spray',
  'fertigation',
  'harvest',
  'expense',
  'stock',
  'nutrient-ledger',
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
    'nutrient-ledger',
  ],
  operations: [
    'meta',
    'executive',
    'irrigation',
    'spray',
    'fertigation',
    'harvest',
    'nutrient-ledger',
  ],
  financial: ['meta', 'executive', 'expense'],
  // No ledger here: nutrients derive from application LOGS (fertigation/spray),
  // not from warehouse stock movement — a stock report showing "N given" would
  // conflate what left the shelf with what reached the vines.
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
  /** Nutrient ledger for the selected period (issue #200). Optional — absent on old fixtures. */
  nutrientLedger?: NutrientLedger;
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
export type UsageComplianceMatchLevel = 'verified' | 'approximate' | 'unresolved';

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
  /**
   * Farm area (canonical acres) snapshotted when the plan was written —
   * the denominator for reading total-basis prescriptions ("10 kg") per
   * acre. Absent/null on plans predating the snapshot: compliance falls
   * back to the current farm area.
   */
  areaAcres?: number | null;
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

// ============================================================
// MARK: - Nutrient ledger (issue #200)
// ============================================================

/**
 * A single nutrient row in the ledger — elemental (matches petiole/soil labs)
 * and optionally bag-grade oxide (what bags / consultants speak).
 *
 * Only N/P/K/Ca/Mg/S get oxide equivalents (P₂O₅, K₂O, CaO, MgO, SO₃).
 * Micros (Fe, Mn, Zn, Cu, B, Mo, Na, Cl) stay elemental only.
 */
export interface NutrientLedgerRow {
  /** Elemental symbol: N, P, K, Ca, Mg, S, Fe, Mn, … */
  element: string;
  /** kg of this element for the period / plot. */
  elementalKg: number;
  /** kg of element per acre for the period. Null when area is unknown. */
  elementalKgPerAcre: number | null;
  /**
   * Bag-grade oxide symbol (P₂O₅, K₂O, CaO, MgO, SO₃) — present only for
   * the six macros above. Elemental → oxide via the inverse pinned factors.
   */
  oxideSymbol?: string;
  /** kg of bag-grade oxide for the period / plot. Null when no oxide equivalent. */
  oxideKg?: number;
  /** kg of bag-grade oxide per acre. Null when no oxide equivalent or area unknown. */
  oxideKgPerAcre?: number;
}

/**
 * Nutrient ledger for a single date-range period (or petiole interval).
 * Coverage is identity-bound and honest — items without a composition
 * snapshot are excluded from totals but counted in the denominator.
 */
export interface NutrientLedger {
  /** Sorted rows, macros first (N → P → K → Ca → Mg → S), then micros by element. */
  rows: NutrientLedgerRow[];
  /**
   * Percent of applied quantity (by item count) that had a composition snapshot
   * and a resolvable unit. Padded to 100 is never acceptable; 0 means totals
   * cannot be trusted and the UI must say so clearly.
   */
  coveragePercent: number;
  /** Total items counted in the denominator (all valid quantity items). */
  itemCount: number;
  /** Items that contributed to the nutrient totals (had snapshot + resolvable mass). */
  composedItemCount: number;
  /** Farm area (acres) used for per-acre math. Null → per-acre columns hidden. */
  areaAcres: number | null;
  /** Date range this ledger covers. */
  fromDate: string;
  toDate: string;
}
