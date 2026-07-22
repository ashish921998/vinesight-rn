import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatLocalDate } from '@/utils/date';
import type {
  DashboardActivityRows,
  DashboardTodayStats,
  DataAccess,
  FarmSeasonStartPayload,
} from './DataAccess';
import type {
  DailyNoteRecord,
  ExpenseRecord,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
} from '@/types/database';

/**
 * Detects a missing farms.display_order column (pre-migration database).
 * Matches by Postgres/PostgREST code and by message because PostgREST
 * schema-cache errors don't always carry a code. Shared with useReorderFarms,
 * which classifies errors thrown by farms.reorder.
 */
export function isMissingDisplayOrderColumnError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = error.message ?? '';
  return (
    /column ["']?display_order["']? does not exist/i.test(message) ||
    /could not find .*display_order.* schema cache/i.test(message)
  );
}

export class SupabaseDataAccess implements DataAccess {
  readonly isConfigured = isSupabaseConfigured;
  readonly from: DataAccess['from'] = (...args) => supabase.from(...args);
  readonly rpc: DataAccess['rpc'] = (...args) => supabase.rpc(...args);
  get auth(): DataAccess['auth'] {
    return supabase.auth;
  }
  get functions(): DataAccess['functions'] {
    return supabase.functions;
  }
  get storage(): DataAccess['storage'] {
    return supabase.storage;
  }
  private async listByFarm<T>(table: string, farmId: number, seasonId?: number): Promise<T[]> {
    let query = supabase
      .from(table)
      .select('*')
      .eq('farm_id', farmId)
      .order('date', { ascending: false });
    if (seasonId !== undefined) query = query.eq('season_id', seasonId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  }

  private async listByFarms<T>(table: string, farmIds: number[]): Promise<T[]> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('farm_id', farmIds)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as T[];
  }

