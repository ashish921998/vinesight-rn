/**
 * Common Helper Functions
 * Shared utilities used across the ai-gateway modules.
 */

/** Canonical BCP-47 prefix → supported locale map. Extend here when adding a locale. */
const BCP47_PREFIX_MAP: Record<string, 'en' | 'hi' | 'mr'> = {
  mr: 'mr',
  hi: 'hi',
  en: 'en',
  // Map other Indian languages to closest supported locale
  bn: 'hi',
  ta: 'hi',
  te: 'hi',
  kn: 'hi',
};

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
 * Resolve locale to supported values (defaults to 'en')
 */
export function resolveLocale(locale: string | undefined): 'en' | 'hi' | 'mr' {
  return resolveLocaleFromBcp47(locale ?? null) ?? 'en';
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
  let timeoutHandle: number | null = null;

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
