/**
 * STT (Speech-to-Text) Provider Module
 * Handles audio transcription via Sarvam Saaras v3 and OpenAI Whisper fallback.
 */

import {
  checkCircuitBreaker,
  decodeBase64ToBytes,
  detectAudioFormatFromHeader,
  isSarvamUnsupportedContainer,
  normalizeOpenAiAudioMime,
  recordProviderFailure,
  recordProviderSuccess,
  STT_TIMEOUT_MS,
  stringifyUnknown,
  toOptionalNumber,
  toOptionalString,
  withAbortTimeout,
} from '../utils/index.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')?.trim() ?? '';

// Sarvam STT model (default: saarika:v2.5, can be overridden to saaras:v3)
const SARVAM_STT_MODEL_RAW = Deno.env.get('ASSISTANT_SARVAM_STT_MODEL')?.trim() || 'saarika:v2.5';
const SARVAM_STT_MODEL = (() => {
  const normalized = SARVAM_STT_MODEL_RAW.toLowerCase();
  if (normalized === 'saarika:v2') return 'saarika:v2.5';
  return SARVAM_STT_MODEL_RAW;
})();

// Feature flag for Sarvam STT usage
const USE_SARVAM_FOR_VOICE =
  (Deno.env.get('ASSISTANT_USE_SARVAM_VOICE') ?? 'true').toLowerCase() !== 'false';

export interface SttResult {
  transcript: string;
  confidence: number | null;
  provider: string;
  fallbackReason?: string;
}

/**
 * Call Sarvam STT API
 */
async function callSarvamSttInternal(
  base64Audio: string,
  mimeType: string,
  locale: 'en' | 'hi' | 'mr',
  signal?: AbortSignal,
): Promise<{ transcript: string; confidence: number | null }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const normalizedMimeType = (() => {
    const normalized = mimeType.trim().toLowerCase();
    if (!normalized) return 'audio/mpeg';
    if (normalized.includes('wav')) return 'audio/wav';
    if (normalized.includes('x-m4a') || normalized.includes('m4a')) return 'audio/mp4';
    if (normalized.includes('mp4')) return 'audio/mp4';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'audio/mpeg';
    if (normalized.startsWith('audio/')) return normalized;
    return 'audio/mpeg';
  })();

  if (normalizedMimeType.includes('mp4')) {
    throw new Error('sarvam_unsupported_audio_container');
  }

  const languageCode = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const candidateModels = Array.from(new Set([SARVAM_STT_MODEL, 'saarika:v2.5']));
  const audioBytes = decodeBase64ToBytes(base64Audio);
  const filename = normalizedMimeType.includes('wav')
    ? 'audio.wav'
    : normalizedMimeType.includes('m4a')
      ? 'audio.m4a'
      : normalizedMimeType.includes('mp4')
        ? 'audio.mp4'
        : normalizedMimeType.includes('aac')
          ? 'audio.aac'
          : 'audio.mp3';

  let lastError = 'Sarvam STT failed';
  for (const model of candidateModels) {
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
      lastError = `${reason} [model=${model}, mime=${normalizedMimeType}]`;
      continue;
    }

    const transcript =
      toOptionalString(data?.transcript) ??
      toOptionalString(data?.text) ??
      toOptionalString(data?.data?.transcript) ??
      toOptionalString(data?.result?.transcript);

    if (!transcript) {
      lastError = `Sarvam STT returned empty transcript [model=${model}, mime=${normalizedMimeType}]`;
      continue;
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

    return { transcript: transcript.trim(), confidence };
  }

  throw new Error(lastError);
}

/**
 * Call OpenAI Whisper STT API
 */
