/**
 * Analytics Hooks for Vinesight
 * React Query hooks for analytics calculations
 */

import { useMemo } from 'react';
import { useFarms } from './useFarms';
import {
  useIrrigationRecordsByFarms,
  useSprayRecordsByFarms,
  useFertigationRecordsByFarms,
  useHarvestRecordsByFarms,
  useExpenseRecordsByFarms,
} from './useRecords';
import { AnalyticsService } from '../services/analyticsService';
import {
  AnalyticsData,
  CostAnalysis,
  YieldAnalysis,
  PerformanceMetrics,
  TimeRange,
} from '../types/analytics';

/**
 * Main analytics hook that fetches all data and calculates metrics
 */
export function useAnalytics(timeRange: TimeRange = 'all') {
  const { data: farms, isLoading: farmsLoading } = useFarms();

  // Get all farm IDs
  const farmIds = useMemo(() => {
    if (!farms) return [];
    return farms.map((f) => f.id).filter((id): id is number => id !== undefined);
  }, [farms]);

  // Fetch all records across farms
  const { data: irrigations, isLoading: irrigationsLoading } = useIrrigationRecordsByFarms(farmIds);
  const { data: sprays, isLoading: spraysLoading } = useSprayRecordsByFarms(farmIds);
  const { data: fertigations, isLoading: fertigationsLoading } =
    useFertigationRecordsByFarms(farmIds);
  const { data: harvests, isLoading: harvestsLoading } = useHarvestRecordsByFarms(farmIds);
  const { data: expenses, isLoading: expensesLoading } = useExpenseRecordsByFarms(farmIds);

  // Calculate analytics
  const analytics = useMemo<AnalyticsData | null>(() => {
    if (!farms || !irrigations || !sprays || !fertigations || !harvests || !expenses) {
      return null;
    }
    return AnalyticsService.calculateAnalytics(
      farms,
      irrigations,
      sprays,
      fertigations,
      harvests,
      expenses,
      timeRange,
    );
  }, [farms, irrigations, sprays, fertigations, harvests, expenses, timeRange]);

  // Calculate cost analysis
  const costAnalysis = useMemo<CostAnalysis | null>(() => {
    if (!farms || !harvests || !expenses) return null;
    return AnalyticsService.calculateCostAnalysis(harvests, expenses, farms);
  }, [farms, harvests, expenses]);

  // Calculate yield analysis
  const yieldAnalysis = useMemo<YieldAnalysis | null>(() => {
    if (!farms || !harvests) return null;
    return AnalyticsService.calculateYieldAnalysis(harvests, farms);
  }, [farms, harvests]);

  // Calculate performance metrics
  const performanceMetrics = useMemo<PerformanceMetrics | null>(() => {
    if (!analytics || !costAnalysis || !yieldAnalysis) return null;
    return AnalyticsService.calculatePerformanceMetrics(analytics, costAnalysis, yieldAnalysis);
  }, [analytics, costAnalysis, yieldAnalysis]);

  const isLoading =
    farmsLoading ||
    irrigationsLoading ||
    spraysLoading ||
    fertigationsLoading ||
    harvestsLoading ||
    expensesLoading;

  return {
    analytics,
    costAnalysis,
    yieldAnalysis,
    performanceMetrics,
    farms,
    isLoading,
  };
}
