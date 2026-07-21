import type { SupabaseClient } from '@supabase/supabase-js';

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
    getNextDisplayOrder: (userId: string) => Promise<unknown>;
    getExistingSeason: (farmId: number) => Promise<unknown>;
    startSeason: (payload: Record<string, unknown>) => Promise<void>;
    createSeason: (payload: Record<string, unknown>) => Promise<void>;
    getById: (farmId: number, userId: string) => Promise<unknown>;
    listForUser: (userId: string) => Promise<unknown>;
    create: (payload: Record<string, unknown>) => Promise<unknown>;
    reorder: (farmIds: number[]) => Promise<void>;
    update: (farmId: number, userId: string, updates: Record<string, unknown>) => Promise<unknown>;
    updateWaterLevel: (farmId: number, updates: Record<string, unknown>) => Promise<unknown>;
    remove: (farmId: number, userId: string) => Promise<void>;
  };
  records: {
    listIrrigationByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listIrrigationByFarms: (farmIds: number[]) => Promise<unknown>;
    listSprayByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listSprayByFarms: (farmIds: number[]) => Promise<unknown>;
    listFertigationByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listFertigationByFarms: (farmIds: number[]) => Promise<unknown>;
    listHarvestByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listHarvestByFarms: (farmIds: number[]) => Promise<unknown>;
    listExpenseByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listExpenseByFarms: (farmIds: number[]) => Promise<unknown>;
    getDailyNote: (farmId: number, date: string) => Promise<unknown>;
    listDailyNotesByFarm: (farmId: number, seasonId?: number) => Promise<unknown>;
    listDailyNotesByFarms: (farmIds: number[]) => Promise<unknown>;
    upsertDailyNote: (payload: Record<string, unknown>) => Promise<unknown>;
    deleteDailyNote: (input: { id: number; farmId: number; date: string }) => Promise<void>;
    listRecentSprays: (farmId?: number) => Promise<unknown>;
    listRecentFertigations: (farmId?: number) => Promise<unknown>;
  };
  dashboardStats: {
    getTodayStats: (input: { userId: string; limit: number }) => Promise<unknown>;
    getDashboardCounts: (input: {
      userId: string;
      detailedMode: boolean;
      since: string;
    }) => Promise<unknown>;
    listFarmsNeedingAttention: (userId: string) => Promise<unknown>;
    getRecentActivities: (input: { userId: string; limit: number }) => Promise<unknown>;
  };
  reports: {
    getChemicalClaims: () => Promise<unknown>;
    countUnassignedRecords: (table: string, farmId: number) => Promise<number>;
  };
  workers: {
    getWorker: (workerId: number) => Promise<unknown>;
    getAttendance: (input: {
      workerId: number;
      periodStart: string;
      periodEnd: string;
      farmId: number | null;
    }) => Promise<unknown[]>;
    createSettlement: (payload: Record<string, unknown>) => Promise<unknown>;
    createTransaction: (payload: Record<string, unknown>) => Promise<void>;
    getAdvanceBalance: (workerId: number) => Promise<number | null>;
    updateAdvanceBalance: (workerId: number, advanceBalance: number) => Promise<void>;
    deleteSettlement: (settlementId: number) => Promise<void>;
  };
  delegatedLogs: {
    getProfessionalWorkspace: () => Promise<unknown>;
    createDelegatedLog: (payload: Record<string, unknown>) => Promise<unknown>;
    getDelegatedFarmActivity: (payload: Record<string, unknown>) => Promise<unknown[]>;
    updateDelegatedLog: (payload: Record<string, unknown>) => Promise<unknown>;
    deleteDelegatedLog: (payload: Record<string, unknown>) => Promise<void>;
  };
}
