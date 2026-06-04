import { computeReportDeltas, resolveBaselineFilters } from '@/services/report-comparison';
import type { FarmSeason } from '@/types/database';
import type { ReportFilters, ReportSummary } from '@/types/report';

function season(id: number, start: string, end: string | null): FarmSeason {
  return { id, start_date: start, end_date: end } as FarmSeason;
}

function summary(partial: Partial<ReportSummary>): ReportSummary {
  return {
    totalRecords: 0,
    dateRange: '',
    totalIrrigationHours: 0,
    totalWaterUsage: 0,
    totalHarvest: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    irrigationCount: 0,
    sprayCount: 0,
    fertigationCount: 0,
    harvestCount: 0,
    expenseCount: 0,
    stockUsageCount: 0,
    ...partial,
  };
}

const TODAY = '2026-05-01';
const baseFilters = (over: Partial<ReportFilters>): ReportFilters => ({
  farmId: 1,
  dateRange: { from: '2026-04-01', to: TODAY },
  ...over,
});

describe('resolveBaselineFilters', () => {
  it('returns null when there is no farm', () => {
    expect(resolveBaselineFilters(baseFilters({ farmId: null }), [], null, TODAY)).toBeNull();
  });

  it('returns null on a farm’s first season (no prior season)', () => {
    const s2026 = season(10, '2026-04-01', null);
    const filters = baseFilters({ seasonId: 10 });
    expect(resolveBaselineFilters(filters, [s2026], s2026, TODAY)).toBeNull();
  });

  it('aligns the prior season to the SAME elapsed window (partial active season)', () => {
    const prior = season(9, '2025-04-01', '2025-09-01');
    const current = season(10, '2026-04-01', null); // active, 30 days elapsed by TODAY
    const result = resolveBaselineFilters(
      baseFilters({ seasonId: 10 }),
      [current, prior],
      current,
      TODAY,
    );
    expect(result).toEqual({
      farmId: 1,
      seasonId: 9,
      dateRange: { from: '2025-04-01', to: '2025-05-01' }, // +30 days, honest comparison
      includeUnassigned: false,
    });
  });

  it('is relative to the SELECTED season, not the most recent one', () => {
    const s2024 = season(8, '2024-04-01', '2024-09-01');
    const s2025 = season(9, '2025-04-01', '2025-09-01');
    const s2026 = season(10, '2026-04-01', null);
    // Select the middle season → baseline must be 2024, not 2026.
    const result = resolveBaselineFilters(
      baseFilters({ seasonId: 9 }),
      [s2026, s2025, s2024],
      s2025,
      TODAY,
    );
    expect(result?.seasonId).toBe(8);
    expect(result?.dateRange.from).toBe('2024-04-01');
  });

  it('clamps the baseline window to the prior season’s end', () => {
    const prior = season(9, '2025-04-01', '2025-04-15'); // ends before 30 elapsed days
    const current = season(10, '2026-04-01', null);
    const result = resolveBaselineFilters(
      baseFilters({ seasonId: 10 }),
      [current, prior],
      current,
      TODAY,
    );
    expect(result?.dateRange.to).toBe('2025-04-15');
  });

  it('falls back to the preceding equal-length window with no season selected', () => {
    const filters = baseFilters({ dateRange: { from: '2026-01-01', to: '2026-01-31' } });
    const result = resolveBaselineFilters(filters, [], null, TODAY);
    expect(result).toEqual({
      farmId: 1,
      dateRange: { from: '2025-12-01', to: '2025-12-31' },
      includeUnassigned: true,
    });
  });
});

describe('computeReportDeltas', () => {
  it('computes a positive percentage change', () => {
    const deltas = computeReportDeltas(
      summary({ totalWaterUsage: 1200 }),
      summary({ totalWaterUsage: 1000 }),
    );
    expect(deltas.water).toEqual({ deltaPct: 20, direction: 1, isNew: false });
  });

  it('computes a negative percentage change', () => {
    const deltas = computeReportDeltas(
      summary({ totalWaterUsage: 800 }),
      summary({ totalWaterUsage: 1000 }),
    );
    expect(deltas.water).toEqual({ deltaPct: -20, direction: -1, isNew: false });
  });

  it('treats a zero baseline with positive current as "New"', () => {
    const deltas = computeReportDeltas(
      summary({ totalWaterUsage: 500 }),
      summary({ totalWaterUsage: 0 }),
    );
    expect(deltas.water).toEqual({ deltaPct: null, direction: 1, isNew: true });
  });

  it('shows no delta when both periods are zero', () => {
    const deltas = computeReportDeltas(summary({}), summary({}));
    expect(deltas.water).toEqual({ deltaPct: null, direction: 0, isNew: false });
  });

  it('reads a less-negative net profit as an improvement (up)', () => {
    const deltas = computeReportDeltas(summary({ netProfit: -500 }), summary({ netProfit: -1000 }));
    // (-500 - -1000) / |−1000| * 100 = +50, direction up
    expect(deltas.profit).toEqual({ deltaPct: 50, direction: 1, isNew: false });
  });
});
