/**
 * STT (Speech-to-Text) Provider Module
 * Handles audio transcription via Sarvam Saaras v3.
 *
 * Key features:
 * - Saaras v3 model as primary STT (supports 23 Indian languages + English)
 * - Auto language detection via language_code='unknown'
 * - M4A/MP4 format support (Saaras v3 handles these)
 * - Circuit breaker pattern (5 failures → open for 60s)
 * - No cross-provider fallback; failures remain visible to the caller
 */

import {
  checkCircuitBreaker,
  decodeBase64ToBytes,
  recordProviderFailure,
  recordProviderSuccess,
  STT_TIMEOUT_MS,
  stringifyUnknown,
  toOptionalNumber,
  toOptionalString,
  withAbortTimeout,
} from '../utils/index.ts';

const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')?.trim() ?? '';

// Sarvam STT model - Saaras v3 is the default (supports M4A/MP4 and 23 languages)
// Can be overridden via ASSISTANT_SARVAM_STT_MODEL env var
const SARVAM_STT_MODEL_RAW = Deno.env.get('ASSISTANT_SARVAM_STT_MODEL')?.trim() || 'saaras:v3';
const SARVAM_STT_MODEL = (() => {
  const normalized = SARVAM_STT_MODEL_RAW.toLowerCase();
  // Normalize shorthand versions
  if (normalized === 'saarika:v2') return 'saarika:v2.5';
  if (normalized === 'saaras:v3' || normalized === 'saaras:v2') return SARVAM_STT_MODEL_RAW;
  return SARVAM_STT_MODEL_RAW;
})();

export interface SttResult {
  transcript: string;
  confidence: number | null;
  provider: string;
  fallbackReason?: string;
  /** BCP-47 language code detected from the audio (e.g., 'mr-IN' for Marathi) */
  detectedLanguage: string | null;
}

/**
 * Call Sarvam STT API with Saaras v3
 * Supports auto language detection and M4A/MP4 formats.
 */
async function callSarvamSttInternal(
  base64Audio: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ transcript: string; confidence: number | null; detectedLanguage: string | null }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const normalizedMimeType = (() => {
    const normalized = mimeType.trim().toLowerCase();
    if (!normalized) return 'audio/mpeg';
    if (normalized.includes('wav')) return 'audio/wav';
    // Saaras v3 supports M4A/MP4 containers
    if (normalized.includes('x-m4a') || normalized.includes('m4a')) return 'audio/mp4';
    if (normalized.includes('mp4')) return 'audio/mp4';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'audio/mpeg';
    if (normalized.includes('aac')) return 'audio/aac';
    if (normalized.includes('ogg') || normalized.includes('oga')) return 'audio/ogg';
    if (normalized.includes('flac')) return 'audio/flac';
    if (normalized.includes('webm')) return 'audio/webm';
    if (normalized.startsWith('audio/')) return normalized;
    return 'audio/mpeg';
  })();

  // Saaras v3 supports M4A/MP4 - no longer need to reject these formats
  // Auto language detection: use 'unknown' for Saaras v3 to support all 23 languages + code-mixing
  const languageCode = 'unknown';

  const audioBytes = decodeBase64ToBytes(base64Audio);
  const filename = normalizedMimeType.includes('wav')
    ? 'audio.wav'
    : normalizedMimeType.includes('m4a')
      ? 'audio.m4a'
      : normalizedMimeType.includes('mp4')
        ? 'audio.mp4'
        : normalizedMimeType.includes('aac')
          ? 'audio.aac'
          : normalizedMimeType.includes('ogg')
            ? 'audio.ogg'
            : normalizedMimeType.includes('flac')
              ? 'audio.flac'
              : normalizedMimeType.includes('webm')
                ? 'audio.webm'
                : 'audio.mp3';

  // Use only the configured model (Saaras v3)
  const model = SARVAM_STT_MODEL;
  const form = new FormData();
  form.append('model', model);
  form.append('language_code', languageCode);
  form.append('with_timestamps', 'false');
  form.append('file', new Blob([audioBytes], { type: normalizedMimeType }), filename);

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: form,
    signal,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = stringifyUnknown(data) || `Sarvam STT failed (${response.status})`;
    throw new Error(`${reason} [model=${model}, mime=${normalizedMimeType}]`);
  }

  const transcript =
    toOptionalString(data?.transcript) ??
    toOptionalString(data?.text) ??
    toOptionalString(data?.data?.transcript) ??
    toOptionalString(data?.result?.transcript);

  if (!transcript || !transcript.trim()) {
    throw new Error('stt_empty_transcript');
  }

  const confidenceRaw = toOptionalNumber(
    data?.confidence ??
      data?.avg_confidence ??
      data?.metadata?.confidence ??
      data?.data?.confidence,
  );
  const confidence =
    confidenceRaw !== null
      ? Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw))
      : null;

  // Extract detected language from Sarvam response (BCP-47 code like 'mr-IN', 'hi-IN')
  const detectedLanguage =
    toOptionalString(data?.language_code) ??
    toOptionalString(data?.data?.language_code) ??
    toOptionalString(data?.result?.language_code);

  return { transcript: transcript.trim(), confidence, detectedLanguage };
}

/**
 * Transcribe audio using Sarvam.
 * Saaras v3 supports all audio formats including M4A/MP4
 */
export async function transcribeAudio(input: {
  base64Audio: string;
  mimeType: string;
  providerFallbackEnabled: boolean;
}): Promise<SttResult> {
  const { base64Audio, mimeType } = input;

  // Note: Saaras v3 supports M4A/MP4 - no bypass needed for these formats

  console.log(
    `[STT dispatch] audioMimeType=${mimeType} model=${SARVAM_STT_MODEL} base64len=${base64Audio.length}`,
  );

  if (!checkCircuitBreaker('sarvam_stt')) {
    throw new Error('Sarvam STT circuit breaker is open');
  }
  try {
    const result = await withAbortTimeout(
      (signal) => callSarvamSttInternal(base64Audio, mimeType, signal),
      STT_TIMEOUT_MS,
      `Sarvam STT timed out after ${STT_TIMEOUT_MS}ms`,
    );
    recordProviderSuccess('sarvam_stt');
    return {
      transcript: result.transcript,
      confidence: result.confidence,
      provider: 'sarvam',
      detectedLanguage: result.detectedLanguage,
    };
  } catch (error) {
    recordProviderFailure('sarvam_stt');
    if (stringifyUnknown(error).includes('stt_empty_transcript'))
      throw new Error('stt_empty_transcript');
    throw error;
  }
}

/**
 * Check if Sarvam STT is enabled
 */
export function isSarvamSttEnabled(): boolean {
  return true;
}

/**
 * Get configured STT model
 */
export function getSarvamSttModel(): string {
  return SARVAM_STT_MODEL;
}
