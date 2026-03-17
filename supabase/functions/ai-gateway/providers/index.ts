/**
 * Providers Module Index
 * Re-exports all provider functions for clean imports.
 */

// STT
export { getSarvamSttModel, isSarvamSttEnabled, transcribeAudio, type SttResult } from './stt.ts';

// TTS
export {
  generateSpeech,
  getSarvamTtsModel,
  getTtsMaxChars,
  isSarvamTtsEnabled,
  type TtsResult,
} from './tts.ts';

// LLM
export {
  chatCompletion,
  chatCompletionWithTimeout,
  extractIntent,
  extractIntentWithTimeout,
  getAdvisoryModel,
  getExtractionModel,
  type ChatCompletionResult,
} from './llm.ts';

// Embeddings
export { generateEmbedding, getEmbeddingDimensions, getEmbeddingModel } from './embeddings.ts';
