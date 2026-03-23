/**
 * Common Helper Functions
 * Shared utilities used across the ai-gateway modules.
 */

/** Canonical BCP-47 prefix → supported locale map. Only maps languages we actually support. */
const BCP47_PREFIX_MAP: Record<string, 'en' | 'hi' | 'mr'> = {
  mr: 'mr',
  hi: 'hi',
  en: 'en',
};

const SUPPORTED_LOCALES = new Set<'en' | 'hi' | 'mr'>(['en', 'hi', 'mr']);

/**
 * Resolve a BCP-47 language code (e.g. 'mr-IN') to a supported locale.
 * Returns null for unrecognized languages so callers can fall back to app locale.
 */
export function resolveLocaleFromBcp47(lang: string | null): 'en' | 'hi' | 'mr' | null {
  if (!lang) return null;
  const prefix = lang.trim().toLowerCase().slice(0, 2);
  return BCP47_PREFIX_MAP[prefix] ?? null;
}

/**
 * Runtime guard for persisted locale values loaded from storage.
 */
export function coerceSupportedLocale(value: unknown): 'en' | 'hi' | 'mr' | null {
  return typeof value === 'string' && SUPPORTED_LOCALES.has(value as 'en' | 'hi' | 'mr')
    ? (value as 'en' | 'hi' | 'mr')
    : null;
}

/**
 * Resolve assistant locale for the current turn.
 * Audio turns should use fresh STT detection or fall back to the app locale.
 * Text turns can reuse a previously detected voice locale from route state.
 */
export function resolveEffectiveAssistantLocale(input: {
  inputMode: 'text' | 'audio';
  detectedLanguage: string | null;
  routeStateDetectedLocale: 'en' | 'hi' | 'mr' | null;
  locale: 'en' | 'hi' | 'mr';
  /** Transcript text for text-based locale fallback when STT doesn't return language */
  transcript?: string | null;
}): 'en' | 'hi' | 'mr' {
  const sttDetectedLocale =
    input.inputMode === 'audio' ? resolveLocaleFromBcp47(input.detectedLanguage) : null;

  if (input.inputMode === 'audio') {
    // Priority chain for audio:
    // 1. STT-detected language (from Sarvam BCP-47 code)
    // 2. Route state persisted locale from prior turn (e.g., prior Sarvam detection of 'mr')
    // 3. Text-based Devanagari script detection on the transcript
    // 4. App UI locale (final fallback)
    return (
      sttDetectedLocale ??
      input.routeStateDetectedLocale ??
      detectLocaleFromText(input.transcript ?? null) ??
      input.locale
    );
  }

  // Text input: reuse persisted detected_locale from prior voice turn
  return input.routeStateDetectedLocale ?? input.locale;
}

/**
 * Resolve locale to supported values (defaults to 'en')
 */
export function resolveLocale(locale: string | undefined): 'en' | 'hi' | 'mr' {
  return resolveLocaleFromBcp47(locale ?? null) ?? 'en';
}

// Unicode range for Devanagari script (used by Hindi and Marathi)
const DEVANAGARI_RE = /[\u0900-\u097F]/gu;

/**
 * Detect locale from transcript text using Devanagari script analysis.
 * Used as a fallback when the STT provider doesn't return a language code
 * (e.g., OpenAI Whisper fallback).
 *
 * Returns 'hi' as a conservative default for Devanagari text — both Hindi and
 * Marathi use Devanagari, and we cannot distinguish them from script alone.
 * The caller can refine to 'mr' using other signals (e.g., routeState).
 */
export function detectLocaleFromText(text: string | null): 'hi' | 'mr' | null {
  if (!text) return null;
  const stripped = text.replace(/[^\p{L}\p{M}]/gu, '');
  if (stripped.length < 3) return null;
  const devanagariCount = (stripped.match(DEVANAGARI_RE) ?? []).length;
  const ratio = devanagariCount / stripped.length;
  if (ratio > 0.3) return 'hi';
  return null;
}

