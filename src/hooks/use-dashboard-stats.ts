/**
 * Dashboard Stats Hook
 * Aggregates data from farms, workers, and records for the dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePowerSyncDb } from '../lib/powersync/db';
import { getUserId } from '../lib/auth-utils';
import { queryKeys } from './query-keys';
import type { Farm } from '../types';
import { TABLES, isLowWater } from '../types';
import type { LogTypeId } from '../constants';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from './use-currency';

// ============================================================
// MARK: - Types
// ============================================================

export interface DashboardStats {
  farmsCount: number;
  activeWorkersCount: number;
  recentActivitiesCount: number;
  pendingTasksCount: number;
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

/**
 * Fetch dashboard statistics.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useDashboardStats() {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async (): Promise<DashboardStats> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not authenticated');

      if (db) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateStr = sevenDaysAgo.toISOString().split('T')[0];

        const [farmsResult, workersResult, farmIdsResult] = await Promise.all([
          db.get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM farms WHERE user_id = ?`, [userId]),
          db.get<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM workers WHERE user_id = ? AND is_active = 1`,
            [userId],
          ),
          db.getAll<{ id: number }>(`SELECT id FROM farms WHERE user_id = ?`, [userId]),
        ]);

        const farmsCount = farmsResult?.cnt ?? 0;
        const activeWorkersCount = workersResult?.cnt ?? 0;
        const farmIds = farmIdsResult.map((f) => f.id);

        let activitiesCount = 0;
        // Note: task_reminders is not in the PowerSync schema, so pendingTasksCount
        // falls back to Supabase or defaults to 0
        let pendingTasksCount = 0;

        if (farmIds.length > 0) {
          const placeholders = farmIds.map(() => '?').join(',');

          const [irrigationCnt, sprayCnt, harvestCnt, expenseCnt, fertigationCnt] =
            await Promise.all([
              db.get<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM irrigation_records WHERE farm_id IN (${placeholders}) AND date >= ?`,
                [...farmIds, dateStr],
              ),
              db.get<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM spray_records WHERE farm_id IN (${placeholders}) AND date >= ?`,
                [...farmIds, dateStr],
              ),
              db.get<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM harvest_records WHERE farm_id IN (${placeholders}) AND date >= ?`,
                [...farmIds, dateStr],
              ),
              db.get<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM expense_records WHERE farm_id IN (${placeholders}) AND date >= ?`,
                [...farmIds, dateStr],
              ),
              db.get<{ cnt: number }>(
                `SELECT COUNT(*) as cnt FROM fertigation_records WHERE farm_id IN (${placeholders}) AND date >= ?`,
                [...farmIds, dateStr],
              ),
            ]);

          activitiesCount =
            (irrigationCnt?.cnt ?? 0) +
            (sprayCnt?.cnt ?? 0) +
            (harvestCnt?.cnt ?? 0) +
            (expenseCnt?.cnt ?? 0) +
            (fertigationCnt?.cnt ?? 0);

          // task_reminders not in PowerSync schema — try Supabase for pending tasks
          try {
            const { count } = await supabase
              .from('task_reminders')
              .select('*', { count: 'exact', head: true })
              .in('farm_id', farmIds)
              .eq('completed', false);
            pendingTasksCount = count ?? 0;
          } catch {
            // Offline or table doesn't exist — default to 0
          }
        }

        return {
          farmsCount,
          activeWorkersCount,
          recentActivitiesCount: activitiesCount,
          pendingTasksCount,
        };
      }

      // Fallback: Supabase REST
      const { count: farmsCount } = await supabase
        .from(TABLES.FARMS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: workersCount } = await supabase
        .from(TABLES.WORKERS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];

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

/**
 * Fetch farms that need attention (e.g. low water level).
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useFarmsNeedingAttention() {
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: queryKeys.dashboard.farmsNeedingAttention(),
    queryFn: async (): Promise<FarmNeedingAttention[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      let farms: Farm[];

      if (db) {
        farms = await db.getAll<Farm>(`SELECT * FROM farms WHERE user_id = ?`, [userId]);
      } else {
        // Fallback: Supabase REST
        const { data } = await supabase.from(TABLES.FARMS).select('*').eq('user_id', userId);
        farms = data ?? [];
      }

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

/**
 * Fetch recent activities across all farms.
 * Reads from PowerSync local SQLite DB when available, falls back to Supabase.
 */