  readonly farms: DataAccess['farms'] = {
    getNextDisplayOrder: async (userId) => {
      const { data, error } = await supabase
        .from('farms')
        .select('display_order')
        .eq('user_id', userId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error && !isMissingDisplayOrderColumnError(error)) throw error;
      return {
        supportsDisplayOrder: !error,
        displayOrder:
          !error && typeof data?.display_order === 'number' ? data.display_order - 1 : 0,
      };
    },
    getExistingSeason: async (farmId) => {
      const { data, error } = await supabase
        .from('farm_seasons')
        .select('id')
        .eq('farm_id', farmId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    startSeason: async (payload: FarmSeasonStartPayload) => {
      const { error } = await supabase.rpc('start_farm_season', payload);
      if (error) throw error;
    },
    createSeason: async (payload) => {
      const { error } = await supabase.from('farm_seasons').insert(payload);
      if (error) throw error;
    },
    getById: async (farmId, userId) => {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('id', farmId)
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    listForUser: async (userId) => {
      let { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error && isMissingDisplayOrderColumnError(error)) {
        ({ data, error } = await supabase
          .from('farms')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }));
      }
      if (error) throw error;
      return data ?? [];
    },
    create: async (payload) => {
      const { data, error } = await supabase.from('farms').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    reorder: async (farmIds) => {
      const { error } = await supabase.rpc('reorder_farms', { p_ordered_farm_ids: farmIds });
      if (error) throw error;
    },
    update: async (farmId, userId, updates) => {
      const { data, error } = await supabase
        .from('farms')
        .update(updates)
        .eq('id', farmId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    updateWaterLevel: async (farmId, updates) => {
      const { data, error } = await supabase
        .from('farms')
        .update(updates)
        .eq('id', farmId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    remove: async (farmId, userId) => {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', farmId)
        .eq('user_id', userId);
      if (error) throw error;
    },
  };
  readonly records: DataAccess['records'] = {
    listIrrigationByFarm: (farmId, seasonId) =>
      this.listByFarm<IrrigationRecord>('irrigation_records', farmId, seasonId),
    listIrrigationByFarms: (farmIds) =>
      this.listByFarms<IrrigationRecord>('irrigation_records', farmIds),
    listSprayByFarm: (farmId, seasonId) =>
      this.listByFarm<SprayRecord>('spray_records', farmId, seasonId),
    listSprayByFarms: (farmIds) => this.listByFarms<SprayRecord>('spray_records', farmIds),
    listFertigationByFarm: (farmId, seasonId) =>
      this.listByFarm<FertigationRecord>('fertigation_records', farmId, seasonId),
    listFertigationByFarms: (farmIds) =>
      this.listByFarms<FertigationRecord>('fertigation_records', farmIds),
    listHarvestByFarm: (farmId, seasonId) =>
      this.listByFarm<HarvestRecord>('harvest_records', farmId, seasonId),
    listHarvestByFarms: (farmIds) => this.listByFarms<HarvestRecord>('harvest_records', farmIds),
    listExpenseByFarm: (farmId, seasonId) =>
      this.listByFarm<ExpenseRecord>('expense_records', farmId, seasonId),
    listExpenseByFarms: (farmIds) => this.listByFarms<ExpenseRecord>('expense_records', farmIds),
    getDailyNote: async (farmId, date) => {
      const { data, error } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('farm_id', farmId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    listDailyNotesByFarm: (farmId, seasonId) =>
      this.listByFarm<DailyNoteRecord>('daily_notes', farmId, seasonId),
    listDailyNotesByFarms: (farmIds) => this.listByFarms<DailyNoteRecord>('daily_notes', farmIds),
    upsertDailyNote: async (payload) => {
      const { data, error } = await supabase
        .from('daily_notes')
        .upsert(payload, { onConflict: 'farm_id,date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    deleteDailyNote: async ({ id, farmId, date }) => {
      let query = supabase.from('daily_notes').delete().eq('farm_id', farmId);
      query = id > 0 ? query.eq('id', id) : query.eq('date', date);
      const { error } = await query;
      if (error) throw error;
    },
    listRecentSprays: async (farmId) => {
      let query = supabase
        .from('spray_records')
        .select('chemical,date,chemical_items,catalog_mix_id')
        .order('date', { ascending: false })
        .limit(80);
      if (farmId !== undefined) query = query.eq('farm_id', farmId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    listRecentFertigations: async (farmId) => {
      let query = supabase
        .from('fertigation_records')
        .select('fertilizers,date')
        .order('date', { ascending: false })
        .limit(80);
      if (farmId !== undefined) query = query.eq('farm_id', farmId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  };
  readonly dashboardStats: DataAccess['dashboardStats'] = {
    getTodayStats: async ({ userId, limit }): Promise<DashboardTodayStats> => {
      const { data: farms, error: farmsError } = await supabase
        .from('farms')
        .select('id, name, remaining_water, total_tank_capacity')
        .eq('user_id', userId);
      if (farmsError) throw farmsError;
      if (!farms?.length)
        return {
          farms: [],
          overdueTasks: [],
          recentLogFarmIds: [],
          recentLogError: null,
          phiDeadlines: [],
        };
      const farmIds = farms
        .map((farm) => farm.id)
        .filter((id): id is number => typeof id === 'number');
      const now = new Date();
      const today = formatLocalDate(now);
      const sinceDate = new Date(now);
      sinceDate.setDate(sinceDate.getDate() - 7);
      const since = formatLocalDate(sinceDate);
      const deadlineDate = new Date(now);
      deadlineDate.setDate(deadlineDate.getDate() + 3);
      const deadline = formatLocalDate(deadlineDate);
      const [overdueTasks, recentLogResult, phiDeadlines] = await Promise.all([
        supabase
          .from('task_reminders')
          .select('id, farm_id, title, due_date')
          .in('farm_id', farmIds)
          .eq('completed', false)
          .not('due_date', 'is', null)
          .lt('due_date', today)
          .order('due_date', { ascending: true })
          .limit(limit),
        supabase.rpc('get_recent_log_farm_ids', { p_farm_ids: farmIds, p_since: since }),
        supabase
          .from('spray_records')
          .select('id, farm_id, safe_harvest_date, chemical')
          .in('farm_id', farmIds)
          .not('safe_harvest_date', 'is', null)
          .gte('safe_harvest_date', today)
          .lte('safe_harvest_date', deadline)
          .order('safe_harvest_date', { ascending: true }),
      ]);
      if (overdueTasks.error) throw overdueTasks.error;
      if (phiDeadlines.error) throw phiDeadlines.error;
      return {
        farms,
        overdueTasks: overdueTasks.data ?? [],
        recentLogFarmIds: recentLogResult.error ? [] : (recentLogResult.data ?? []),
        recentLogError: recentLogResult.error ?? null,
        phiDeadlines: phiDeadlines.data ?? [],
      } as DashboardTodayStats;
    },
    getDashboardCounts: async ({ userId, detailedMode, since }) => {
      const { count: farmsCount } = await supabase
        .from('farms')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      let workersCount = 0;
      if (detailedMode) {
        const { count } = await supabase
          .from('workers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true);
        workersCount = count ?? 0;
      }
      const { data: farms } = await supabase.from('farms').select('id').eq('user_id', userId);
      const farmIds = farms?.map((farm) => farm.id) ?? [];
      if (!farmIds.length)
        return {
          farmsCount: farmsCount ?? 0,
          workersCount,
          activitiesCount: 0,
          pendingTasksCount: 0,
        };
      const tables = [
        'irrigation_records',
        'spray_records',
        'harvest_records',
        'expense_records',
        'fertigation_records',
      ];
      const countQueries = await Promise.all(
        tables.map((table) =>
          supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .in('farm_id', farmIds)
            .gte('date', since),
        ),
      );
      let pendingTasksCount = 0;
      if (detailedMode) {
        const { count } = await supabase
          .from('task_reminders')
          .select('*', { count: 'exact', head: true })
          .in('farm_id', farmIds)
          .eq('completed', false);
        pendingTasksCount = count ?? 0;
      }
      return {
        farmsCount: farmsCount ?? 0,
        workersCount,
        activitiesCount: countQueries.reduce((sum, result) => sum + (result.count ?? 0), 0),
        pendingTasksCount,
      };
    },
    listFarmsNeedingAttention: async (userId) => {
      const { data } = await supabase.from('farms').select('*').eq('user_id', userId);
      return data ?? [];
    },
    getRecentActivities: async ({ userId, limit }): Promise<DashboardActivityRows> => {
      const { data: farms } = await supabase.from('farms').select('id, name').eq('user_id', userId);
      if (!farms?.length)
        return {
          farms: [],
          irrigation: [],
          spray: [],
          harvest: [],
          expense: [],
          fertigation: [],
          dailyNotes: [],
        };
      const farmIds = farms.map((farm) => farm.id);
      const tables = [
        ['irrigation_records', 'id, farm_id, date, duration'],
        ['spray_records', 'id, farm_id, date, chemical'],
        ['harvest_records', 'id, farm_id, date, quantity, grade'],
        ['expense_records', 'id, farm_id, date, type, cost'],
        ['fertigation_records', 'id, farm_id, date'],
        ['daily_notes', 'id, farm_id, date, notes'],
      ] as const;
      const results = await Promise.all(
        tables.map(([table, columns]) =>
          supabase
            .from(table)
            .select(columns)
            .in('farm_id', farmIds)
            .order('date', { ascending: false })
            .limit(limit),
        ),
      );
      return {
        farms,
        irrigation: results[0]?.data ?? [],
        spray: results[1]?.data ?? [],
        harvest: results[2]?.data ?? [],
        expense: results[3]?.data ?? [],
        fertigation: results[4]?.data ?? [],
        dailyNotes: results[5]?.data ?? [],
      } as unknown as DashboardActivityRows;
    },
  };
  readonly reports: DataAccess['reports'] = {
    getChemicalClaims: async () => {
      const claimsResult = await supabase
        .from('chemical_label_claims')
        .select('id,product_id,phi_min_days,phi_max_days')
        .eq('is_active', true);
      if (claimsResult.error) throw claimsResult.error;
      const claims = claimsResult.data ?? [];
      if (!claims.length) return { claims: [], mrls: [] };
      const mrlResult = await supabase
        .from('chemical_label_claim_mrls')
        .select('claim_id,market,mrl_value,mrl_unit,no_mrl_required')
        .in(
          'claim_id',
          claims.map((claim) => claim.id),
        );
      if (mrlResult.error && mrlResult.error.code !== '42P01') throw mrlResult.error;
      return { claims, mrls: mrlResult.data ?? [] };
    },
    countUnassignedRecords: async (table, farmId) => {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('farm_id', farmId)
        .is('season_id', null);
      if (error) {
        if (error.code === '42P01') return 0;
        throw error;
      }
      return count ?? 0;
    },
  };
  readonly workers: DataAccess['workers'] = {
    getWorker: async (workerId) => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single();
      if (error) throw error;
      return data;
    },
    getAttendance: async ({ workerId, periodStart, periodEnd, farmId }) => {
      let query = supabase
        .from('worker_attendance')
        .select('*')
        .eq('worker_id', workerId)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .neq('work_status', 'absent')
        .order('date');
      if (farmId) query = query.contains('farm_ids', [farmId]);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    createSettlement: async (payload) => {
      const { data, error } = await supabase
        .from('worker_settlements')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    createTransaction: async (payload) => {
      const { error } = await supabase.from('worker_transactions').insert(payload);
      if (error) throw error;
    },
    getAdvanceBalance: async (workerId) => {
      const { data, error } = await supabase
        .from('workers')
        .select('advance_balance')
        .eq('id', workerId)
        .single();
      if (error) throw error;
      return data?.advance_balance ?? null;
    },
    updateAdvanceBalance: async (workerId, advanceBalance) => {
      const { error } = await supabase
        .from('workers')
        .update({ advance_balance: advanceBalance })
        .eq('id', workerId);
      if (error) throw error;
    },
    deleteSettlement: async (settlementId) => {
      const { error } = await supabase.from('worker_settlements').delete().eq('id', settlementId);
      if (error) throw error;
    },
  };
  readonly delegatedLogs: DataAccess['delegatedLogs'] = {
    getProfessionalWorkspace: async () => {
      const { data, error } = await supabase.rpc('get_professional_workspace');
      if (error) throw error;
      return data;
    },
    createDelegatedLog: async (payload) => {
      const { data, error } = await supabase.rpc('create_delegated_log', payload);
      if (error) throw error;
      return data;
    },
    getDelegatedFarmActivity: async (payload) => {
      const { data, error } = await supabase.rpc('get_delegated_farm_activity', payload);
      if (error) throw error;
      return data ?? [];
    },
    updateDelegatedLog: async (payload) => {
      const { data, error } = await supabase.rpc('update_delegated_log', payload);
      if (error) throw error;
      return data;
    },
    deleteDelegatedLog: async (payload) => {
      const { error } = await supabase.rpc('delete_delegated_log', payload);
      if (error) throw error;
    },
  };
}

export const supabaseDataAccess = new SupabaseDataAccess();
