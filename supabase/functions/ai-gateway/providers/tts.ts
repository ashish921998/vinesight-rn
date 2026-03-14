/**
 * TTS (Text-to-Speech) Provider Module
 * Handles speech synthesis via Sarvam Bulbul v3 and OpenAI TTS fallback.
 */

import {
  checkCircuitBreaker,
  recordProviderFailure,
  recordProviderSuccess,
  stringifyUnknown,
  TTS_TIMEOUT_MS,
  withAbortTimeout,
} from '../utils/index.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')?.trim() ?? '';

// Sarvam TTS configuration
const SARVAM_TTS_MODEL = Deno.env.get('ASSISTANT_SARVAM_TTS_MODEL')?.trim() || 'bulbul:v3';
const SARVAM_TTS_MAX_CHARS = 2500;
const SARVAM_TTS_EN_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_EN_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_HI_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_HI_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_MR_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_MR_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_PACE = Number.parseFloat(Deno.env.get('ASSISTANT_SARVAM_TTS_PACE')?.trim() || '1');

// Feature flag for Sarvam TTS usage
const USE_SARVAM_FOR_VOICE =
  (Deno.env.get('ASSISTANT_USE_SARVAM_VOICE') ?? 'true').toLowerCase() !== 'false';

export interface TtsResult {
  base64: string;
  mimeType: string;
  provider: string;
  fallbackReason?: string;
}

/**
 * Call Sarvam TTS API
 */
async function callSarvamTtsInternal(
  text: string,
  locale: 'en' | 'hi' | 'mr',
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const languageCode = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const speaker =
    locale === 'mr'
      ? SARVAM_TTS_MR_SPEAKER
      : locale === 'hi'
        ? SARVAM_TTS_HI_SPEAKER
        : SARVAM_TTS_EN_SPEAKER;
  const pace =
    Number.isFinite(SARVAM_TTS_PACE) && SARVAM_TTS_PACE > 0
      ? Math.max(0.5, Math.min(SARVAM_TTS_PACE, 2))
      : 1;

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, SARVAM_TTS_MAX_CHARS),
      model: SARVAM_TTS_MODEL,
      target_language_code: languageCode,
      speaker,
      pace,
      output_audio_codec: 'mp3',
    }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = stringifyUnknown(data) || 'Sarvam TTS failed';
    throw new Error(message);
  }

  const audioBase64 =
    (Array.isArray(data?.audios) && typeof data.audios[0] === 'string' ? data.audios[0] : null) ||
    (typeof data?.audio === 'string' && data.audio) ||
    (typeof data?.audio_base64 === 'string' && data.audio_base64);
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new Error('Sarvam TTS returned no audio data');
  }

  return { base64: audioBase64, mimeType: 'audio/mpeg' };
}

/**
 * Call OpenAI TTS API
 */
async function callOpenAiTtsInternal(
  text: string,
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      response_format: 'mp3',
    }),
    signal,
  });

  if (!response.ok) {
    let message = 'OpenAI TTS failed';
    try {
      const data = await response.json();
      message = stringifyUnknown(data);
    } catch {
      // ignore parse errors, use default message
    }
    throw new Error(message);
  }

  const binary = await response.arrayBuffer();
  const bytes = new Uint8Array(binary);
  let binaryString = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binaryString += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  const base64 = btoa(binaryString);
  return { base64, mimeType: 'audio/mpeg' };
}

/**
 * Generate speech using configured providers with fallback
 */
export async function generateSpeech(input: {
  text: string;
  locale: 'en' | 'hi' | 'mr';
  providerFallbackEnabled: boolean;
  canPlayAudio: boolean;
}): Promise<TtsResult | null> {
  const { text, locale, providerFallbackEnabled, canPlayAudio } = input;

  if (!canPlayAudio) {
    return null;
  }

  let fallbackReason: string | undefined;

  if (USE_SARVAM_FOR_VOICE && checkCircuitBreaker('sarvam_tts')) {
    try {
      const result = await withAbortTimeout(
        (signal) => callSarvamTtsInternal(text, locale, signal),
        TTS_TIMEOUT_MS,
        `Sarvam TTS timed out after ${TTS_TIMEOUT_MS}ms`,
      );
      recordProviderSuccess('sarvam_tts');
      return {
        base64: result.base64,
        mimeType: result.mimeType,
        provider: 'sarvam',
      };
    } catch (error) {
      recordProviderFailure('sarvam_tts');
      if (!providerFallbackEnabled) {
        fallbackReason = 'sarvam_tts_failed';
        console.warn('Sarvam TTS failed with fallback disabled', error);
        return null;
      }
      console.warn('Sarvam TTS failed, falling back to OpenAI:', stringifyUnknown(error));
      fallbackReason = 'sarvam_tts_failed';
    }
  } else if (USE_SARVAM_FOR_VOICE) {
    fallbackReason = 'sarvam_tts_circuit_open';
  }

  // OpenAI fallback
  try {
    const result = await withAbortTimeout(
      (signal) => callOpenAiTtsInternal(text, signal),
      TTS_TIMEOUT_MS,
      `OpenAI TTS timed out after ${TTS_TIMEOUT_MS}ms`,
    );
    return {
      base64: result.base64,
      mimeType: result.mimeType,
      provider: fallbackReason ? 'openai_fallback' : 'openai',
      fallbackReason,
    };
  } catch (error) {
    recordProviderFailure('openai_tts');
    if (!providerFallbackEnabled) {
      console.warn('Both TTS providers failed with fallback disabled', error);
      return null;
    }
    console.warn('Both TTS providers failed, skipping audio', error);
    return null;
  }
}

/**
 * Get max chars for TTS input
 */
export function getTtsMaxChars(): number {
  return SARVAM_TTS_MAX_CHARS;
}

/**
 * Check if Sarvam TTS is enabled
 */
export function isSarvamTtsEnabled(): boolean {
  return USE_SARVAM_FOR_VOICE;
}

/**
 * Get configured TTS model
 */
export function getSarvamTtsModel(): string {
  return SARVAM_TTS_MODEL;
}
