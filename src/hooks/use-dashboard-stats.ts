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
import { useCurrency } from './use-currency';
import { formatLocalDate } from '@/utils/date';
import { useTranslation } from 'react-i18next';
import { activityRowId, type LogRecordInput } from '@/utils/log-description';
import { getActivityRowPresentation } from '@/utils/activity-details';

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
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return useQuery({
    queryKey: [...queryKeys.dashboard.recentActivities(limit), preferredCurrency, language],
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

      // Build { type, data } envelopes carrying the row metadata the canonical
      // presentation layer doesn't need (id/date/farmId), then route every log
      // type through the single canonical mapper so dashboard formatting never
      // drifts from farm-detail / timeline surfaces.
      const envelopes: Array<
        LogRecordInput & { rowId: number | undefined; date: string; farmId: number }
      > = [
        ...irrigation.map((r) => ({
          type: 'irrigation' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
        ...spray.map((r) => ({
          type: 'spray' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
        ...harvest.map((r) => ({
          type: 'harvest' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
        ...expense.map((r) => ({
          type: 'expense' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
        ...fertigation.map((r) => ({
          type: 'fertigation' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
        ...dailyNotes.map((r) => ({
          type: 'note' as const,
          data: r,
          rowId: r.id,
          date: r.date,
          farmId: r.farm_id,
        })),
      ];

      // Pass each envelope directly (not a destructured {type, data} literal) so
      // the discriminated-union correlation is preserved for the mapper.
      const activities: RecentActivity[] = envelopes.map((envelope) => {
        const { description, secondaryDetail } = getActivityRowPresentation(envelope, t, {
          currency: preferredCurrency,
        });
        return {
          id: activityRowId(envelope.type, envelope.rowId),
          type: envelope.type,
          date: envelope.date,
          description,
          secondaryDetail,
          farmId: envelope.farmId,
          farmName: farmMap.get(envelope.farmId) ?? '',
        };
      });

      // Sort by date and take limit
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    },
    staleTime: 30000,
  });
}
