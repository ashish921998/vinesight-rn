/**
 * Analytics Types for Vinesight
 */

// Overview analytics data
export interface AnalyticsData {
  totalFarms: number;
  totalArea: number;
  totalIrrigationHours: number;
  totalSprayCount: number;
  totalHarvestQuantity: number;
  totalHarvestValue: number;
  totalExpenses: number;
  irrigationsByMonth: MonthlyData[];
  spraysByType: { type: string; count: number }[];
  harvestsByFarm: { farmName: string; quantity: number; value: number }[];
  expensesByType: { type: string; amount: number }[];
  recentActivity: RecentActivity[];
}

// Monthly aggregated data
export interface MonthlyData {
  month: string;
  hours: number;
  count: number;
}

// Recent activity item
export interface RecentActivity {
  type: 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';
  farmName: string;
  date: string;
  details: string;
}

// Cost analysis
export interface CostAnalysis {
  totalCosts: number;
  totalRevenue: number;
  profitMargin: number;
  roi: number;
  costBreakdown: { category: string; amount: number; percentage: number }[];
  monthlyTrends: { month: string; revenue: number; costs: number; profit: number }[];
}

// Yield analysis
export interface YieldAnalysis {
  currentYield: number;
  yieldPerAcre: number;
  totalArea: number;
  harvestValue: number;
  avgPricePerKg: number;
  gradeDistribution: { grade: string; quantity: number; percentage: number }[];
}

// Performance metrics
export interface PerformanceMetrics {
  overallScore: number;
  categories: {
    irrigation: MetricScore;
    spraying: MetricScore;
    harvesting: MetricScore;
    costEfficiency: MetricScore;
  };
  recommendations: string[];
  alerts: PerformanceAlert[];
}

export interface MetricScore {
  score: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export interface PerformanceAlert {
  type: 'warning' | 'success' | 'info';
  message: string;
  action?: string;
}

// Time range for analytics
export type TimeRange = '30d' | '90d' | '1y' | 'all';
