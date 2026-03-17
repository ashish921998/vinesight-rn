/**
 * Handlers Module Index
 * Re-exports all handler functions for clean imports.
 */

// Main handler
export { handleRequest } from './main.ts';

// Request processor
export { processStt, setupConversation } from './request-processor.ts';

// Advisory
export {
  handleAdvisory,
  type AdvisoryHandlerInput,
  type AdvisoryHandlerResult,
} from './advisory.ts';

// Farm Query
export {
  handleFarmQuery,
  type FarmQueryHandlerInput,
  type FarmQueryHandlerResult,
} from './farm-query.ts';

// Voice Log
export {
  handleVoiceLog,
  type VoiceLogActionPayload,
  type VoiceLogDraft,
  type VoiceLogHandlerInput,
  type VoiceLogHandlerResult,
} from './voice-log.ts';

// Clarify
export { buildClarificationPrompt, handleClarify, type ClarifyHandlerResult } from './clarify.ts';
