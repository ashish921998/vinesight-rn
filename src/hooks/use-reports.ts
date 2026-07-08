/**
 * Report Hooks for Vinesight
 * React Query hooks for report generation
 */

import { useMemo, useState, useCallback } from 'react';
import { useFarms } from './use-farms';
import { useFarmSeasons } from './use-farm-seasons';
import {
  useIrrigationRecords,
  useSprayRecords,
  useFertigationRecords,
  useHarvestRecords,
  useExpenseRecords,
} from './use-records';
import { useProfile, useWarehouseItems } from './use-profile';
import { useFertilizerPlan } from './use-fertilizer-plan';
import { useAuthStore } from '@/stores';
import { ReportService } from '../services/report-service';
import {
  DateRange,
  ReportPlanItemInput,
  ReportPreview,
  ReportType,
  ReportFormat,
  ReportFilters,
  ReportSeasonContext,
  ReportComparison,
} from '../types/report';
import { resolveBaseline, computeReportDeltas } from '../services/report-comparison';
import { useCurrency } from './use-currency';
import { resolveAreaUnitPreference, type AreaUnitPreference } from '@/utils/preferences';
import { formatLocalDate } from '@/utils/date';
import { formatDate } from '@/i18n/format';
import type {
  ExpenseRecord,
  FarmSeason,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types/database';

interface SeasonAssignableRecord {
  season_id?: number | null;
}

interface SeasonBounds {
  from: string;
  to: string;
}

export function shouldIncludeUnassigned(filters: ReportFilters): boolean {
  if (typeof filters.includeUnassigned === 'boolean') return filters.includeUnassigned;
  return typeof filters.seasonId !== 'number';
}

export function filterRecordsForSeason<T extends SeasonAssignableRecord>(
  records: T[],
  seasonId: number | undefined,
  includeUnassigned: boolean,
): T[] {
  // Performance Note: Filtering is currently done in-memory.
  // This is acceptable for typical farm data sizes (< 5000 records).
  // If record counts grow significantly, consider moving this filtering to the database/Supabase query level.
  if (typeof seasonId === 'number') {
    return records.filter((record) => record.season_id === seasonId);
  }
  if (includeUnassigned) {
    return records;
  }
  return records.filter((record) => record.season_id != null);
}

export function clampDateRangeToSeasonBounds(
  dateRange: DateRange,
  bounds: SeasonBounds | null,
): DateRange {
  if (!bounds) return dateRange;
  const clamp = (value: string) => {
    if (value < bounds.from) return bounds.from;
    if (value > bounds.to) return bounds.to;
    return value;
  };
  const nextFrom = clamp(dateRange.from);
  const nextTo = clamp(dateRange.to);
  if (nextFrom <= nextTo) {
    return { from: nextFrom, to: nextTo };
  }
  return { from: nextFrom, to: nextFrom };
}

export function formatReportSeasonLabel(season: FarmSeason): string {
  const customName = season.season_name?.trim();
  if (customName) return customName;
  const base = season.start_date ? `Season ${season.start_date}` : 'Season';
  const cropSnapshot = season.crop_type_snapshot?.trim();
  return cropSnapshot ? `${base} (${cropSnapshot})` : base;
}

/**
 * Hook to get report data for a specific farm
 */
export function useReportData(filters: ReportFilters, options?: { enabled?: boolean }) {
  const { farmId, dateRange } = filters;
  const seasonId = filters.seasonId;
  const includeUnassigned = shouldIncludeUnassigned(filters);

  // When disabled (e.g. a comparison baseline that doesn't apply), pass an
  // undefined farmId so every record query gates off via its `enabled: !!farmId`
  // guard — no fetches, no preview. Hook order stays stable.
  const enabled = options?.enabled !== false;
  const effectiveFarmId = enabled ? (farmId ?? undefined) : undefined;

  const { data: farms } = useFarms();
  const { data: farmSeasons, isLoading: farmSeasonsLoading } = useFarmSeasons(effectiveFarmId);
  const { data: irrigationsRaw, isLoading: irrigationsLoading } = useIrrigationRecords(
    effectiveFarmId ?? 0,
    seasonId,
  );
  const { data: spraysRaw, isLoading: spraysLoading } = useSprayRecords(
    effectiveFarmId ?? 0,
    seasonId,
  );
  const { data: fertigationsRaw, isLoading: fertigationsLoading } = useFertigationRecords(
    effectiveFarmId ?? 0,
    seasonId,
  );
  const { data: harvestsRaw, isLoading: harvestsLoading } = useHarvestRecords(
    effectiveFarmId ?? 0,
    seasonId,
  );
  const { data: expensesRaw, isLoading: expensesLoading } = useExpenseRecords(
    effectiveFarmId ?? 0,
    seasonId,
  );
  const { data: warehouseItems, isLoading: warehouseItemsLoading } = useWarehouseItems();
  // Current fertilizer plan — the compliance delta's join target. Not part of
  // the loading gate: a farm without a plan (or a failed plan fetch) still
  // gets its report; the compliance section simply stays empty.
  const { data: fertilizerPlan } = useFertilizerPlan(effectiveFarmId);
  // farm.area is stored as the raw number the user typed under their area-unit
  // preference — the per-acre lens must know that unit or hectare farms get
  // rates that are silently 2.47× too high (same resolution as app/reports.tsx).
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { user } = useAuthStore();
  const areaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );

  const planItems = useMemo<ReportPlanItemInput[]>(
    () =>
      (fertilizerPlan?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        // Plan-level snapshot of the farm area (canonical acres) at plan
        // creation — null on plans predating the snapshot column.
        areaAcres: fertilizerPlan?.farm_area_acres ?? null,
        // Phase W: product identity for stronger compliance matching.
        productId: item.product_id ?? null,
      })),
    [fertilizerPlan],
  );

  const farm = useMemo(() => {
    if (!farms || !effectiveFarmId) return null;
    return farms.find((f) => f.id === effectiveFarmId) || null;
  }, [farms, effectiveFarmId]);

  const selectedSeason = useMemo(() => {
    if (!farmSeasons || typeof seasonId !== 'number') return null;
    return farmSeasons.find((season) => season.id === seasonId) ?? null;
  }, [farmSeasons, seasonId]);

  const seasonNameById = useMemo<Record<number, string>>(() => {
    const next: Record<number, string> = {};
    (farmSeasons ?? []).forEach((season) => {
      if (season.id == null) return;
      next[season.id] = formatReportSeasonLabel(season);
    });
    return next;
  }, [farmSeasons]);

  const seasonWindowById = useMemo<Record<number, string>>(() => {
    const today = formatLocalDate(new Date());
    const next: Record<number, string> = {};
    (farmSeasons ?? []).forEach((season) => {
      if (season.id == null) return;
      next[season.id] =
        `${formatDate(season.start_date)} to ${formatDate(season.end_date ?? today)}`;
    });
    return next;
  }, [farmSeasons]);

  const seasonContext = useMemo<ReportSeasonContext>(() => {
    if (typeof seasonId === 'number') {
      return {
        mode: 'season',
        seasonId,
        seasonName: selectedSeason ? formatReportSeasonLabel(selectedSeason) : `Season ${seasonId}`,
        seasonStart: selectedSeason?.start_date ?? null,
        seasonEnd: selectedSeason?.end_date ?? null,
        includeUnassigned,
      };
    }
    return {
      mode: 'all',
      seasonId: null,
      seasonName: null,
      seasonStart: null,
      seasonEnd: null,
      includeUnassigned,
    };
  }, [includeUnassigned, seasonId, selectedSeason]);

  // When seasonId is set, the DB hooks already filter by season_id — no client-side re-filter needed.
  // When seasonId is undefined and includeUnassigned is false, we still need to
  // exclude records with no season assignment.
  const needsClientFilter = typeof seasonId !== 'number' && !includeUnassigned;

  const irrigations = useMemo<IrrigationRecord[]>(
    () =>
      needsClientFilter
        ? filterRecordsForSeason(irrigationsRaw ?? [], seasonId, includeUnassigned)
        : (irrigationsRaw ?? []),
    [includeUnassigned, irrigationsRaw, needsClientFilter, seasonId],
  );
  const sprays = useMemo<SprayRecord[]>(
    () =>
      needsClientFilter
        ? filterRecordsForSeason(spraysRaw ?? [], seasonId, includeUnassigned)
        : (spraysRaw ?? []),
    [includeUnassigned, needsClientFilter, seasonId, spraysRaw],
  );
  const fertigations = useMemo<FertigationRecord[]>(
    () =>
      needsClientFilter
        ? filterRecordsForSeason(fertigationsRaw ?? [], seasonId, includeUnassigned)
        : (fertigationsRaw ?? []),
    [fertigationsRaw, includeUnassigned, needsClientFilter, seasonId],
  );
  const harvests = useMemo<HarvestRecord[]>(
    () =>
      needsClientFilter
        ? filterRecordsForSeason(harvestsRaw ?? [], seasonId, includeUnassigned)
        : (harvestsRaw ?? []),
    [harvestsRaw, includeUnassigned, needsClientFilter, seasonId],
  );
  const expenses = useMemo<ExpenseRecord[]>(
    () =>
      needsClientFilter
        ? filterRecordsForSeason(expensesRaw ?? [], seasonId, includeUnassigned)
        : (expensesRaw ?? []),
    [expensesRaw, includeUnassigned, needsClientFilter, seasonId],
  );

  const preview = useMemo<ReportPreview | null>(() => {
    if (!farm || !dateRange || !warehouseItems) {
      return null;
    }
    return ReportService.generatePreview(
      farm,
      irrigations,
      sprays,
      fertigations,
      harvests,
      expenses,
      dateRange,
      warehouseItems,
      {
        seasonContext,
        seasonNameById,
        seasonWindowById,
        planItems,
        areaUnit,
      },
    );
  }, [
    areaUnit,
    dateRange,
    expenses,
    farm,
    fertigations,
    harvests,
    irrigations,
    planItems,
    seasonContext,
    seasonNameById,
    seasonWindowById,
    sprays,
    warehouseItems,
  ]);

  const isLoading =
    irrigationsLoading ||
    spraysLoading ||
    fertigationsLoading ||
    harvestsLoading ||
    expensesLoading ||
    warehouseItemsLoading ||
    farmSeasonsLoading ||
    // Without this gate a hectares-preference user's first preview computes
    // per-acre figures with the 'acres' fallback (2.47× too high) until the
    // profile query settles — and an immediate export captures that preview.
    profileLoading;

  return {
    farm,
    preview,
    isLoading,
    seasons: farmSeasons || [],
    selectedSeason,
    seasonContext,
    includeUnassigned,
    irrigations: irrigations ?? [],
    sprays: sprays ?? [],
    fertigations: fertigations ?? [],
    harvests: harvests ?? [],
    expenses: expenses ?? [],
  };
}

