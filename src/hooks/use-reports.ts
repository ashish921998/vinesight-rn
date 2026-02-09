/**
 * Report Hooks for Vinesight
 * React Query hooks for report generation
 */

import { useMemo, useState, useCallback } from 'react';
import { useFarms } from './use-farms';
import {
  useIrrigationRecords,
  useSprayRecords,
  useFertigationRecords,
  useHarvestRecords,
  useExpenseRecords,
} from './use-records';
import { ReportService } from '../services/report-service';
import { DateRange, ReportPreview, ReportType, ReportFormat } from '../types/report';
import { useCurrency } from './use-currency';

/**
 * Hook to get report data for a specific farm
 */
export function useReportData(farmId: number | null, dateRange: DateRange | null) {
  const { data: farms } = useFarms();
  const { data: irrigations, isLoading: irrigationsLoading } = useIrrigationRecords(farmId ?? 0);
  const { data: sprays, isLoading: spraysLoading } = useSprayRecords(farmId ?? 0);
  const { data: fertigations, isLoading: fertigationsLoading } = useFertigationRecords(farmId ?? 0);
  const { data: harvests, isLoading: harvestsLoading } = useHarvestRecords(farmId ?? 0);
  const { data: expenses, isLoading: expensesLoading } = useExpenseRecords(farmId ?? 0);

  const farm = useMemo(() => {
    if (!farms || !farmId) return null;
    return farms.find((f) => f.id === farmId) || null;
  }, [farms, farmId]);

  const preview = useMemo<ReportPreview | null>(() => {
    if (!farm || !dateRange || !irrigations || !sprays || !fertigations || !harvests || !expenses) {
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
    );
  }, [farm, dateRange, irrigations, sprays, fertigations, harvests, expenses]);

  const isLoading =
    irrigationsLoading ||
    spraysLoading ||
    fertigationsLoading ||
    harvestsLoading ||
    expensesLoading;

  return {
    farm,
    preview,
    isLoading,
    irrigations: irrigations || [],
    sprays: sprays || [],
    fertigations: fertigations || [],
    harvests: harvests || [],
    expenses: expenses || [],
  };
}

/**
 * Hook to manage report export state
 */
export function useReportExport() {
  const preferredCurrency = useCurrency();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportReport = useCallback(
    async (preview: ReportPreview, format: ReportFormat, reportType: ReportType) => {
      setIsExporting(true);
      setExportError(null);

      try {
        if (format === 'csv') {
          await ReportService.exportCSV(preview.data, reportType);
        } else {
          await ReportService.exportPDF(
            preview.data,
            preview.summary,
            reportType,
            preferredCurrency,
          );
        }
      } catch (error) {
        console.error('Export error:', error);
        setExportError(error instanceof Error ? error.message : 'Export failed');
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [preferredCurrency],
  );

  return {
    isExporting,
    exportError,
    exportReport,
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
