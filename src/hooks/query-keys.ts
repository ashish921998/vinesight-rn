/**
 * React Query Keys
 * Centralized query key factory for consistent cache management
 */

export const queryKeys = {
  professionalWorkspace: {
    all: ['professionalWorkspace'] as const,
    current: () => ['professionalWorkspace', 'current'] as const,
    farmActivity: (farmId: number) => ['professionalWorkspace', 'farmActivity', farmId] as const,
  },
  // Farms
  farms: {
    all: ['farms'] as const,
    lists: () => [...queryKeys.farms.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.farms.lists(), filters] as const,
    details: () => [...queryKeys.farms.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.farms.details(), id] as const,
  },

  // Farm Seasons
  farmSeasons: {
    all: ['farmSeasons'] as const,
    lists: () => [...queryKeys.farmSeasons.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.farmSeasons.lists(), { farmId }] as const,
    detail: (id: number) => [...queryKeys.farmSeasons.all, 'detail', id] as const,
  },

  // Irrigation Records
  irrigationRecords: {
    all: ['irrigationRecords'] as const,
    lists: () => [...queryKeys.irrigationRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.irrigationRecords.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) =>
      [...queryKeys.irrigationRecords.lists(), { farmIds }] as const,
    detail: (id: number) => [...queryKeys.irrigationRecords.all, 'detail', id] as const,
  },

  // Spray Records
  sprayRecords: {
    all: ['sprayRecords'] as const,
    lists: () => [...queryKeys.sprayRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.sprayRecords.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) => [...queryKeys.sprayRecords.lists(), { farmIds }] as const,
    detail: (id: number) => [...queryKeys.sprayRecords.all, 'detail', id] as const,
  },

  // Fertigation Records
  fertigationRecords: {
    all: ['fertigationRecords'] as const,
    lists: () => [...queryKeys.fertigationRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.fertigationRecords.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) =>
      [...queryKeys.fertigationRecords.lists(), { farmIds }] as const,
    detail: (id: number) => [...queryKeys.fertigationRecords.all, 'detail', id] as const,
  },

  // Harvest Records
  harvestRecords: {
    all: ['harvestRecords'] as const,
    lists: () => [...queryKeys.harvestRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.harvestRecords.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) => [...queryKeys.harvestRecords.lists(), { farmIds }] as const,
    detail: (id: number) => [...queryKeys.harvestRecords.all, 'detail', id] as const,
  },

  // Expense Records
  expenseRecords: {
    all: ['expenseRecords'] as const,
    lists: () => [...queryKeys.expenseRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.expenseRecords.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) => [...queryKeys.expenseRecords.lists(), { farmIds }] as const,
    detail: (id: number) => [...queryKeys.expenseRecords.all, 'detail', id] as const,
  },

  // Daily Notes
  dailyNotes: {
    all: ['dailyNotes'] as const,
    lists: () => [...queryKeys.dailyNotes.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.dailyNotes.lists(), { farmId }] as const,
    byDate: (farmId: number, date: string) =>
      [...queryKeys.dailyNotes.all, 'byDate', { farmId, date }] as const,
  },

  // Soil Test Records
  soilTestRecords: {
    all: ['soilTestRecords'] as const,
    lists: () => [...queryKeys.soilTestRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.soilTestRecords.lists(), { farmId }] as const,
    detail: (id: number) => [...queryKeys.soilTestRecords.all, 'detail', id] as const,
  },

  // Petiole Test Records
  petioleTestRecords: {
    all: ['petioleTestRecords'] as const,
    lists: () => [...queryKeys.petioleTestRecords.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.petioleTestRecords.lists(), { farmId }] as const,
    detail: (id: number) => [...queryKeys.petioleTestRecords.all, 'detail', id] as const,
  },

  // Soil Profiles
  soilProfiles: {
    all: ['soilProfiles'] as const,
    lists: () => [...queryKeys.soilProfiles.all, 'list'] as const,
    listByFarm: (farmId: number) => [...queryKeys.soilProfiles.lists(), { farmId }] as const,
    detail: (id: number) => [...queryKeys.soilProfiles.all, 'detail', id] as const,
  },

  // Calculation History
  calculationHistory: {
    all: ['calculationHistory'] as const,
    lists: () => [...queryKeys.calculationHistory.all, 'list'] as const,
    listByFarm: (farmId: number, type?: string) =>
      [...queryKeys.calculationHistory.lists(), { farmId, type }] as const,
  },

  // Profile
  profile: {
    all: ['profile'] as const,
    current: () => [...queryKeys.profile.all, 'current'] as const,
  },

  // Fertilizer Plan
  fertilizerPlan: {
    all: ['fertilizerPlan'] as const,
    detail: (farmId: number) => [...queryKeys.fertilizerPlan.all, { farmId }] as const,
  },

  // Consultant Reviews
  consultantReviews: {
    all: ['consultantReviews'] as const,
    triage: (organizationId: string, farmId: number) =>
      [...queryKeys.consultantReviews.all, 'triage', { organizationId, farmId }] as const,
  },

  // Warehouse Items
  warehouseItems: {
    all: ['warehouseItems'] as const,
    lists: () => [...queryKeys.warehouseItems.all, 'list'] as const,
    listByType: (type?: string) => [...queryKeys.warehouseItems.lists(), { type }] as const,
    detail: (id: number) => [...queryKeys.warehouseItems.all, 'detail', id] as const,
  },

  // Workers
  workers: {
    all: ['workers'] as const,
    lists: () => [...queryKeys.workers.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.workers.all, 'detail', id] as const,
  },

  // Worker Attendance
  workerAttendance: {
    all: ['workerAttendance'] as const,
    lists: () => [...queryKeys.workerAttendance.all, 'list'] as const,
    listAll: () => [...queryKeys.workerAttendance.lists(), 'all'] as const,
    listByWorker: (workerId: number) =>
      [...queryKeys.workerAttendance.lists(), { workerId }] as const,
  },

  // Worker Transactions
  workerTransactions: {
    all: ['workerTransactions'] as const,
    lists: () => [...queryKeys.workerTransactions.all, 'list'] as const,
    listAll: () => [...queryKeys.workerTransactions.lists(), 'all'] as const,
    listByWorker: (workerId: number) =>
      [...queryKeys.workerTransactions.lists(), { workerId }] as const,
  },

  // Worker Settlements
  workerSettlements: {
    all: ['workerSettlements'] as const,
    lists: () => [...queryKeys.workerSettlements.all, 'list'] as const,
    listByWorker: (workerId: number) =>
      [...queryKeys.workerSettlements.lists(), { workerId }] as const,
  },

  // Work Types
  workTypes: {
    all: ['workTypes'] as const,
    lists: () => [...queryKeys.workTypes.all, 'list'] as const,
  },

  // Temporary Worker Entries
  temporaryWorkerEntries: {
    all: ['temporaryWorkerEntries'] as const,
    lists: () => [...queryKeys.temporaryWorkerEntries.all, 'list'] as const,
    listAll: () => [...queryKeys.temporaryWorkerEntries.lists(), 'all'] as const,
    listByFarm: (farmId: number) =>
      [...queryKeys.temporaryWorkerEntries.lists(), { farmId }] as const,
    listByFarms: (farmIds: number[]) =>
      [...queryKeys.temporaryWorkerEntries.lists(), { farmIds }] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    todayNeedsAttention: () => [...queryKeys.dashboard.all, 'todayNeedsAttention'] as const,
    farmsNeedingAttention: () => [...queryKeys.dashboard.all, 'farmsNeedingAttention'] as const,
    recentActivities: (limit?: number) =>
      [...queryKeys.dashboard.all, 'recentActivities', limit] as const,
  },

  // Chemical catalog
  chemicalCatalog: {
    all: ['chemicalCatalog'] as const,
    mixes: () => [...queryKeys.chemicalCatalog.all, 'mixes'] as const,
    search: (query: string) => [...queryKeys.chemicalCatalog.all, 'search', query] as const,
    mixDetail: (mixId: number) => [...queryKeys.chemicalCatalog.all, 'mix', mixId] as const,
  },

  // Master catalog
  masterCatalog: {
    all: ['masterCatalog'] as const,
    products: () => [...queryKeys.masterCatalog.all, 'products'] as const,
    productsByType: (inputTypes: string[], stateCode: string | null) =>
      [
        ...queryKeys.masterCatalog.products(),
        { inputTypes: [...inputTypes].sort(), stateCode: stateCode ?? null },
      ] as const,
    productDetail: (productId: number) =>
      [...queryKeys.masterCatalog.all, 'product', productId] as const,
  },

  // PHI
  phi: {
    all: ['phi'] as const,
    computation: (mixId: number, sprayDate: string) =>
      [...queryKeys.phi.all, 'computation', mixId, sprayDate] as const,
    earliestSafeHarvest: (farmId: number, seasonId: number | null) =>
      [...queryKeys.phi.all, 'earliestSafeHarvest', { farmId, seasonId }] as const,
    safeToSprayMatrix: (farmId: number, seasonId: number | null, targetHarvestDate: string) =>
      [...queryKeys.phi.all, 'safeToSprayMatrix', { farmId, seasonId, targetHarvestDate }] as const,
  },
} as const;
