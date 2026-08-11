import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChemicalLabelClaim,
  ChemicalLabelClaimMrl,
  DailyNoteRecord,
  ExpenseRecord,
  Farm,
  FarmInsert,
  FarmSeason,
  FarmSeasonInsert,
  FarmUpdate,
  FertigationRecord,
  HarvestRecord,
  IrrigationRecord,
  SprayRecord,
  Worker,
  WorkerAttendance,
  WorkerSettlement,
  WorkerSettlementInsert,
  WorkerTransaction,
} from '@/types/database';
import type { TaskReminder } from '@/types/task';
import type { LogTypeId } from '@/constants/calculator-models';
import type { AreaUnitPreference } from '@/utils/preferences';

export type FarmSeasonStartPayload = {
  p_farm_id: number;
  p_start_date: string;
  p_template_key: string | null;
  p_config_json: FarmSeason['config_json'];
  p_season_name: string | null;
};
export type FarmSummary = Pick<Farm, 'id' | 'name' | 'remaining_water' | 'total_tank_capacity'>;
export type RecentSprayRow = Pick<
  SprayRecord,
  'chemical' | 'date' | 'chemical_items' | 'catalog_mix_id'
>;
export type RecentFertigationRow = Pick<FertigationRecord, 'fertilizers' | 'date'>;
export type DashboardTodayStats = {
  farms: FarmSummary[];
  overdueTasks: Pick<TaskReminder, 'id' | 'farm_id' | 'title' | 'due_date'>[];
  recentLogFarmIds: Array<{ farm_id: number }>;
  recentLogError: { message: string } | null;
  phiDeadlines: Pick<SprayRecord, 'id' | 'farm_id' | 'safe_harvest_date' | 'chemical'>[];
};
export type DashboardCounts = {
  farmsCount: number;
  workersCount: number;
  activitiesCount: number;
  pendingTasksCount: number;
};
export type DashboardActivityRows = {
  farms: Array<Pick<Farm, 'id' | 'name'>>;
  irrigation: Array<
    Pick<IrrigationRecord, 'id' | 'farm_id' | 'date' | 'duration' | 'moisture_status'>
  >;
  spray: Array<Pick<SprayRecord, 'id' | 'farm_id' | 'date' | 'chemical' | 'weather'>>;
  harvest: Array<
    Pick<HarvestRecord, 'id' | 'farm_id' | 'date' | 'quantity' | 'grade' | 'buyer' | 'notes'>
  >;
  expense: Array<Pick<ExpenseRecord, 'id' | 'farm_id' | 'date' | 'type' | 'cost' | 'remarks'>>;
  fertigation: Array<Pick<FertigationRecord, 'id' | 'farm_id' | 'date' | 'fertilizers' | 'area'>>;
  dailyNotes: Array<Pick<DailyNoteRecord, 'id' | 'farm_id' | 'date' | 'notes'>>;
};
export type ChemicalClaims = {
  claims: Array<Pick<ChemicalLabelClaim, 'id' | 'product_id' | 'phi_min_days' | 'phi_max_days'>>;
  mrls: Array<
    Pick<
      ChemicalLabelClaimMrl,
      'claim_id' | 'market' | 'mrl_value' | 'mrl_unit' | 'no_mrl_required'
    >
  >;
};
export type DelegatedLogPayload = Partial<
  IrrigationRecord &
    SprayRecord &
    FertigationRecord &
    HarvestRecord &
    ExpenseRecord &
    DailyNoteRecord
>;
export type DelegatedLogRpcInput = {
  p_organization_id: string;
  p_client_user_id: string;
  p_farm_id: number;
  p_record_type: string;
  p_date: string;
  p_payload: DelegatedLogPayload;
};
export type DelegatedLogMutation = {
  p_record_type: string;
  p_record_id: number;
  p_payload?: Partial<DelegatedLogPayload>;
};
export type ProfessionalRole = 'owner' | 'admin' | 'agronomist';
export type DelegatedLogType = Exclude<LogTypeId, 'expense'>;
export interface ProfessionalFarm {
  id: number;
  name: string;
  region: string;
  area: number;
  crop: string;
  crop_variety: string;
}
export interface ProfessionalClient {
  user_id: string;
  full_name: string;
  phone: string | null;
  area_unit_preference?: AreaUnitPreference | null;
  farms: ProfessionalFarm[];
}
export interface ProfessionalWorkspace {
  organization_id: string;
  organization_name: string;
  role: ProfessionalRole;
  clients: ProfessionalClient[];
}
export type DelegatedActivityRecord =
  IrrigationRecord | SprayRecord | FertigationRecord | HarvestRecord | DailyNoteRecord;
export interface DelegatedActivityItem {
  record_type: DelegatedLogType;
  record_data: DelegatedActivityRecord;
}

/**
 * Application persistence port.
 *
 * The first migration keeps the Supabase query-builder types at this boundary
 * so existing domain queries can move without changing their result handling.
 * Domain-specific operations can be added here as each query is consolidated.
 */