export function useRecentActivities(limit: number = 5) {
  const preferredCurrency = useCurrency();
  const db = usePowerSyncDb();

  return useQuery({
    queryKey: [...queryKeys.dashboard.recentActivities(limit), preferredCurrency],
    queryFn: async (): Promise<RecentActivity[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      if (db) {
        // Get farms first
        const farms = await db.getAll<{ id: number; name: string }>(
          `SELECT id, name FROM farms WHERE user_id = ?`,
          [userId],
        );

        if (farms.length === 0) return [];

        const farmIds = farms.map((f) => f.id);
        const farmMap = new Map(farms.map((f) => [f.id, f.name]));
        const placeholders = farmIds.map(() => '?').join(',');

        const [irrigationRows, sprayRows, harvestRows, expenseRows, fertigationRows] =
          await Promise.all([
            db.getAll<{ id: string; farm_id: number; date: string; duration: number | null }>(
              `SELECT id, farm_id, date, duration FROM irrigation_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC LIMIT ?`,
              [...farmIds, limit],
            ),
            db.getAll<{ id: string; farm_id: number; date: string; chemical: string | null }>(
              `SELECT id, farm_id, date, chemical FROM spray_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC LIMIT ?`,
              [...farmIds, limit],
            ),
            db.getAll<{
              id: string;
              farm_id: number;
              date: string;
              quantity: number | null;
              grade: string | null;
            }>(
              `SELECT id, farm_id, date, quantity, grade FROM harvest_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC LIMIT ?`,
              [...farmIds, limit],
            ),
            db.getAll<{
              id: string;
              farm_id: number;
              date: string;
              type: string | null;
              cost: number | null;
            }>(
              `SELECT id, farm_id, date, type, cost FROM expense_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC LIMIT ?`,
              [...farmIds, limit],
            ),
            db.getAll<{ id: string; farm_id: number; date: string }>(
              `SELECT id, farm_id, date FROM fertigation_records WHERE farm_id IN (${placeholders}) ORDER BY date DESC LIMIT ?`,
              [...farmIds, limit],
            ),
          ]);

        const activities: RecentActivity[] = [];

        irrigationRows.forEach((r) => {
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

        sprayRows.forEach((r) => {
          activities.push({
            id: `spray_${r.id}`,
            type: 'spray',
            date: r.date,
            description: r.chemical ?? 'Spray application',
            farmId: r.farm_id,
            farmName: farmMap.get(r.farm_id) ?? 'Unknown',
          });
        });

        harvestRows.forEach((r) => {
          activities.push({
            id: `harvest_${r.id}`,
            type: 'harvest',
            date: r.date,
            description: `${r.quantity?.toFixed(0) ?? 0} kg - ${r.grade ?? 'Unknown grade'}`,
            farmId: r.farm_id,
            farmName: farmMap.get(r.farm_id) ?? 'Unknown',
          });
        });

        expenseRows.forEach((r) => {
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

        fertigationRows.forEach((r) => {
          activities.push({
            id: `fertigation_${r.id}`,
            type: 'fertigation',
            date: r.date,
            description: 'Fertigation applied',
            farmId: r.farm_id,
            farmName: farmMap.get(r.farm_id) ?? 'Unknown',
          });
        });

        return activities
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit);
      }

      // Fallback: Supabase REST
      const { data: farms } = await supabase
        .from(TABLES.FARMS)
        .select('id, name')
        .eq('user_id', userId);

      if (!farms || farms.length === 0) return [];

      const farmIds = farms.map((f) => f.id);
      const farmMap = new Map(farms.map((f) => [f.id, f.name]));

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

      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    },
    staleTime: 30000,
  });
}
