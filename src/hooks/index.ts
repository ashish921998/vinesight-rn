/**
 * Vinesight Hooks - Barrel Export
 * All React Query hooks for data operations
 */

// Query Keys
export { queryKeys } from './queryKeys';

// Farm Hooks
export {
  useFarms,
  useFarm,
  useCreateFarm,
  useUpdateFarm,
  useUpdateFarmWaterLevel,
  useDeleteFarm,
  usePrefetchFarm,
} from './useFarms';

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
} from './useRecords';

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
} from './useWorkers';

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
} from './useProfile';

// Dashboard Hooks
export {
  useDashboardStats,
  useFarmsNeedingAttention,
  useRecentActivities,
  type DashboardStats,
  type FarmNeedingAttention,
  type RecentActivity,
} from './useDashboardStats';

// Composite Farm Records Hook
export { useFarmRecords } from './useFarmRecords';

// Weather Hooks
export {
  useWeather,
  useETc,
  useWeatherAlerts,
  useIrrigationSchedule,
  useWeatherData,
  weatherQueryKeys,
} from './useWeather';

// Task Hooks
export {
  useTasks,
  useAllTasks,
  useCreateTask,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  taskQueryKeys,
} from './useTasks';

// Analytics Hooks
export { useAnalytics } from './useAnalytics';

// Report Hooks
export { useReportData, useReportExport, getDefaultDateRange } from './useReports';

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
} from './useLabTests';

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
} from './useSoilProfiles';
