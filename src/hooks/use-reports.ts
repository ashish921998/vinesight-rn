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
import { useWarehouseItems } from './use-profile';
import { ReportService } from '../services/report-service';
import {
  DateRange,
  ReportPreview,
  ReportType,
  ReportFormat,
  ReportFilters,
  ReportSeasonContext,
} from '../types/report';
import { useCurrency } from './use-currency';
import type { AreaUnitPreference } from '@/utils/preferences';
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
export function useReportData(filters: ReportFilters) {
  const { farmId, dateRange } = filters;
  const seasonId = filters.seasonId;
  const includeUnassigned = shouldIncludeUnassigned(filters);

  const { data: farms } = useFarms();
  const { data: farmSeasons, isLoading: farmSeasonsLoading } = useFarmSeasons(farmId ?? undefined);
  const { data: irrigationsRaw, isLoading: irrigationsLoading } = useIrrigationRecords(
    farmId ?? 0,
    seasonId,
  );
  const { data: spraysRaw, isLoading: spraysLoading } = useSprayRecords(farmId ?? 0, seasonId);
  const { data: fertigationsRaw, isLoading: fertigationsLoading } = useFertigationRecords(
    farmId ?? 0,
    seasonId,
  );
  const { data: harvestsRaw, isLoading: harvestsLoading } = useHarvestRecords(
    farmId ?? 0,
    seasonId,
  );
  const { data: expensesRaw, isLoading: expensesLoading } = useExpenseRecords(
    farmId ?? 0,
    seasonId,
  );
  const { data: warehouseItems, isLoading: warehouseItemsLoading } = useWarehouseItems();

  const farm = useMemo(() => {
    if (!farms || !farmId) return null;
    return farms.find((f) => f.id === farmId) || null;
  }, [farms, farmId]);

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
      },
    );
  }, [
    dateRange,
    expenses,
    farm,
    fertigations,
    harvests,
    irrigations,
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
    farmSeasonsLoading;

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
