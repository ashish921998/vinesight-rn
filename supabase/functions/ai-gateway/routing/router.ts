/**
 * Router Module
 * Re-exports routing functions from voice-routing.ts for backward compatibility.
 * This module serves as the public API for routing decisions.
 */

// Re-export all types and functions from voice-routing.ts
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
  type ActivityLogExtractionResult,
  type Farm,
  type HybridChatRoute,
  type VoiceLogActivityType,
  type VoiceLogChemicalItem,
  type VoiceLogDraft,
  type VoiceLogFertilizerItem,
  type VoiceLogFormPrefill,
  type VoiceLogMissingField,
  type VoiceLogOriginContext,
  type VoiceLogTurnResult,
} from '../voice-routing.ts';
