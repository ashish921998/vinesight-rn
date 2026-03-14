/**
 * Farm Data Module (Orchestrator)
 * Re-exports all farm data types and functions from focused sub-modules.
 * Provides the queryFarmRecords() switch that dispatches to the right sub-module.
 *
 * Sub-modules:
 *  - farm-details.ts       — types, Supabase client, activity detection, date parsing, farm lookup
 *  - farm-records.ts          — irrigation, spray, fertigation queries
 *  - farm-financial-records.ts — expense and harvest queries
 *  - farm-extra-records.ts — warehouse, tasks, soil/petiole tests, daily notes
 *  - farm-workers.ts       — worker + attendance queries (always tenant-scoped)
 *  - farm-weather.ts       — Open-Meteo weather fetching and context block builder
 */

// ============================================================
// MARK: - Type Re-exports
// ============================================================

export type {
  Citation,
  FarmDataQueryResult,
  FarmRecordRow,
  ToolCall,
  WeatherData,
} from './farm-details.ts';

// ============================================================
// MARK: - Farm Details / Detection Re-exports
// ============================================================

export {
  detectActivity,
  detectQueryType,
  fetchFarmDetails,
  fetchUserFarms,
  isLikelyHistoryIntent,
  parseExplicitDate,
} from './farm-details.ts';

// ============================================================
// MARK: - Activity Record Re-exports
// ============================================================

export {
  queryFertigationRecords,
  queryIrrigationRecords,
  querySprayRecords,
} from './farm-records.ts';

export { queryExpenseRecords, queryHarvestRecords } from './farm-financial-records.ts';

// ============================================================
// MARK: - Extra Record Re-exports
// ============================================================

export {
  queryDailyNotes,
  queryPetioleTestRecords,
  querySoilTestRecords,
  queryTaskReminders,
  queryWarehouseItems,
} from './farm-extra-records.ts';

// ============================================================
// MARK: - Workers Re-export
// ============================================================

export { queryWorkers } from './farm-workers.ts';

// ============================================================
// MARK: - Weather Re-exports
// ============================================================

export { buildWeatherContextBlock, fetchWeatherData } from './farm-weather.ts';

// ============================================================
// MARK: - Imports for queryFarmRecords
// ============================================================

import {
  detectActivity,
  detectQueryType,
  parseExplicitDate,
  type Citation,
  type FarmDataQueryResult,
  type ToolCall,
} from './farm-details.ts';
import {
  queryFertigationRecords,
  queryIrrigationRecords,
  querySprayRecords,
} from './farm-records.ts';
import { queryExpenseRecords, queryHarvestRecords } from './farm-financial-records.ts';
import {
  queryDailyNotes,
  queryPetioleTestRecords,
  querySoilTestRecords,
  queryTaskReminders,
  queryWarehouseItems,
} from './farm-extra-records.ts';
import { queryWorkers } from './farm-workers.ts';

// ============================================================
// MARK: - Main Dispatcher
// ============================================================

/**
 * Query any farm data type based on the transcript's detected query type.
 * Dispatches to the appropriate sub-module based on keyword detection.
 */
export async function queryFarmRecords(input: {
  transcript: string;
  userId: string | null;
  farmId: number | null;
  activity: ReturnType<typeof detectActivity>;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ answer: string | null; citations: Citation[] }> {
  const queryType = detectQueryType(input.transcript);
  const explicitDate = parseExplicitDate(input.transcript);
  const isTotalQuery = /\btotal|how much|how many|कितना|कितने|किती|एकूण|कुल/i.test(
    input.transcript,
  );

  let result: FarmDataQueryResult;

  switch (queryType) {
    case 'irrigation':
      result = await queryIrrigationRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'spray':
      result = await querySprayRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'fertigation':
      result = await queryFertigationRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'expense':
      result = await queryExpenseRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'harvest':
      result = await queryHarvestRecords({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        isTotalQuery,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'warehouse':
      result = await queryWarehouseItems({
        userId: input.userId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'workers':
      result = await queryWorkers({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'tasks':
      result = await queryTaskReminders({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'soil_test':
      result = await querySoilTestRecords({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'petiole_test':
      result = await queryPetioleTestRecords({
        userId: input.userId,
        farmId: input.farmId,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'daily_notes':
      result = await queryDailyNotes({
        userId: input.userId,
        farmId: input.farmId,
        explicitDate,
        locale: input.locale,
        toolCalls: input.toolCalls,
      });
      break;
    case 'weather':
      return { answer: null, citations: [] };
    default:
      input.toolCalls.push({
        tool: 'log_activity.query',
        status: 'skipped',
        output: { reason: 'unknown_query_type' },
      });
      return { answer: null, citations: [] };
  }

  return { answer: result.answer, citations: result.citations };
}
