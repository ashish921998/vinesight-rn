/**
 * Analytics Service for Vinesight
 * Calculates dashboard metrics and insights
 */

import {
  AnalyticsData,
  CostAnalysis,
  YieldAnalysis,
  PerformanceMetrics,
  RecentActivity,
  TimeRange,
} from '../types/analytics';
import {
  Farm,
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  ExpenseRecord,
} from '../types/database';

export class AnalyticsService {
  /**
   * Calculate overall analytics from farm data
   */
  static calculateAnalytics(
    farms: Farm[],
    irrigations: IrrigationRecord[],
    sprays: SprayRecord[],
    fertigations: FertigationRecord[],
    harvests: HarvestRecord[],
    expenses: ExpenseRecord[],
    timeRange: TimeRange = 'all'
  ): AnalyticsData {
    // Filter by time range
    const cutoffDate = this.getCutoffDate(timeRange);
    const filteredIrrigations = this.filterByDate(irrigations, cutoffDate);
    const filteredSprays = this.filterByDate(sprays, cutoffDate);
    const filteredHarvests = this.filterByDate(harvests, cutoffDate);
    const filteredExpenses = this.filterByDate(expenses, cutoffDate);

    // Calculate totals
    const totalIrrigationHours = filteredIrrigations.reduce(
      (sum, r) => sum + (r.duration || 0),
      0
    );
    const totalHarvestQuantity = filteredHarvests.reduce(
      (sum, r) => sum + (r.quantity || 0),
      0
    );
    const totalHarvestValue = filteredHarvests.reduce(
      (sum, r) => sum + (r.quantity || 0) * (r.price || 0),
      0
    );
    const totalExpenses = filteredExpenses.reduce(
      (sum, r) => sum + (r.cost || 0),
      0
    );

    // Group irrigations by month
    const irrigationsByMonth = this.groupByMonth(filteredIrrigations);

    // Group sprays by chemical type
    const spraysByType = this.groupSpraysByType(filteredSprays);

    // Group harvests by farm
    const harvestsByFarm = this.groupHarvestsByFarm(filteredHarvests, farms);

    // Group expenses by type
    const expensesByType = this.groupExpensesByType(filteredExpenses);

    // Recent activity
    const recentActivity = this.getRecentActivity(
      filteredIrrigations,
      filteredSprays,
      filteredHarvests,
      farms
    );

    return {
      totalFarms: farms.length,
      totalArea: farms.reduce((sum, f) => sum + (f.area || 0), 0),
      totalIrrigationHours,
      totalSprayCount: filteredSprays.length,
      totalHarvestQuantity,
      totalHarvestValue,
      totalExpenses,
      irrigationsByMonth,
      spraysByType,
      harvestsByFarm,
      expensesByType,
      recentActivity,
    };
  }

