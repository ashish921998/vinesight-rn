/**
 * Dashboard Stats Hook
 * Aggregates data from farms, workers, and records for the dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from './queryKeys';
import type { Farm, Worker, HarvestRecord, IrrigationRecord, SprayRecord } from '../types';
import { TABLES, isLowWater } from '../types';
import type { LogTypeId } from '../constants';

// ============================================================
// MARK: - Types
// ============================================================

export interface DashboardStats {
  farmsCount: number;
  activeWorkersCount: number;
  recentActivitiesCount: number;
  totalHarvest: number;
}

export interface FarmNeedingAttention {
  farm: Farm;
  reason: string;
}

export interface RecentActivity {
  id: string;
  type: LogTypeId;
  date: string;
  description: string;
  farmId: number;
  farmName: string;
}

// ============================================================
// MARK: - Helper to get current user ID
// ============================================================

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ============================================================
// MARK: - Dashboard Stats Query
// ============================================================

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async (): Promise<DashboardStats> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not authenticated');

      // Fetch farms count
      const { count: farmsCount } = await supabase
        .from(TABLES.FARMS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Fetch active workers count
      const { count: workersCount } = await supabase
        .from(TABLES.WORKERS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Get recent activities count (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];

      // Get farm IDs first
      const { data: farms } = await supabase
        .from(TABLES.FARMS)
        .select('id')
        .eq('user_id', userId);

      const farmIds = farms?.map(f => f.id) ?? [];

      let activitiesCount = 0;
      let totalHarvest = 0;

      if (farmIds.length > 0) {
        // Count irrigation records
        const { count: irrigationCount } = await supabase
          .from(TABLES.IRRIGATION_RECORDS)
          .select('*', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date', dateStr);

        // Count spray records
        const { count: sprayCount } = await supabase
          .from(TABLES.SPRAY_RECORDS)
          .select('*', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date', dateStr);

        // Count harvest records and sum quantity
        const { count: harvestCount, data: harvestData } = await supabase
          .from(TABLES.HARVEST_RECORDS)
          .select('quantity', { count: 'exact' })
          .in('farm_id', farmIds)
          .gte('date', dateStr);

        // Count expense records
        const { count: expenseCount } = await supabase
          .from(TABLES.EXPENSE_RECORDS)
          .select('*', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date', dateStr);

        // Count fertigation records
        const { count: fertigationCount } = await supabase
          .from(TABLES.FERTIGATION_RECORDS)
          .select('*', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .gte('date', dateStr);

        activitiesCount =
          (irrigationCount ?? 0) +
          (sprayCount ?? 0) +
          (harvestCount ?? 0) +
          (expenseCount ?? 0) +
          (fertigationCount ?? 0);

        // Sum harvest quantities
        if (harvestData) {
          totalHarvest = harvestData.reduce((sum, h) => sum + (h.quantity ?? 0), 0);
        }
      }

      return {
        farmsCount: farmsCount ?? 0,
        activeWorkersCount: workersCount ?? 0,
        recentActivitiesCount: activitiesCount,
        totalHarvest,
      };
    },
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================
// MARK: - Farms Needing Attention Query
// ============================================================

export function useFarmsNeedingAttention() {
  return useQuery({
    queryKey: queryKeys.dashboard.farmsNeedingAttention(),
    queryFn: async (): Promise<FarmNeedingAttention[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data: farms } = await supabase
        .from(TABLES.FARMS)
        .select('*')
        .eq('user_id', userId);

      if (!farms) return [];

      return farms
        .filter(farm => isLowWater(farm))
        .map(farm => ({
          farm,
          reason: 'Low water level',
        }));
    },
    staleTime: 60000, // 1 minute
  });
}

// ============================================================
// MARK: - Recent Activities Query
// ============================================================

export function useRecentActivities(limit: number = 5) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentActivities(limit),
    queryFn: async (): Promise<RecentActivity[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      // Get farms first
      const { data: farms } = await supabase
        .from(TABLES.FARMS)
        .select('id, name')
        .eq('user_id', userId);

      if (!farms || farms.length === 0) return [];

      const farmIds = farms.map(f => f.id);
      const farmMap = new Map(farms.map(f => [f.id, f.name]));

      // Fetch recent records from each table
      const [irrigation, spray, harvest, expense, fertigation] = await Promise.all([
        supabase
          .from(TABLES.IRRIGATION_RECORDS)
          .select('id, farm_id, date, duration')
          .in('farm_id', farmIds)
          .order('date', { ascending: false })
          .limit(limit),
        supabase
          .from(TABLES.SPRAY_RECORDS)
          .select('id, farm_id, date, chemical')
          .in('farm_id', farmIds)
          .order('date', { ascending: false })
          .limit(limit),
        supabase
          .from(TABLES.HARVEST_RECORDS)
          .select('id, farm_id, date, quantity, grade')
          .in('farm_id', farmIds)
          .order('date', { ascending: false })
          .limit(limit),
        supabase
          .from(TABLES.EXPENSE_RECORDS)
          .select('id, farm_id, date, type, cost')
          .in('farm_id', farmIds)
          .order('date', { ascending: false })
          .limit(limit),
        supabase
          .from(TABLES.FERTIGATION_RECORDS)
          .select('id, farm_id, date')
          .in('farm_id', farmIds)
          .order('date', { ascending: false })
          .limit(limit),
      ]);

      const activities: RecentActivity[] = [];

      // Map irrigation
      irrigation.data?.forEach(r => {
        activities.push({
          id: `irrigation_${r.id}`,
          type: 'irrigation',
          date: r.date,
          description: `Duration: ${r.duration?.toFixed(1) ?? 0} hrs`,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Map spray
      spray.data?.forEach(r => {
        activities.push({
          id: `spray_${r.id}`,
          type: 'spray',
          date: r.date,
          description: r.chemical ?? 'Spray application',
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Map harvest
      harvest.data?.forEach(r => {
        activities.push({
          id: `harvest_${r.id}`,
          type: 'harvest',
          date: r.date,
          description: `${r.quantity?.toFixed(0) ?? 0} kg - ${r.grade ?? 'Unknown grade'}`,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Map expense
      expense.data?.forEach(r => {
        const formattedCost = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 0,
        }).format(r.cost ?? 0);
        activities.push({
          id: `expense_${r.id}`,
          type: 'expense',
          date: r.date,
          description: `${formattedCost} - ${r.type ?? 'Expense'}`,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Map fertigation
      fertigation.data?.forEach(r => {
        activities.push({
          id: `fertigation_${r.id}`,
          type: 'fertigation',
          date: r.date,
          description: 'Fertigation applied',
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Sort by date and take limit
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    },
    staleTime: 30000,
  });
}
