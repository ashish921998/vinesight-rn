/**
 * Routing Module Index
 * Re-exports all routing functions for clean imports.
 */

// Intent
export {
  buildDeterministicQueryIntent,
  extractActivityIntent,
  parseActivityExtractionResult,
  type ActivityLogExtractionResult,
} from './intent.ts';

// Router - clean modular implementation
export {
  buildRouteClarificationCancelled,
  buildRouteClarificationPrompt,
  buildRouteClarificationRetry,
  buildVoiceLogCancelledMessage,
  buildVoiceLogClarificationMessage,
  buildVoiceLogClarifyExhaustedMessage,
  buildVoiceLogFormPrefill,
  buildVoiceLogNoFarmsMessage,
  buildVoiceLogOpeningFormMessage,
  decideChatRoute,
  getVoiceLogMissingFields,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
  type Farm,
  type HybridChatRoute,
  type QueryIntent,
  type VoiceLogActivityType,
  type VoiceLogChemicalItem,
  type VoiceLogDraft,
  type VoiceLogFertilizerItem,
  type VoiceLogFormPrefill,
  type VoiceLogMissingField,
  type VoiceLogOriginContext,
  type VoiceLogTurnResult,
} from './router.ts';
