/**
 * Utils Module Index
 * Re-exports all utility functions for clean imports.
 */

// Circuit Breaker
export {
  checkCircuitBreaker,
  cleanExpiredCircuitBreakers,
  getCircuitBreakerState,
  getFailureThreshold,
  getResetTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  type CircuitBreakerState,
} from './circuit-breaker.ts';

// Cost Tracker
export {
  calculateCost,
  estimateTokens,
  PRICING,
  roundUsd,
  type CostBreakdown,
} from './cost-tracker.ts';

// Telemetry
export {
  createTelemetryEvent,
  generateTraceId,
  trackTelemetry,
  type TelemetryEvent,
} from './telemetry.ts';

// CORS
export { corsHeaders, corsOptionsResponse, jsonResponse } from './cors.ts';

// Helpers
export {
  coerceSupportedLocale,
  decodeBase64ToBytes,
  estimateBase64Bytes,
  isLikelyInvalidAudioError,
  normalizeBase64Input,
  normalizeInputText,
  parseJsonObjectFromText,
  resolveEffectiveAssistantLocale,
  resolveLocale,
  resolveLocaleFromBcp47,
  resolveTtsLocale,
  safeNumber,
  stringifyUnknown,
  toOptionalNumber,
  toOptionalString,
  toRecord,
  toRoundedPositiveNumber,
  withAbortTimeout,
} from './helpers.ts';

// Audio
export {
  detectAudioFormatFromBase64,
  detectAudioFormatFromHeader,
  isSarvamUnsupportedContainer,
  LLM_TIMEOUT_MS,
  MAX_AUDIO_BASE64_LENGTH,
  MAX_AUDIO_SIZE_MB,
  MAX_TEXT_LENGTH,
  MIN_AUDIO_BASE64_LENGTH,
  MIN_AUDIO_ESTIMATED_BYTES,
  normalizeOpenAiAudioMime,
  normalizeSarvamAudioMime,
  STT_TIMEOUT_MS,
  TTS_TIMEOUT_MS,
  type AudioFormatInfo,
} from './audio.ts';

// Database/Auth
export {
  extractBearerToken,
  readConversationRouteState,
  resolveAuthenticatedUserId,
  resolveConversationId,
  writeConversationRouteState,
  writeConversationTurn,
} from './auth.ts';