async function callOpenAiSttInternal(
  base64Audio: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ transcript: string; confidence: number | null }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const binary = decodeBase64ToBytes(base64Audio);

  const headerDetected = detectAudioFormatFromHeader(binary);
  const mimeBasedAudio = normalizeOpenAiAudioMime(mimeType);
  const openAiAudio = headerDetected ?? mimeBasedAudio;

  const headerHex = Array.from(binary.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log(
    `[OpenAI STT] clientMime=${mimeType} mimeNormalized=${mimeBasedAudio.mime}/${mimeBasedAudio.filename} headerDetected=${headerDetected ? `${headerDetected.mime}/${headerDetected.filename}` : 'none'} using=${openAiAudio.mime}/${openAiAudio.filename} bytes=${binary.length} header=${headerHex}`,
  );

  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('file', new Blob([binary], { type: openAiAudio.mime }), openAiAudio.filename);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(
      `[OpenAI STT] rejected: ${JSON.stringify(data?.error)} mime=${openAiAudio.mime} filename=${openAiAudio.filename} bytes=${binary.length}`,
    );
    throw new Error(data?.error?.message ?? 'OpenAI STT failed');
  }

  const transcript = data?.text;
  if (typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('OpenAI STT returned empty transcript');
  }

  return { transcript: transcript.trim(), confidence: null };
}

/**
 * Transcribe audio using configured providers with fallback
 */
export async function transcribeAudio(input: {
  base64Audio: string;
  mimeType: string;
  locale: 'en' | 'hi' | 'mr';
  providerFallbackEnabled: boolean;
}): Promise<SttResult> {
  const { base64Audio, mimeType, locale, providerFallbackEnabled } = input;
  const sarvamUnsupportedContainer = isSarvamUnsupportedContainer(mimeType);

  console.log(
    `[STT dispatch] audioMimeType=${mimeType} sarvamUnsupported=${sarvamUnsupportedContainer} useSarvam=${USE_SARVAM_FOR_VOICE} base64len=${base64Audio.length}`,
  );

  let fallbackReason: string | undefined;

  if (USE_SARVAM_FOR_VOICE && !sarvamUnsupportedContainer) {
    const canUseSarvam = checkCircuitBreaker('sarvam_stt');
    if (canUseSarvam) {
      try {
        const result = await withAbortTimeout(
          (signal) => callSarvamSttInternal(base64Audio, mimeType, locale, signal),
          STT_TIMEOUT_MS,
          `Sarvam STT timed out after ${STT_TIMEOUT_MS}ms`,
        );
        recordProviderSuccess('sarvam_stt');
        return {
          transcript: result.transcript,
          confidence: result.confidence,
          provider: 'sarvam',
        };
      } catch (error) {
        recordProviderFailure('sarvam_stt');
        if (!providerFallbackEnabled) throw error;
        console.warn('Sarvam STT failed, falling back to OpenAI:', stringifyUnknown(error));
        fallbackReason = 'sarvam_stt_failed';
      }
    } else {
      console.warn('Sarvam STT circuit breaker open; using OpenAI directly');
      fallbackReason = 'sarvam_stt_circuit_open';
    }
  }

  // OpenAI fallback or primary
  try {
    const result = await withAbortTimeout(
      (signal) => callOpenAiSttInternal(base64Audio, mimeType, signal),
      STT_TIMEOUT_MS,
      `OpenAI STT timed out after ${STT_TIMEOUT_MS}ms`,
    );
    return {
      transcript: result.transcript,
      confidence: result.confidence,
      provider: fallbackReason ? 'openai_fallback' : 'openai',
      fallbackReason,
    };
  } catch (error) {
    if (!fallbackReason && providerFallbackEnabled && USE_SARVAM_FOR_VOICE) {
      recordProviderFailure('openai_stt');
      throw new Error(`Both STT providers failed: ${stringifyUnknown(error)}`);
    }
    throw error;
  }
}

/**
 * Check if Sarvam STT is enabled
 */
export function isSarvamSttEnabled(): boolean {
  return USE_SARVAM_FOR_VOICE;
}

/**
 * Get configured STT model
 */
export function getSarvamSttModel(): string {
  return SARVAM_STT_MODEL;
}
