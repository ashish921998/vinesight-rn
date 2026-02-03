/**
 * Vinesight Hooks - Barrel Export
 * All React Query hooks for data operations
 */

// Query Keys
export { queryKeys } from './query-keys';

// Farm Hooks
export {
  useFarms,
  useFarm,
  useCreateFarm,
  useUpdateFarm,
  useUpdateFarmWaterLevel,
  useDeleteFarm,
  usePrefetchFarm,
} from './use-farms';

// Record Hooks (Irrigation, Spray, Fertigation, Harvest, Expense)
export {
  // Irrigation
  useIrrigationRecords,
  useIrrigationRecordsByFarms,
  useCreateIrrigationRecord,
  useUpdateIrrigationRecord,
  useDeleteIrrigationRecord,
  // Spray
  useSprayRecords,
  useSprayRecordsByFarms,
  useCreateSprayRecord,
  useUpdateSprayRecord,
  useDeleteSprayRecord,
  // Fertigation
  useFertigationRecords,
  useFertigationRecordsByFarms,
  useCreateFertigationRecord,
  useUpdateFertigationRecord,
  useDeleteFertigationRecord,
  // Harvest
  useHarvestRecords,
  useHarvestRecordsByFarms,
  useCreateHarvestRecord,
  useUpdateHarvestRecord,
  useDeleteHarvestRecord,
  // Expense
  useExpenseRecords,
  useExpenseRecordsByFarms,
  useCreateExpenseRecord,
  useUpdateExpenseRecord,
  useDeleteExpenseRecord,
} from './use-records';

// Worker Hooks
export {
  // Workers
  useWorkers,
  useWorker,
  useCreateWorker,
  useUpdateWorker,
  useDeleteWorker,
  // Attendance
  useAllWorkerAttendance,
  useWorkerAttendance,
  useCreateWorkerAttendance,
  useUpdateWorkerAttendance,
  useDeleteWorkerAttendance,
  // Transactions
  useAllWorkerTransactions,
  useWorkerTransactions,
  useCreateWorkerTransaction,
  useDeleteWorkerTransaction,
  // Settlements
  useWorkerSettlements,
  useCreateWorkerSettlement,
  useUpdateWorkerSettlement,
  // Work Types
  useWorkTypes,
  useCreateWorkType,
  // Temporary Worker Entries
  useTemporaryWorkerEntries,
  useCreateTemporaryWorkerEntry,
  useDeleteTemporaryWorkerEntry,
} from './use-workers';

// Profile & Misc Hooks
export {
  // Profile
  useProfile,
  useUpdateProfile,
  // Warehouse
  useWarehouseItems,
  useCreateWarehouseItem,
  useUpdateWarehouseItem,
  useDeleteWarehouseItem,
  // Soil Tests
  useSoilTestRecords,
  useCreateSoilTestRecord,
  useUpdateSoilTestRecord,
  useDeleteSoilTestRecord,
  // Petiole Tests
  usePetioleTestRecords,
  useCreatePetioleTestRecord,
  useUpdatePetioleTestRecord,
  useDeletePetioleTestRecord,
  // Soil Profiles
  useSoilProfiles,
  useCreateSoilProfile,
  useUpdateSoilProfile,
  useDeleteSoilProfile,
  // Calculation History
  useCalculationHistory,
  useCreateCalculationHistory,
} from './use-profile';

// Dashboard Hooks
export {
  useDashboardStats,
  useFarmsNeedingAttention,
  useRecentActivities,
  type DashboardStats,
  type FarmNeedingAttention,
  type RecentActivity,
} from './use-dashboard-stats';

// Composite Farm Records Hook
export { useFarmRecords } from './use-farm-records';

// Weather Hooks
export {
  useWeather,
  useETc,
  useWeatherAlerts,
  useIrrigationSchedule,
  useWeatherData,
  weatherQueryKeys,
} from './use-weather';

// Task Hooks
export {
  useTasks,
  useAllTasks,
  useCreateTask,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  taskQueryKeys,
} from './use-tasks';

// Analytics Hooks
export { useAnalytics } from './use-analytics';

// Report Hooks
export { useReportData, useReportExport, getDefaultDateRange } from './use-reports';

// Lab Tests Hooks
export {
  useSoilTests,
  usePetioleTests,
  useCreateSoilTest,
  useCreatePetioleTest,
  useDeleteSoilTest,
  useDeletePetioleTest,
  labTestQueryKeys,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
  formatParameterKey,
  getParameterUnit,
} from './use-lab-tests';

// Soil Profile Utilities (Hooks already exported from useProfile)
export {
  soilProfileQueryKeys,
  SECTION_NAMES,
  SECTION_INFO,
  calculateAverageMoisture,
  getSectionValue,
  formatProfileDate,
  getMoistureStatus,
  type SectionName,
} from './use-soil-profiles';

// UI Hooks
export { useFabBottomInset } from './use-fab-bottom-inset';
export { useTabBarInset } from './use-tab-bar-inset';
export { useFabBottomPosition } from './use-fab-bottom-position';
