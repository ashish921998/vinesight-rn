import type { DataAccess, DelegatedLogPayload } from './DataAccess';
import type {
  Worker,
  WorkerAttendance,
  WorkerSettlement,
  WorkerTransaction,
} from '@/types/database';
import type { DelegatedActivityItem, ProfessionalWorkspace } from '@/services/delegated-logs';

/**
 * Small deterministic fake for unit tests and future offline work.
 *
 * Callers that need query-specific behavior can provide a DataAccess object
 * with only the relevant methods replaced. The default implementation fails
 * loudly instead of accidentally pretending a read or write succeeded.
 */
export class InMemoryDataAccess implements DataAccess {
  readonly isConfigured = () => false;
  readonly workersById = new Map<number, Worker>();
  readonly workerAttendance: WorkerAttendance[] = [];
  readonly workerSettlements: WorkerSettlement[] = [];
  readonly workerTransactions: WorkerTransaction[] = [];
  professionalWorkspace: ProfessionalWorkspace | null = null;
  delegatedActivity: DelegatedActivityItem[] = [];
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
  readonly farms: DataAccess['farms'] = {
    getNextDisplayOrder: async () => ({ supportsDisplayOrder: true, displayOrder: 0 }),
    getExistingSeason: async () => null,
    startSeason: async () => this.unsupported('farms.startSeason'),
    createSeason: async () => this.unsupported('farms.createSeason'),
    getById: async (farmId) => this.unsupported(`farms.getById(${farmId})`),
    listForUser: async () => [],
    create: async () => this.unsupported('farms.create'),
    reorder: async () => this.unsupported('farms.reorder'),
    update: async () => this.unsupported('farms.update'),
    updateWaterLevel: async () => this.unsupported('farms.updateWaterLevel'),
    remove: async () => this.unsupported('farms.remove'),
  };
  readonly records: DataAccess['records'] = {
    listIrrigationByFarm: async () => [],
    listIrrigationByFarms: async () => [],
    listSprayByFarm: async () => [],
    listSprayByFarms: async () => [],
    listFertigationByFarm: async () => [],
    listFertigationByFarms: async () => [],
    listHarvestByFarm: async () => [],
    listHarvestByFarms: async () => [],
    listExpenseByFarm: async () => [],
    listExpenseByFarms: async () => [],
    getDailyNote: async () => null,
    listDailyNotesByFarm: async () => [],
    listDailyNotesByFarms: async () => [],
    upsertDailyNote: async () => this.unsupported('records.upsertDailyNote'),
    deleteDailyNote: async () => this.unsupported('records.deleteDailyNote'),
    listRecentSprays: async () => [],
    listRecentFertigations: async () => [],
  };
  readonly dashboardStats: DataAccess['dashboardStats'] = {
    getTodayStats: async () => ({
      farms: [],
      overdueTasks: [],
      recentLogFarmIds: [],
      recentLogError: null,
      phiDeadlines: [],
    }),
    getDashboardCounts: async () => ({
      farmsCount: 0,
      workersCount: 0,
      activitiesCount: 0,
      pendingTasksCount: 0,
    }),
    listFarmsNeedingAttention: async () => [],
    getRecentActivities: async () => ({
      farms: [],
      irrigation: [],
      spray: [],
      harvest: [],
      expense: [],
      fertigation: [],
      dailyNotes: [],
    }),
  };
  readonly reports: DataAccess['reports'] = {
    getChemicalClaims: async () => ({ claims: [], mrls: [] }),
    countUnassignedRecords: async () => 0,
  };
  readonly workers: DataAccess['workers'] = {
    getWorker: async (workerId) => this.workersById.get(workerId) ?? null,
    getAttendance: async ({ workerId, periodStart, periodEnd, farmId }) =>
      this.workerAttendance.filter((record) => {
        const date = String(record.date);
        const farmIds = record.farm_ids ?? [];
        return (
          record.worker_id === workerId &&
          date >= periodStart &&
          date <= periodEnd &&
          record.work_status !== 'absent' &&
          (!farmId || farmIds.includes(farmId))
        );
      }),
    createSettlement: async (payload) => {
      const record: WorkerSettlement = { id: this.workerSettlements.length + 1, ...payload };
      this.workerSettlements.push(record);
      return record;
    },
    createTransaction: async (payload) => {
      this.workerTransactions.push({ id: this.workerTransactions.length + 1, ...payload });
    },
    getAdvanceBalance: async (workerId) => this.workersById.get(workerId)?.advance_balance ?? null,
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
      return payload.p_payload as DelegatedLogPayload;
    },
    getDelegatedFarmActivity: async () => this.delegatedActivity,
    updateDelegatedLog: async () => this.unsupported('delegatedLogs.updateDelegatedLog'),
    deleteDelegatedLog: async () => this.unsupported('delegatedLogs.deleteDelegatedLog'),
  };
}
