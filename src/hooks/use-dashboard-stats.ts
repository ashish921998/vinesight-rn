/**
 * Dashboard Stats Hook
 * Aggregates data from farms, workers, and records for the dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/auth-utils';
import { queryKeys } from './query-keys';
import type { Farm } from '../types';
import { TABLES, isLowWater } from '../types';
import type { LogTypeId } from '../constants';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from './use-currency';
import { formatLocalDate } from '@/utils/date';

// ============================================================
// MARK: - Types
// ============================================================

export interface DashboardStats {
  farmsCount: number;
  activeWorkersCount: number;
  recentActivitiesCount: number;
  pendingTasksCount: number;
}

export type TodayNeedAttentionType =
  | 'overdueTask'
  | 'noRecentLogs'
  | 'lowWaterLevel'
  | 'phiDeadline';

export type TodayNeedAttentionSeverity = 'high' | 'medium' | 'low';

export interface TodayNeedAttentionItem {
  id: string;
  type: TodayNeedAttentionType;
  severity: TodayNeedAttentionSeverity;
  farmId: number;
  farmName: string;
  taskId?: number | null;
  taskTitle?: string | null;
  dueDate?: string | null;
  safeHarvestDate?: string | null;
  chemical?: string | null;
}

interface RecentLogFarmIdRow {
  farm_id: number;
}

const RECENT_LOG_WINDOW_DAYS = 7;
const PHI_DEADLINE_WINDOW_DAYS = 3;
const severityRank: Record<TodayNeedAttentionSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const toDateString = (value: Date): string => formatLocalDate(value);

export function useTodayNeedsAttention(limit: number = 10) {
  return useQuery({
    queryKey: [...queryKeys.dashboard.todayNeedsAttention(), limit],
    queryFn: async (): Promise<TodayNeedAttentionItem[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data: farms, error: farmsError } = await supabase
        .from(TABLES.FARMS)
        .select('id, name, remaining_water, total_tank_capacity')
        .eq('user_id', userId);

      if (farmsError) throw farmsError;
      if (!farms || farms.length === 0) return [];

      const farmIds = farms
        .map((farm) => farm.id)
        .filter((farmId): farmId is number => typeof farmId === 'number');
      if (farmIds.length === 0) return [];

      const farmNameById = new Map(
        farms
          .filter((farm) => typeof farm.id === 'number')
          .map((farm) => [farm.id as number, farm.name ?? 'Farm']),
      );

      const today = new Date();
      const todayStr = toDateString(today);
      const recentLogThreshold = new Date(today);
      recentLogThreshold.setDate(recentLogThreshold.getDate() - RECENT_LOG_WINDOW_DAYS);
      const recentLogThresholdStr = toDateString(recentLogThreshold);
      const phiDeadlineThreshold = new Date(today);
      phiDeadlineThreshold.setDate(phiDeadlineThreshold.getDate() + PHI_DEADLINE_WINDOW_DAYS);
      const phiDeadlineThresholdStr = toDateString(phiDeadlineThreshold);

      const [overdueTasksResult, recentLogFarmsResult, phiDeadlinesResult] = await Promise.all([
        supabase
          .from('task_reminders')
          .select('id, farm_id, title, due_date')
          .in('farm_id', farmIds)
          .eq('completed', false)
          .not('due_date', 'is', null)
          .lt('due_date', todayStr)
          .order('due_date', { ascending: true })
          .limit(limit),
        supabase
          .rpc('get_recent_log_farm_ids', {
            p_farm_ids: farmIds,
            p_since: recentLogThresholdStr,
          })
          .returns<RecentLogFarmIdRow[]>(),
        supabase
          .from(TABLES.SPRAY_RECORDS)
          .select('id, farm_id, safe_harvest_date, chemical')
          .in('farm_id', farmIds)
          .not('safe_harvest_date', 'is', null)
          .gte('safe_harvest_date', todayStr)
          .lte('safe_harvest_date', phiDeadlineThresholdStr)
          .order('safe_harvest_date', { ascending: true }),
      ]);

      if (overdueTasksResult.error) throw overdueTasksResult.error;
      if (phiDeadlinesResult.error) throw phiDeadlinesResult.error;
      // RPC may not be deployed in all environments — degrade gracefully rather than
      // surfacing a dev error overlay on every screen.
      if (recentLogFarmsResult.error) {
        if (__DEV__) {
          console.warn(
            '[useTodayNeedsAttention] recentLogFarms RPC unavailable:',
            recentLogFarmsResult.error.message,
          );
        }
      }

      const items: TodayNeedAttentionItem[] = [];

      overdueTasksResult.data?.forEach((task) => {
        if (typeof task.farm_id !== 'number') return;
        items.push({
          id: `overdue-task-${task.id}`,
          type: 'overdueTask',
          severity: 'high',
          farmId: task.farm_id,
          farmName: farmNameById.get(task.farm_id) ?? 'Farm',
          taskId: task.id ?? null,
          taskTitle: task.title ?? null,
          dueDate: task.due_date ?? null,
        });
      });

      farms.forEach((farm) => {
        if (typeof farm.id !== 'number') return;
        if (!isLowWater(farm)) return;
        items.push({
          id: `low-water-${farm.id}`,
          type: 'lowWaterLevel',
          severity: 'high',
          farmId: farm.id,
          farmName: farmNameById.get(farm.id) ?? 'Farm',
        });
      });

      const farmsWithRecentLogs = new Set<number>();
      const recentLogFarmRows = Array.isArray(recentLogFarmsResult.data)
        ? recentLogFarmsResult.data
        : [];
      recentLogFarmRows.forEach((record: RecentLogFarmIdRow) => {
        if (typeof record.farm_id === 'number') {
          farmsWithRecentLogs.add(record.farm_id);
        }
      });

      // Only flag farms as missing logs when the RPC succeeded; if unavailable,
      // skip the loop entirely to avoid false "needs attention" warnings.
      if (!recentLogFarmsResult.error) {
        farms.forEach((farm) => {
          if (typeof farm.id !== 'number') return;
          if (farmsWithRecentLogs.has(farm.id)) return;
          items.push({
            id: `no-recent-log-${farm.id}`,
            type: 'noRecentLogs',
            severity: 'medium',
            farmId: farm.id,
            farmName: farmNameById.get(farm.id) ?? 'Farm',
          });
        });
      }

      const phiDeadlineFarms = new Set<number>();
      phiDeadlinesResult.data?.forEach((record) => {
        if (typeof record.farm_id !== 'number') return;
        if (phiDeadlineFarms.has(record.farm_id)) return;
        phiDeadlineFarms.add(record.farm_id);
        items.push({
          id: `phi-deadline-${record.id}`,
          type: 'phiDeadline',
          severity: 'medium',
          farmId: record.farm_id,
          farmName: farmNameById.get(record.farm_id) ?? 'Farm',
          safeHarvestDate: record.safe_harvest_date ?? null,
          chemical: record.chemical ?? null,
        });
      });

      return items
        .sort((a, b) => {
          const severityDelta = severityRank[a.severity] - severityRank[b.severity];
          if (severityDelta !== 0) return severityDelta;
          const aDate = a.dueDate ?? a.safeHarvestDate ?? '9999-12-31';
          const bDate = b.dueDate ?? b.safeHarvestDate ?? '9999-12-31';
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return (a.farmName ?? 'Farm').localeCompare(b.farmName ?? 'Farm');
        })
        .slice(0, limit);
    },
    staleTime: 60000,
  });
}

export interface FarmNeedingAttention {
  farm: Farm;
  reason: 'lowWaterLevel';
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
      const dateStr = toDateString(sevenDaysAgo);

      // Get farm IDs first
      const { data: farms } = await supabase.from(TABLES.FARMS).select('id').eq('user_id', userId);

      const farmIds = farms?.map((f) => f.id) ?? [];

      let activitiesCount = 0;
      let pendingTasksCount = 0;

      if (farmIds.length > 0) {
        const [irrigation, spray, harvest, expense, fertigation, tasks] = await Promise.all([
          supabase
            .from(TABLES.IRRIGATION_RECORDS)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', dateStr),
          supabase
            .from(TABLES.SPRAY_RECORDS)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', dateStr),
          supabase
            .from(TABLES.HARVEST_RECORDS)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', dateStr),
          supabase
            .from(TABLES.EXPENSE_RECORDS)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', dateStr),
          supabase
            .from(TABLES.FERTIGATION_RECORDS)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', dateStr),
          supabase
            .from('task_reminders')
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .eq('completed', false),
        ]);

        activitiesCount =
          (irrigation.count ?? 0) +
          (spray.count ?? 0) +
          (harvest.count ?? 0) +
          (expense.count ?? 0) +
          (fertigation.count ?? 0);

        pendingTasksCount = tasks.count ?? 0;
      }

      return {
        farmsCount: farmsCount ?? 0,
        activeWorkersCount: workersCount ?? 0,
        recentActivitiesCount: activitiesCount,
        pendingTasksCount,
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

      const { data: farms } = await supabase.from(TABLES.FARMS).select('*').eq('user_id', userId);

      if (!farms) return [];

      return farms
        .filter((farm) => isLowWater(farm))
        .map((farm) => ({
          farm,
          reason: 'lowWaterLevel' as const,
        }));
    },
    staleTime: 60000, // 1 minute
  });
}

// ============================================================
// MARK: - Recent Activities Query
// ============================================================

export function useRecentActivities(limit: number = 5) {
  const preferredCurrency = useCurrency();

  return useQuery({
    queryKey: [...queryKeys.dashboard.recentActivities(limit), preferredCurrency],
    queryFn: async (): Promise<RecentActivity[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      // Get farms first
      const { data: farms } = await supabase
        .from(TABLES.FARMS)
        .select('id, name')
        .eq('user_id', userId);

      if (!farms || farms.length === 0) return [];

      const farmIds = farms.map((f) => f.id);
      const farmMap = new Map(farms.map((f) => [f.id, f.name]));

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
      irrigation.data?.forEach((r) => {
        const duration = r.duration ?? 0;
        const displayDuration = Number.isInteger(duration) ? duration : duration.toFixed(1);
        activities.push({
          id: `irrigation_${r.id}`,
          type: 'irrigation',
          date: r.date,
          description: `${displayDuration}h`,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? 'Unknown',
        });
      });

      // Map spray
      spray.data?.forEach((r) => {
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
      harvest.data?.forEach((r) => {
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
      expense.data?.forEach((r) => {
        const formattedCost = formatCurrency(r.cost ?? 0, preferredCurrency, {
          minimumFractionDigits: 0,
        });
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
      fertigation.data?.forEach((r) => {
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
