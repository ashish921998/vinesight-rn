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

// Farm Data
export {
  detectActivity,
  fetchUserFarms,
  isLikelyHistoryIntent,
  parseExplicitDate,
  queryFarmRecords,
  type FarmRecordRow,
} from './farm-data.ts';

// RAG
export { searchRagContext, type AgronomySearchRow } from './rag.ts';

// Assembler
export {
  assembleContext,
  buildAttachmentContextBlocks,
  buildFarmContextBlock,
} from './assembler.ts';