  /**
   * Calculate cost analysis
   */
  static calculateCostAnalysis(
    harvests: HarvestRecord[],
    expenses: ExpenseRecord[],
    _farms: Farm[]
  ): CostAnalysis {
    const totalCosts = expenses.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalRevenue = harvests.reduce(
      (sum, r) => sum + (r.quantity || 0) * (r.price || 0),
      0
    );

    const profitMargin =
      totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
    const roi = totalCosts > 0 ? ((totalRevenue - totalCosts) / totalCosts) * 100 : 0;

    // Group expenses by type
    const expensesByType = new Map<string, number>();
    expenses.forEach((expense) => {
      const type = expense.type || 'other';
      expensesByType.set(type, (expensesByType.get(type) || 0) + (expense.cost || 0));
    });

    const costBreakdown = Array.from(expensesByType.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalCosts > 0 ? (amount / totalCosts) * 100 : 0,
    }));

    // Monthly trends
    const monthlyTrends = this.calculateMonthlyTrends(harvests, expenses);

    return {
      totalCosts,
      totalRevenue,
      profitMargin: Math.round(profitMargin * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      costBreakdown,
      monthlyTrends,
    };
  }

  /**
   * Calculate yield analysis
   */
  static calculateYieldAnalysis(
    harvests: HarvestRecord[],
    farms: Farm[]
  ): YieldAnalysis {
    const totalArea = farms.reduce((sum, f) => sum + (f.area || 0), 0);
    const currentYield = harvests.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const harvestValue = harvests.reduce(
      (sum, r) => sum + (r.quantity || 0) * (r.price || 0),
      0
    );
    const yieldPerAcre = totalArea > 0 ? currentYield / totalArea : 0;
    const avgPricePerKg = currentYield > 0 ? harvestValue / currentYield : 0;

    // Grade distribution
    const gradeMap = new Map<string, number>();
    harvests.forEach((h) => {
      const grade = h.grade || 'Unknown';
      gradeMap.set(grade, (gradeMap.get(grade) || 0) + (h.quantity || 0));
    });

    const gradeDistribution = Array.from(gradeMap.entries()).map(([grade, quantity]) => ({
      grade,
      quantity,
      percentage: currentYield > 0 ? (quantity / currentYield) * 100 : 0,
    }));

    return {
      currentYield,
      yieldPerAcre: Math.round(yieldPerAcre * 100) / 100,
      totalArea,
      harvestValue,
      avgPricePerKg: Math.round(avgPricePerKg * 100) / 100,
      gradeDistribution,
    };
  }

  /**
   * Calculate performance metrics
   */
  static calculatePerformanceMetrics(
    analytics: AnalyticsData,
    costAnalysis: CostAnalysis,
    yieldAnalysis: YieldAnalysis
  ): PerformanceMetrics {
    const recommendations: string[] = [];
    const alerts: PerformanceMetrics['alerts'] = [];

    // Irrigation score (based on consistency)
    const irrigationScore = Math.min(100, analytics.totalIrrigationHours * 5);

    // Spraying score (based on preventive care)
    const sprayingScore = Math.min(100, analytics.totalSprayCount * 10);

    // Harvesting score (based on yield and quality)
    const harvestingScore = yieldAnalysis.yieldPerAcre > 0 ? Math.min(100, yieldAnalysis.yieldPerAcre / 10) : 50;

    // Cost efficiency score
    const costEfficiencyScore = costAnalysis.roi > 0 ? Math.min(100, costAnalysis.roi) : 50;

    // Overall score
    const overallScore = Math.round(
      (irrigationScore + sprayingScore + harvestingScore + costEfficiencyScore) / 4
    );

    // Generate recommendations
    if (irrigationScore < 50) {
      recommendations.push('Consider increasing irrigation frequency for optimal growth');
    }
    if (sprayingScore < 50) {
      recommendations.push('Schedule preventive spray treatments to protect crops');
    }
    if (costAnalysis.profitMargin < 20) {
      recommendations.push('Review expense categories to improve profit margins');
    }
    if (yieldAnalysis.yieldPerAcre < 1000) {
      recommendations.push('Explore yield improvement techniques for better productivity');
    }

    // Generate alerts
    if (costAnalysis.profitMargin < 0) {
      alerts.push({
        type: 'warning',
        message: 'Current operations are running at a loss',
        action: 'Review expense breakdown and revenue opportunities',
      });
    }
    if (costAnalysis.roi > 50) {
      alerts.push({
        type: 'success',
        message: 'Great ROI performance!',
      });
    }
    if (analytics.totalFarms === 0) {
      alerts.push({
        type: 'info',
        message: 'Add farms to start tracking analytics',
      });
    }

    return {
      overallScore,
      categories: {
        irrigation: {
          score: Math.round(irrigationScore),
          trend: irrigationScore > 50 ? 'up' : 'stable',
          description: `${analytics.totalIrrigationHours.toFixed(1)}h total irrigation`,
        },
        spraying: {
          score: Math.round(sprayingScore),
          trend: sprayingScore > 50 ? 'up' : 'stable',
          description: `${analytics.totalSprayCount} spray applications`,
        },
        harvesting: {
          score: Math.round(harvestingScore),
          trend: harvestingScore > 50 ? 'up' : 'stable',
          description: `${yieldAnalysis.yieldPerAcre.toFixed(1)} kg/acre yield`,
        },
        costEfficiency: {
          score: Math.round(costEfficiencyScore),
          trend: costAnalysis.roi > 0 ? 'up' : 'down',
          description: `${costAnalysis.profitMargin.toFixed(1)}% profit margin`,
        },
      },
      recommendations,
      alerts,
    };
  }

  // Helper methods
  private static getCutoffDate(timeRange: TimeRange): Date | null {
    if (timeRange === 'all') return null;
    const now = new Date();
    switch (timeRange) {
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      case '1y':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return null;
    }
  }

  private static filterByDate<T extends { date: string }>(
    records: T[],
    cutoffDate: Date | null
  ): T[] {
    if (!cutoffDate) return records;
    return records.filter((r) => new Date(r.date) >= cutoffDate);
  }

  private static groupByMonth(irrigations: IrrigationRecord[]) {
    const byMonth = new Map<string, { hours: number; count: number }>();
    irrigations.forEach((r) => {
      const date = new Date(r.date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const existing = byMonth.get(monthYear) || { hours: 0, count: 0 };
      byMonth.set(monthYear, {
        hours: existing.hours + (r.duration || 0),
        count: existing.count + 1,
      });
    });
    return Array.from(byMonth.entries())
      .map(([month, data]) => ({ month, ...data }))
      .slice(-6);
  }

  private static groupSpraysByType(sprays: SprayRecord[]) {
    const byType = new Map<string, number>();
    sprays.forEach((r) => {
      const type = r.chemical?.trim() || 'Unknown';
      byType.set(type, (byType.get(type) || 0) + 1);
    });
    return Array.from(byType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private static groupHarvestsByFarm(harvests: HarvestRecord[], farms: Farm[]) {
    const byFarm = new Map<number, { quantity: number; value: number }>();
    harvests.forEach((h) => {
      const existing = byFarm.get(h.farm_id) || { quantity: 0, value: 0 };
      byFarm.set(h.farm_id, {
        quantity: existing.quantity + (h.quantity || 0),
        value: existing.value + (h.quantity || 0) * (h.price || 0),
      });
    });
    return Array.from(byFarm.entries()).map(([farmId, data]) => ({
      farmName: farms.find((f) => f.id === farmId)?.name || 'Unknown',
      ...data,
    }));
  }

  private static groupExpensesByType(expenses: ExpenseRecord[]) {
    const byType = new Map<string, number>();
    expenses.forEach((e) => {
      const type = e.type || 'other';
      byType.set(type, (byType.get(type) || 0) + (e.cost || 0));
    });
    return Array.from(byType.entries())
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  private static calculateMonthlyTrends(
    harvests: HarvestRecord[],
    expenses: ExpenseRecord[]
  ) {
    const months = new Map<
      string,
      { revenue: number; costs: number; profit: number }
    >();

    harvests.forEach((h) => {
      const date = new Date(h.date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const existing = months.get(monthYear) || { revenue: 0, costs: 0, profit: 0 };
      const revenue = (h.quantity || 0) * (h.price || 0);
      months.set(monthYear, {
        ...existing,
        revenue: existing.revenue + revenue,
        profit: existing.profit + revenue,
      });
    });

    expenses.forEach((e) => {
      const date = new Date(e.date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      const existing = months.get(monthYear) || { revenue: 0, costs: 0, profit: 0 };
      months.set(monthYear, {
        ...existing,
        costs: existing.costs + (e.cost || 0),
        profit: existing.profit - (e.cost || 0),
      });
    });

    return Array.from(months.entries())
      .map(([month, data]) => ({ month, ...data }))
      .slice(-6);
  }

  private static getRecentActivity(
    irrigations: IrrigationRecord[],
    sprays: SprayRecord[],
    harvests: HarvestRecord[],
    farms: Farm[]
  ): RecentActivity[] {
    const getFarmName = (farmId: number) =>
      farms.find((f) => f.id === farmId)?.name || 'Unknown';

    const activities: RecentActivity[] = [];

    irrigations.slice(-5).forEach((r) => {
      activities.push({
        type: 'irrigation',
        farmName: getFarmName(r.farm_id),
        date: r.date,
        details: `${r.duration}h irrigation - ${r.growth_stage || 'N/A'}`,
      });
    });

    sprays.slice(-5).forEach((r) => {
      activities.push({
        type: 'spray',
        farmName: getFarmName(r.farm_id),
        date: r.date,
        details: `${r.chemical?.trim() || 'Chemical'} treatment`,
      });
    });

    harvests.slice(-5).forEach((r) => {
      activities.push({
        type: 'harvest',
        farmName: getFarmName(r.farm_id),
        date: r.date,
        details: `${r.quantity}kg harvested - ${r.grade} grade`,
      });
    });

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }
}
