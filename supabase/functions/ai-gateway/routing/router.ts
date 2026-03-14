/**
 * Router Module (Orchestrator)
 * Re-exports all routing types and functions from focused sub-modules.
 *
 * Sub-modules:
 *  - types.ts            — TypeScript type definitions
 *  - intent-patterns.ts  — Pattern definitions, parsing, detection, getVoiceLogMissingFields
 *  - voice-log-routing.ts — Voice log state machine and form prefill
 *  - farm-query-routing.ts — Route decision, clarification, and message builders
 */

// ============================================================
// MARK: - Type Re-exports
// ============================================================

export type {
  Farm,
  HybridChatRoute,
  QueryIntent,
  VoiceLogActivityType,
  VoiceLogChemicalItem,
  VoiceLogDraft,
  VoiceLogFertilizerItem,
  VoiceLogFormPrefill,
  VoiceLogMissingField,
  VoiceLogOriginContext,
  VoiceLogTurnResult,
} from './types.ts';

// ============================================================
// MARK: - Pattern / Parsing / Detection Re-exports
// ============================================================

export {
  detectActivityTypeFromText,
  getVoiceLogMissingFields,
  hasLoggingSignal,
  isLikelyLogHistoryQuery,
  parseAmount,
  parseDurationHours,
  parseExpenseType,
  parseHarvestGrade,
  parseLogDate,
  parseQuantityKg,
  parseWaterVolume,
  scoreFromDeterministicQueryIntent,
} from './intent-patterns.ts';

// ============================================================
// MARK: - Voice Log State Machine Re-exports
// ============================================================

export {
  buildVoiceLogFormPrefill,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
} from './voice-log-routing.ts';

// ============================================================
// MARK: - Farm Query Routing Re-exports
// ============================================================

export {
  buildRouteClarificationCancelled,
  buildRouteClarificationPrompt,
  buildRouteClarificationRetry,
  buildVoiceLogCancelledMessage,
  buildVoiceLogClarificationMessage,
  buildVoiceLogClarifyExhaustedMessage,
  buildVoiceLogNoFarmsMessage,
  buildVoiceLogOpeningFormMessage,
  decideChatRoute,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
} from './farm-query-routing.ts';
