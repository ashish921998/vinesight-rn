/**
 * Report comparison — pure period-over-period logic.
 *
 * Kept dependency-free (types + date utils only) so it unit-tests without the
 * React Query / Supabase surface that the surrounding hooks pull in.
 *
 *   current season (selected)        baseline season (the one before it)
 *   ├───────────● today              ├───────────┐  same elapsed window
 *   start    elapsed = N days        start     start + N days
 *
 * Deltas compare the *same elapsed window* of the prior season, so a partial
 * in-progress season isn't measured against a full completed one (which would
 * make every total look like it collapsed). Falls back to the immediately
 * preceding equal-length date window when no season is selected.
 */

import type { FarmSeason } from '@/types/database';
import type { MetricDelta, ReportFilters, ReportSummary } from '@/types/report';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';

/** The numeric fields of ReportSummary (excludes the `dateRange` string). */
type NumericSummaryField = {
  [K in keyof ReportSummary]: ReportSummary[K] extends number ? K : never;
}[keyof ReportSummary];

/** Tile key → the summary field it compares. */
const COMPARISON_METRIC_FIELDS: Record<string, NumericSummaryField> = {
  records: 'totalRecords',
  water: 'totalWaterUsage',
  harvest: 'totalHarvest',
  profit: 'netProfit',
  revenue: 'totalRevenue',
  expenses: 'totalExpenses',
  'stock-usage': 'stockUsageCount',
};

function toLocalDate(iso: string): Date {
  return parseDbDateToLocalDate(iso) ?? new Date();
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = toLocalDate(toIso).getTime() - toLocalDate(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function addDaysIso(iso: string, days: number): string {
  const d = toLocalDate(iso);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function singleMetricDelta(current: number, baseline: number): MetricDelta {
  if (baseline === 0) {
    return { deltaPct: null, direction: current > 0 ? 1 : 0, isNew: current > 0 };
  }
  const diff = current - baseline;
  return {
    // |baseline| denominator keeps the sign aligned to the real direction even
    // for signed metrics like net profit (-1000 → -500 reads as a gain).
    deltaPct: (diff / Math.abs(baseline)) * 100,
    direction: diff > 0 ? 1 : diff < 0 ? -1 : 0,
    isNew: false,
  };
}

/** Per-tile deltas from a current and baseline summary. */
export function computeReportDeltas(
  current: ReportSummary,
  baseline: ReportSummary,
): Record<string, MetricDelta> {
  const deltas: Record<string, MetricDelta> = {};
  for (const [key, field] of Object.entries(COMPARISON_METRIC_FIELDS)) {
    deltas[key] = singleMetricDelta(current[field], baseline[field]);
  }
  return deltas;
}

export interface BaselineResolution {
  /** Filters that fetch the baseline period's records. */
  filters: ReportFilters;
  /** The prior season used as the baseline, when comparing season-to-season. */
  baselineSeason: FarmSeason | null;
  /**
   * Days measured from each season's start (elapsed-window alignment). Null
   * for plain date-window baselines.
   */
  elapsedDays: number | null;
  /**
   * Set only when the baseline window had to be clamped to a shorter prior
   * season. Refetching the *current* side with this narrower range keeps the
   * comparison apples-to-apples — both sides cover the same `elapsedDays`
   * window instead of comparing a full current season against a truncated
   * baseline. Null when the current side's own filters already match.
   */
  currentFilters: ReportFilters | null;
}

/**
 * Resolve the baseline period for a comparison, or null when no honest
 * baseline exists (no farm, first season, or a date-window with nothing before
 * it that we can align to).
 *
 * Season selected → the same elapsed window of the season immediately *before*
 * the selected one (relative to the selection, not the active season).
 * No season  → the immediately preceding equal-length date window.
 */
export function resolveBaseline(
  filters: ReportFilters,
  seasons: FarmSeason[],
  selectedSeason: FarmSeason | null,
  todayIso: string,
): BaselineResolution | null {
  const farmId = filters.farmId;
  if (farmId == null) return null;

  if (typeof filters.seasonId === 'number' && selectedSeason?.start_date) {
    const prior = seasons
      .filter((s) => s.id != null && s.start_date < selectedSeason.start_date)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    if (!prior || prior.id == null) return null;

    const currentFrom = selectedSeason.start_date;
    const currentTo =
      selectedSeason.end_date && selectedSeason.end_date < todayIso
        ? selectedSeason.end_date
        : todayIso;
    const elapsed = daysBetween(currentFrom, currentTo);

    let baselineTo = addDaysIso(prior.start_date, elapsed);
    if (prior.end_date && baselineTo > prior.end_date) {
      baselineTo = prior.end_date;
    }
    // elapsedDays must reflect the window actually being compared, not the
    // current season's elapsed time — when the prior season is shorter and
    // baselineTo gets clamped above, reporting the unclamped `elapsed` would
    // overstate how far the baseline period runs (a UI footnote reading "both
    // seasons measured over their first 30 days" when the baseline only has 14).
    const clampedElapsedDays = daysBetween(prior.start_date, baselineTo);
    // The clamp above narrows the *baseline* window. If we compare that against
    // the current season's full (unclamped) elapsed window, the delta is
    // apples-to-oranges — e.g. current's first 30 days vs baseline's first 14.
    // Surface a matching current-side window so the caller refetches both
    // sides over the same `clampedElapsedDays`.
    const currentFilters: ReportFilters | null =
      clampedElapsedDays < elapsed
        ? {
            farmId,
            seasonId: filters.seasonId,
            dateRange: { from: currentFrom, to: addDaysIso(currentFrom, clampedElapsedDays) },
            includeUnassigned: false,
          }
        : null;
    return {
      filters: {
        farmId,
        seasonId: prior.id,
        dateRange: { from: prior.start_date, to: baselineTo },
        includeUnassigned: false,
      },
      baselineSeason: prior,
      elapsedDays: clampedElapsedDays,
      currentFilters,
    };
  }

  // No season selected: preceding equal-length window.
  const length = daysBetween(filters.dateRange.from, filters.dateRange.to);
  const baselineTo = addDaysIso(filters.dateRange.from, -1);
  const baselineFrom = addDaysIso(baselineTo, -length);
  return {
    filters: {
      farmId,
      dateRange: { from: baselineFrom, to: baselineTo },
      includeUnassigned: filters.includeUnassigned ?? true,
    },
    baselineSeason: null,
    elapsedDays: null,
    currentFilters: null,
  };
}