export interface DataAccess {
  isConfigured: () => boolean;
  /** Transitional escape hatch — migrate to domain methods; see docs/adr/0002. */
  from: SupabaseClient['from'];
  /** Transitional escape hatch — migrate to domain methods; see docs/adr/0002. */
  rpc: SupabaseClient['rpc'];
  /** Transitional escape hatch — migrate to domain methods; see docs/adr/0002. */
  auth: SupabaseClient['auth'];
  /** Transitional escape hatch — migrate to domain methods; see docs/adr/0002. */
  functions: SupabaseClient['functions'];
  /** Transitional escape hatch — migrate to domain methods; see docs/adr/0002. */
  storage: SupabaseClient['storage'];
  farms: {
    getNextDisplayOrder: (
      userId: string,
    ) => Promise<{ supportsDisplayOrder: boolean; displayOrder: number }>;
    getExistingSeason: (farmId: number) => Promise<Pick<FarmSeason, 'id'> | null>;
    startSeason: (payload: FarmSeasonStartPayload) => Promise<void>;
    createSeason: (payload: FarmSeasonInsert & { user_id: string }) => Promise<void>;
    getById: (farmId: number, userId: string) => Promise<Farm>;
    listForUser: (userId: string) => Promise<Farm[]>;
    create: (payload: FarmInsert) => Promise<Farm>;
    reorder: (farmIds: number[]) => Promise<void>;
    update: (farmId: number, userId: string, updates: FarmUpdate) => Promise<Farm>;
    updateWaterLevel: (
      farmId: number,
      updates: Pick<FarmUpdate, 'remaining_water' | 'water_calculation_updated_at'>,
    ) => Promise<Farm>;
    remove: (farmId: number, userId: string) => Promise<void>;
  };
  records: {
    listIrrigationByFarm: (farmId: number, seasonId?: number) => Promise<IrrigationRecord[]>;
    listIrrigationByFarms: (farmIds: number[]) => Promise<IrrigationRecord[]>;
    listSprayByFarm: (farmId: number, seasonId?: number) => Promise<SprayRecord[]>;
    listSprayByFarms: (farmIds: number[]) => Promise<SprayRecord[]>;
    listFertigationByFarm: (farmId: number, seasonId?: number) => Promise<FertigationRecord[]>;
    listFertigationByFarms: (farmIds: number[]) => Promise<FertigationRecord[]>;
    listHarvestByFarm: (farmId: number, seasonId?: number) => Promise<HarvestRecord[]>;
    listHarvestByFarms: (farmIds: number[]) => Promise<HarvestRecord[]>;
    listExpenseByFarm: (farmId: number, seasonId?: number) => Promise<ExpenseRecord[]>;
    listExpenseByFarms: (farmIds: number[]) => Promise<ExpenseRecord[]>;
    getDailyNote: (farmId: number, date: string) => Promise<DailyNoteRecord | null>;
    listDailyNotesByFarm: (farmId: number, seasonId?: number) => Promise<DailyNoteRecord[]>;
    listDailyNotesByFarms: (farmIds: number[]) => Promise<DailyNoteRecord[]>;
    upsertDailyNote: (
      payload: Omit<DailyNoteRecord, 'id' | 'created_at'>,
    ) => Promise<DailyNoteRecord>;
    deleteDailyNote: (input: { id: number; farmId: number; date: string }) => Promise<void>;
    listRecentSprays: (farmId?: number) => Promise<RecentSprayRow[]>;
    listRecentFertigations: (farmId?: number) => Promise<RecentFertigationRow[]>;
  };
  dashboardStats: {
    getTodayStats: (input: { userId: string; limit: number }) => Promise<DashboardTodayStats>;
    getDashboardCounts: (input: {
      userId: string;
      detailedMode: boolean;
      since: string;
    }) => Promise<DashboardCounts>;
    listFarmsNeedingAttention: (userId: string) => Promise<Farm[]>;
    getRecentActivities: (input: {
      userId: string;
      limit: number;
    }) => Promise<DashboardActivityRows>;
  };
  reports: {
    getChemicalClaims: () => Promise<ChemicalClaims>;
    countUnassignedRecords: (table: string, farmId: number) => Promise<number>;
  };
  workers: {
    getWorker: (workerId: number) => Promise<Worker | null>;
    getAttendance: (input: {
      workerId: number;
      periodStart: string;
      periodEnd: string;
      farmId: number | null;
    }) => Promise<WorkerAttendance[]>;
    createSettlement: (payload: WorkerSettlementInsert) => Promise<WorkerSettlement>;
    createTransaction: (payload: Omit<WorkerTransaction, 'id' | 'created_at'>) => Promise<void>;
    getAdvanceBalance: (workerId: number) => Promise<number | null>;
    updateAdvanceBalance: (workerId: number, advanceBalance: number) => Promise<void>;
    deleteSettlement: (settlementId: number) => Promise<void>;
  };
  delegatedLogs: {
    getProfessionalWorkspace: () => Promise<ProfessionalWorkspace | null>;
    createDelegatedLog: (payload: DelegatedLogRpcInput) => Promise<DelegatedLogPayload>;
    getDelegatedFarmActivity: (payload: {
      p_organization_id: string;
      p_client_user_id: string;
      p_farm_id: number;
    }) => Promise<DelegatedActivityItem[]>;
    updateDelegatedLog: (payload: DelegatedLogMutation) => Promise<DelegatedLogPayload>;
    deleteDelegatedLog: (
      payload: Pick<DelegatedLogMutation, 'p_record_type' | 'p_record_id'>,
    ) => Promise<void>;
  };
}
