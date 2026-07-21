import type { DataAccess } from './DataAccess';

/**
 * Small deterministic fake for unit tests and future offline work.
 *
 * Callers that need query-specific behavior can provide a DataAccess object
 * with only the relevant methods replaced. The default implementation fails
 * loudly instead of accidentally pretending a read or write succeeded.
 */
export class InMemoryDataAccess implements DataAccess {
  readonly isConfigured = () => false;
  readonly workersById = new Map<number, Record<string, unknown>>();
  readonly workerAttendance: Array<Record<string, unknown>> = [];
  readonly workerSettlements: Array<Record<string, unknown>> = [];
  readonly workerTransactions: Array<Record<string, unknown>> = [];
  professionalWorkspace: unknown = null;
  delegatedActivity: unknown[] = [];
  private readonly unsupported = (operation: string): never => {
    throw new Error(`InMemoryDataAccess does not implement ${operation}`);
  };

  readonly from: DataAccess['from'] = () => this.unsupported('from');
  readonly rpc: DataAccess['rpc'] = () => this.unsupported('rpc');
  readonly auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
  } as unknown as DataAccess['auth'];
  readonly functions = {
    invoke: async () => this.unsupported('functions.invoke'),
  } as unknown as DataAccess['functions'];
  readonly storage = {} as DataAccess['storage'];
  readonly farms = { query: this.from, call: this.rpc };
  readonly records = { query: this.from };
  readonly dashboardStats = { query: this.from, call: this.rpc };
  readonly reports = { query: this.from };
  readonly workers: DataAccess['workers'] = {
    getWorker: async (workerId) => this.workersById.get(workerId) ?? null,
    getAttendance: async ({ workerId, periodStart, periodEnd, farmId }) =>
      this.workerAttendance.filter((record) => {
        const date = String(record.date);
        const farmIds = (record.farm_ids as number[] | undefined) ?? [];
        return (
          record.worker_id === workerId &&
          date >= periodStart &&
          date <= periodEnd &&
          record.work_status !== 'absent' &&
          (!farmId || farmIds.includes(farmId))
        );
      }),
    createSettlement: async (payload) => {
      const record = { id: this.workerSettlements.length + 1, ...payload };
      this.workerSettlements.push(record);
      return record;
    },
    createTransaction: async (payload) => {
      this.workerTransactions.push({ id: this.workerTransactions.length + 1, ...payload });
    },
    getAdvanceBalance: async (workerId) =>
      (this.workersById.get(workerId)?.advance_balance as number | null | undefined) ?? null,
    updateAdvanceBalance: async (workerId, advanceBalance) => {
      const worker = this.workersById.get(workerId);
      if (worker) worker.advance_balance = advanceBalance;
    },
    deleteSettlement: async (settlementId) => {
      const index = this.workerSettlements.findIndex((record) => record.id === settlementId);
      if (index >= 0) this.workerSettlements.splice(index, 1);
    },
  };
  readonly delegatedLogs: DataAccess['delegatedLogs'] = {
    getProfessionalWorkspace: async () => this.professionalWorkspace,
    createDelegatedLog: async (payload) => {
      const record = { id: this.delegatedActivity.length + 1, ...payload };
      this.delegatedActivity.push(record);
      return record;
    },
    getDelegatedFarmActivity: async () => this.delegatedActivity,
    updateDelegatedLog: async (payload) => payload,
    deleteDelegatedLog: async () => undefined,
  };
}
