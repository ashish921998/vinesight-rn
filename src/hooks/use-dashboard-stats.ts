/**
 * Dashboard Stats Hook
 * Aggregates data from farms, workers, and records for the dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { getDataAccess } from '@/data-access';
import { getUserId } from '../lib/auth-utils';
import { queryKeys } from './query-keys';
import { useAppModeStore } from '../stores/app-mode-store';
import type { Farm } from '../types';
import { isLowWater } from '../types';
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
  'overdueTask' | 'noRecentLogs' | 'lowWaterLevel' | 'phiDeadline';

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

      const todayStats = await getDataAccess().dashboardStats.getTodayStats({
        userId,
        limit,
      });
      const { farms, overdueTasks, recentLogFarmIds, recentLogError, phiDeadlines } = todayStats;
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

      // RPC may not be deployed in all environments — degrade gracefully rather than
      // surfacing a dev warning overlay on every screen.
      if (recentLogError) {
        if (__DEV__) {
          console.info(
            '[useTodayNeedsAttention] recentLogFarms RPC unavailable:',
            recentLogError.message,
          );
        }
      }

      const items: TodayNeedAttentionItem[] = [];

      overdueTasks.forEach((task) => {
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
      const recentLogFarmRows = Array.isArray(recentLogFarmIds) ? recentLogFarmIds : [];
      recentLogFarmRows.forEach((record: RecentLogFarmIdRow) => {
        if (typeof record.farm_id === 'number') {
          farmsWithRecentLogs.add(record.farm_id);
        }
      });

      // Only flag farms as missing logs when the RPC succeeded; if unavailable,
      // skip the loop entirely to avoid false "needs attention" warnings.
      if (!recentLogError) {
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
      phiDeadlines.forEach((record) => {
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
  /** Optional detail used by richer activity surfaces such as Farm Details. */
  secondaryDetail?: string;
  farmId: number;
  farmName: string;
}

// ============================================================
// MARK: - Dashboard Stats Query
// ============================================================

export function useDashboardStats() {
  // Reactively track the mode so toggling it produces a fresh cache entry and
  // the dashboard re-renders with correct worker/task counts immediately.
  const detailedMode = useAppModeStore((s) => s.detailedMode);

  return useQuery({
    queryKey: queryKeys.dashboard.stats(detailedMode),
    queryFn: async (): Promise<DashboardStats> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not authenticated');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = toDateString(sevenDaysAgo);
      const counts = await getDataAccess().dashboardStats.getDashboardCounts({
        userId,
        detailedMode,
        since: dateStr,
      });
      return {
        farmsCount: counts.farmsCount,
        activeWorkersCount: counts.workersCount,
        recentActivitiesCount: counts.activitiesCount,
        pendingTasksCount: counts.pendingTasksCount,
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

      const farms = await getDataAccess().dashboardStats.listFarmsNeedingAttention(userId);

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

      const recent = await getDataAccess().dashboardStats.getRecentActivities({
        userId,
        limit,
      });
      const { farms, irrigation, spray, harvest, expense, fertigation, dailyNotes } = recent;

      if (!farms || farms.length === 0) return [];

      const farmMap = new Map(farms.map((f) => [f.id, f.name]));

      const activities: RecentActivity[] = [];

      // Map irrigation
      irrigation.forEach((r) => {
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
      spray.forEach((r) => {
        activities.push({
          id: `spray_${r.id}`,
          type: 'spray',
          date: r.date,
          description: r.chemical?.trim() ?? '',
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? '',
        });
      });

      // Map harvest
      harvest.forEach((r) => {
        const grade = r.grade?.trim();
        const quantity = `${r.quantity?.toFixed(0) ?? 0} kg`;
        activities.push({
          id: `harvest_${r.id}`,
          type: 'harvest',
          date: r.date,
          description: grade ? `${quantity} · ${grade}` : quantity,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? '',
        });
      });

      // Map expense
      expense.forEach((r) => {
        const formattedCost = formatCurrency(r.cost ?? 0, preferredCurrency, {
          minimumFractionDigits: 0,
        });
        const expenseType = r.type?.trim();
        activities.push({
          id: `expense_${r.id}`,
          type: 'expense',
          date: r.date,
          description: expenseType ? `${formattedCost} · ${expenseType}` : formattedCost,
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? '',
        });
      });

      // Map fertigation
      fertigation.forEach((r) => {
        activities.push({
          id: `fertigation_${r.id}`,
          type: 'fertigation',
          date: r.date,
          description: '',
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? '',
        });
      });

      // Map notes
      dailyNotes.forEach((r) => {
        activities.push({
          id: `note_${r.id}`,
          type: 'note',
          date: r.date,
          description: r.notes?.trim() ?? '',
          farmId: r.farm_id,
          farmName: farmMap.get(r.farm_id) ?? '',
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