/**
 * Wraps useReportData to add period-over-period deltas. Calls useReportData a
 * second time for the baseline (gated off when no baseline applies), then
 * subtracts. Deltas are dropped when the baseline window holds no records, so
 * an empty prior period never produces phantom "New" badges.
 *
 * Baseline resolution + delta math live in services/report-comparison.ts (pure,
 * unit-tested there).
 */
export function useReportComparison(filters: ReportFilters) {
  const current = useReportData(filters);
  const todayIso = useMemo(() => formatLocalDate(new Date()), []);

  const baselineResolution = useMemo(
    () => resolveBaseline(filters, current.seasons, current.selectedSeason, todayIso),
    [filters, current.seasons, current.selectedSeason, todayIso],
  );

  const baselineFilters = baselineResolution?.filters ?? null;
  const baseline = useReportData(baselineFilters ?? filters, { enabled: baselineFilters != null });

  const comparison = useMemo<ReportComparison | null>(() => {
    if (!baselineResolution || !current.preview || !baseline.preview) return null;
    // Must-have-records: an empty prior window is not an honest baseline.
    if (baseline.preview.summary.totalRecords === 0) return null;

    const currentLabel = current.selectedSeason
      ? formatReportSeasonLabel(current.selectedSeason)
      : `${filters.dateRange.from} – ${filters.dateRange.to}`;
    const baselineLabel = baselineResolution.baselineSeason
      ? formatReportSeasonLabel(baselineResolution.baselineSeason)
      : `${baselineResolution.filters.dateRange.from} – ${baselineResolution.filters.dateRange.to}`;

    return {
      deltas: computeReportDeltas(current.preview.summary, baseline.preview.summary),
      baselineSummary: baseline.preview.summary,
      baselineLabel,
      currentLabel,
      elapsedDays: baselineResolution.elapsedDays,
    };
  }, [
    baselineResolution,
    current.preview,
    current.selectedSeason,
    baseline.preview,
    filters.dateRange.from,
    filters.dateRange.to,
  ]);

  return { ...current, comparison };
}

