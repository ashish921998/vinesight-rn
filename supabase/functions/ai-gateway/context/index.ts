/**
 * Context Module Index
 * Re-exports all context functions for clean imports.
 */

// Memory
export {
  parseActivityExtractionResult,
  searchMemoryContext,
  writeMemory,
  type Citation,
  type MemorySearchRow,
  type ToolCall,
} from './memory.ts';

// Farm Data - all data type queries
export {
  buildWeatherContextBlock,
  detectActivity,
  detectQueryType,
  fetchFarmDetails,
  fetchUserFarms,
  fetchWeatherData,
  isLikelyHistoryIntent,
  parseExplicitDate,
  queryDailyNotes,
  queryExpenseRecords,
  queryFarmRecords,
  queryFertigationRecords,
  queryHarvestRecords,
  queryIrrigationRecords,
  queryPetioleTestRecords,
  querySoilTestRecords,
  querySprayRecords,
  queryTaskReminders,
  queryWarehouseItems,
  queryWorkers,
  type FarmDataQueryResult,
  type FarmRecordRow,
  type WeatherData,
} from './farm-data.ts';

// RAG
export { searchRagContext, type AgronomySearchRow } from './rag.ts';

// Assembler
export {
  assembleContext,
  buildAttachmentContextBlocks,
  buildFarmContextBlock,
  buildFarmRecordsContextBlock,
  getContextSummary,
  hasContextContent,
  isWeatherDependentQuery,
  isWeatherQuery,
  type AssemblerInput,
  type AssemblerResult,
  type Attachment,
  type FarmContext,
} from './assembler.ts';
