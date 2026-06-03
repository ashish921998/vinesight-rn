/**
 * Vinesight Hooks - Barrel Export
 * All React Query hooks for data operations
 */

// Query Keys
export { queryKeys } from './query-keys';

// Farm Hooks
export {
  ensureInitialFarmSeasonForFarmId,
  useFarms,
  useFarm,
  useCreateFarm,
  useUpdateFarm,
  useUpdateFarmWaterLevel,
  useReorderFarms,
  useDeleteFarm,
  usePrefetchFarm,
} from './use-farms';
export {
  useFarmSeasons,
  useCreateFarmSeason,
  useUpdateFarmSeason,
  useUpdateFarmSeasonTargetHarvestDate,
  useStartFarmSeason,
  useEndFarmSeason,
  useRecomputeFarmSeasonAssignments,
  useFarmSeasonStatus,
} from './use-farm-seasons';

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
  // Daily Notes
  useDailyNoteByDate,
  useDailyNotes,
  useDailyNotesByFarms,
  useUpsertDailyNote,
  useDeleteDailyNote,
  // Recent inputs
  useRecentSprayChemicals,
  useRecentFertigationItems,
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
  useTemporaryWorkerEntriesByFarms,
  useAllTemporaryWorkerEntries,
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

// Currency
export { useCurrency } from './use-currency';

// Dashboard Hooks
export {
  useDashboardStats,
  useTodayNeedsAttention,
  useFarmsNeedingAttention,
  useRecentActivities,
  type DashboardStats,
  type FarmNeedingAttention,
  type TodayNeedAttentionItem,
  type TodayNeedAttentionType,
  type TodayNeedAttentionSeverity,
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

// Fertilizer Plan
export { useFertilizerPlan } from './use-fertilizer-plan';
export {
  useChemicalCatalog,
  useChemicalMixSearch,
  useChemicalMixById,
} from './use-chemical-catalog';
export {
  useMasterProducts,
  useMasterProductSearch,
  useMasterProductById,
} from './use-master-catalog';
export {
  usePhiComputation,
  useEarliestSafeHarvestForSeason,
  useSafeToSprayMatrix,
} from './use-phi';

// Lab Tests Hooks
export {
  useSoilTests,
  usePetioleTests,
  useCreateSoilTest,
  useCreatePetioleTest,
  useDeleteSoilTest,
  useDeletePetioleTest,
  labTestQueryKeys,
  formatParameterKey,
  getParameterUnit,
} from './use-lab-tests';

// Re-export parameter constants for backward compatibility
export { SOIL_PARAMETERS, PETIOLE_PARAMETERS } from '../constants/lab-test-parameters';

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
export { usePlatform, isIOS, isAndroid, platform } from './use-platform';
export { useAndroidKeyboardLift } from './use-android-keyboard-lift';
export { useResponsiveHeight } from './use-responsive-height';