/**
 * Resolve the TTS locale from the actual assistant response text.
 * Guards against mismatch where effectiveLocale is 'en' but the LLM
 * responded in Devanagari (Hindi/Marathi).
 */
export function resolveTtsLocale(
  assistantText: string,
  effectiveLocale: 'en' | 'hi' | 'mr',
  sttDetectedLocale: 'en' | 'hi' | 'mr' | null,
): 'en' | 'hi' | 'mr' {
  const stripped = assistantText.replace(/[^\p{L}\p{M}]/gu, '');
  if (stripped.length === 0) return effectiveLocale;

  const devanagariCount = (stripped.match(DEVANAGARI_RE) ?? []).length;
  const ratio = devanagariCount / stripped.length;

  if (ratio > 0.3) {
    // Text is predominantly Devanagari — keep locale if already hi/mr, else default to 'hi'
    if (effectiveLocale === 'mr' || effectiveLocale === 'hi') return effectiveLocale;
    // Prefer sttDetectedLocale if it signals Indic; otherwise default to 'hi'.
    if (sttDetectedLocale === 'mr' || sttDetectedLocale === 'hi') return sttDetectedLocale;
    return 'hi';
  }

  if (ratio < 0.05 && stripped.length > 10 && effectiveLocale !== 'en') {
    // Text is Latin but locale says Hindi/Marathi — switch to English
    return 'en';
  }

  return effectiveLocale;
}

/**
 * Normalize input text (trim whitespace)
 */
export function normalizeInputText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Normalize base64 input (remove data URL prefix if present)
 */
export function normalizeBase64Input(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1).trim();
  }
  return trimmed;
}

/**
 * Estimate the decoded byte size of base64 data
 */
export function estimateBase64Bytes(base64Value: string): number {
  const normalized = base64Value.trim();
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

/**
 * Decode base64 string to Uint8Array
 */
export function decodeBase64ToBytes(base64Audio: string): Uint8Array {
  const cleanBase64 = normalizeBase64Input(base64Audio);
  try {
    return Uint8Array.from(atob(cleanBase64), (ch) => ch.charCodeAt(0));
  } catch {
    throw new Error('invalid_audio_base64');
  }
}

/**
 * Convert unknown value to optional string
 */
export function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Convert unknown value to optional number
 */
export function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/^[^0-9+.-]+/, '')
      .replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Convert to rounded positive number (for quantities, durations)
 */
export function toRoundedPositiveNumber(value: unknown): number | null {
  const parsed = toOptionalNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

/**
 * Safe number conversion with fallback to 0
 */
export function safeNumber(value: unknown): number {
  const parsed = toOptionalNumber(value);
  return parsed !== null && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Convert unknown to Record type, or null if invalid
 */
export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Stringify unknown value for logging or error messages
 */
export function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => stringifyUnknown(item))
      .filter(Boolean)
      .join('; ');
    return joined.trim();
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const prioritized = [
      stringifyUnknown(row.message),
      stringifyUnknown(row.error),
      stringifyUnknown(row.detail),
      stringifyUnknown(row.details),
      stringifyUnknown(row.reason),
    ].filter(Boolean);
    if (prioritized.length > 0) return prioritized.join(' | ');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Check if error message indicates invalid audio
 */
export function isLikelyInvalidAudioError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('audio data too small') ||
    lowered.includes('failed to read the file') ||
    lowered.includes('invalid_audio_base64') ||
    lowered.includes('invalid audio base64') ||
    lowered.includes('invalid audio') ||
    lowered.includes('decode') ||
    lowered.includes('unsupported') ||
    lowered.includes('empty transcript') ||
    lowered.includes('recording')
  );
}

/**
 * Parse JSON object from text (handles code fences)
 */
export function parseJsonObjectFromText(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withoutCodeFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    const parsed: unknown = JSON.parse(withoutCodeFences);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run a promise with abort timeout
 */
export async function withAbortTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}