/**
 * Hook to manage report export state
 */
export function useReportExport() {
  const preferredCurrency = useCurrency();
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportReport = useCallback(
    async (
      preview: ReportPreview,
      format: ReportFormat,
      reportType: ReportType,
      areaUnit: AreaUnitPreference = 'acres',
    ) => {
      setIsProcessing(true);
      setExportError(null);

      try {
        if (format === 'csv') {
          await ReportService.exportCSV(preview.data, reportType, areaUnit);
        } else {
          await ReportService.exportPDF(
            preview.data,
            preview.summary,
            reportType,
            preferredCurrency,
            areaUnit,
          );
        }
      } catch (error) {
        console.error('Export error:', error);
        setExportError(error instanceof Error ? error.message : 'Export failed');
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [preferredCurrency],
  );

  const downloadReport = useCallback(
    async (
      preview: ReportPreview,
      format: ReportFormat,
      reportType: ReportType,
      areaUnit: AreaUnitPreference = 'acres',
    ): Promise<string> => {
      setIsProcessing(true);
      setExportError(null);

      try {
        if (format === 'csv') {
          return await ReportService.downloadCSV(preview.data, reportType, areaUnit);
        }
        return await ReportService.downloadPDF(
          preview.data,
          preview.summary,
          reportType,
          preferredCurrency,
          areaUnit,
        );
      } catch (error) {
        console.error('Download error:', error);
        setExportError(error instanceof Error ? error.message : 'Download failed');
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [preferredCurrency],
  );

  return {
    isExporting: isProcessing,
    exportError,
    exportReport,
    downloadReport,
    clearError: () => setExportError(null),
  };
}

/**
 * Get default date range (last 90 days)
 */
export function getDefaultDateRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}
