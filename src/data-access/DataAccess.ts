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
    query: SupabaseClient['from'];
    call: SupabaseClient['rpc'];
  };
  records: {
    query: SupabaseClient['from'];
  };
  dashboardStats: {
    query: SupabaseClient['from'];
    call: SupabaseClient['rpc'];
  };
  reports: {
    query: SupabaseClient['from'];
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
