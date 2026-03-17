import { assistantModelConfig } from '@/constants/assistant-flags';
import type { AssistantAudio, AssistantSafetyMeta, AssistantVoiceLogAction } from '@/types/ai';
import type { VoiceLogDraft, VoiceLogFormPrefill } from '@/types/voice-log';
import {
  AssistantGatewayError,
  AssistantGatewayErrorCode,
  type AssistantGatewayResponse,
} from '@/services/assistant-gateway-types';

const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = Math.ceil(MAX_AUDIO_SIZE_BYTES / 3) * 4;

function toDebugString(value: unknown, maxLength = 1200): string {
  try {
    const raw =
      typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? ''
          : JSON.stringify(value);
    if (!raw) return '';
    return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
  } catch {
    return '';
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown assistant gateway error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
    const serialized = toDebugString(error, 300);
    if (serialized) return serialized;
  }

  return String(error);
}

export function normalizeBase64Payload(value: string): string {
  return value.replace(/^data:[^;]+(?:;[^,]+)*;base64,/i, '').trim();
}

function normalizeBase64Padding(value: string): string {
  const normalized = value.trim();
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(paddingLength);
}

function estimateBase64Bytes(base64Payload: string): number {
  const normalized = base64Payload.trim();
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export function validateAudioPayload(
  base64Audio: string,
): { valid: true; bytes: number } | { valid: false; error: string } {
  const normalized = normalizeBase64Payload(base64Audio);
  if (!normalized) {
    return { valid: false, error: 'Audio payload is empty' };
  }

  if (normalized.length > MAX_AUDIO_BASE64_LENGTH) {
    const sizeMb = estimateBase64Bytes(normalized) / (1024 * 1024);
    return {
      valid: false,
      error: `Audio payload too large (${sizeMb.toFixed(2)}MB > 10MB)`,
    };
  }

  const padded = normalizeBase64Padding(normalized);
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(padded)) {
    return { valid: false, error: 'Invalid base64 format' };
  }

  const atobFn = typeof globalThis.atob === 'function' ? globalThis.atob.bind(globalThis) : null;
  if (atobFn) {
    try {
      atobFn(padded);
    } catch {
      return { valid: false, error: 'Invalid base64 data' };
    }
  }

  return { valid: true, bytes: estimateBase64Bytes(normalized) };
}

function isVoiceLogDraft(value: unknown): value is VoiceLogDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    (v.farmId === null || typeof v.farmId === 'number') &&
    typeof v.date === 'string' &&
    v.irrigation !== null &&
    typeof v.irrigation === 'object' &&
    v.spray !== null &&
    typeof v.spray === 'object' &&
    v.harvest !== null &&
    typeof v.harvest === 'object' &&
    v.expense !== null &&
    typeof v.expense === 'object' &&
    v.fertigation !== null &&
    typeof v.fertigation === 'object'
  );
}

function isVoiceLogFormPrefill(value: unknown): value is VoiceLogFormPrefill {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && typeof v.date === 'string';
}

export function parseInvokeError(
  error: unknown,
  context: string,
  extras?: Record<string, unknown>,
): AssistantGatewayError {
  if (error instanceof AssistantGatewayError) return error;

  const baseError = error instanceof Error ? error : new Error(toErrorMessage(error));
  const rawMessage = baseError.message || 'Unknown assistant gateway error';
  const normalizedMessage = rawMessage.toLowerCase();
  const details: Record<string, unknown> = {
    context,
    rawMessage,
    ...(extras ?? {}),
  };

  const errObj = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const status =
    typeof errObj.status === 'number'
      ? errObj.status
      : typeof errObj.statusCode === 'number'
        ? errObj.statusCode
        : null;
  const response = errObj.response as Record<string, unknown> | null;
  const responseStatus = typeof response?.status === 'number' ? response.status : null;

  if (normalizedMessage.includes('abort')) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.CANCELED,
      'Request was canceled',
      details,
      baseError,
    );
  }

  if (normalizedMessage.includes('timeout')) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.TIMEOUT,
      'Request timed out',
      details,
      baseError,
    );
  }

  if (
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('econnreset') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('econnrefused') ||
    normalizedMessage.includes('failed to fetch')
  ) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.NETWORK_ERROR,
      'Network request failed',
      details,
      baseError,
    );
  }

  if (status === 401 || status === 403 || responseStatus === 401 || responseStatus === 403) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.AUTHENTICATION_FAILED,
      'Authentication failed',
      details,
      baseError,
    );
  }

  if (status === 429 || responseStatus === 429) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.RATE_LIMITED,
      'Rate limited',
      details,
      baseError,
    );
  }

  if (
    (status !== null && status >= 500 && status < 600) ||
    (responseStatus !== null && responseStatus >= 500 && responseStatus < 600)
  ) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.SERVER_ERROR,
      'Server error',
      details,
      baseError,
    );
  }

  if ((status === 400 || responseStatus === 400) && normalizedMessage.includes('audio')) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED,
      'Audio recording is too short or invalid. Please try again and speak longer.',
      details,
      baseError,
    );
  }

  if (
    normalizedMessage.includes('invalid_audio') ||
    normalizedMessage.includes('invalid audio') ||
    normalizedMessage.includes('audio recording is too short') ||
    normalizedMessage.includes('audio data is too small') ||
    (normalizedMessage.includes('status=400') && normalizedMessage.includes('audio'))
  ) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED,
      'Audio recording is too short or invalid. Please try again and speak longer.',
      details,
      baseError,
    );
  }

  if (
    normalizedMessage.includes('status=5') ||
    normalizedMessage.includes('function not found') ||
    normalizedMessage.includes('edge function not found') ||
    normalizedMessage.includes('failed to send a request to the edge function') ||
    normalizedMessage.includes('failed to execute the function')
  ) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.SERVER_ERROR,
      'Server error',
      details,
      baseError,
    );
  }

  if (normalizedMessage.includes('missing assistant response text')) {
    return new AssistantGatewayError(
      AssistantGatewayErrorCode.INVALID_RESPONSE,
      'Assistant response was empty',
      details,
      baseError,
    );
  }

  return new AssistantGatewayError(
    AssistantGatewayErrorCode.UNKNOWN,
    rawMessage,
    details,
    baseError,
  );
}

export function toSafetyMeta(
  input: AssistantGatewayResponse['safety_flags'],
): AssistantSafetyMeta | null {
  if (!input) return null;
  return {
    blocked: input.blocked === true,
    riskLevel: input.risk_level ?? 'low',
    reasons: Array.isArray(input.reasons) ? input.reasons : [],
    escalationSuggested: input.escalation_suggested === true,
  };
}

export function toVoiceLogAction(
  input: AssistantGatewayResponse['voice_log_action'],
): AssistantVoiceLogAction | null {
  if (!input || !input.kind) return null;
  const kind =
    input.kind === 'none' ||
    input.kind === 'cancelled' ||
    input.kind === 'clarify' ||
    input.kind === 'ready'
      ? input.kind
      : null;
  if (!kind) return null;

  const expectedFieldRaw = typeof input.expected_field === 'string' ? input.expected_field : null;
  const expectedField =
    expectedFieldRaw === 'farm' ||
    expectedFieldRaw === 'duration' ||
    expectedFieldRaw === 'waterVolume' ||
    expectedFieldRaw === 'chemicals' ||
    expectedFieldRaw === 'quantity' ||
    expectedFieldRaw === 'grade' ||
    expectedFieldRaw === 'cost' ||
    expectedFieldRaw === 'expenseType' ||
    expectedFieldRaw === 'fertilizers'
      ? expectedFieldRaw
      : null;

  const missingFields = Array.isArray(input.missing_fields)
    ? input.missing_fields.filter(
        (field): field is NonNullable<AssistantVoiceLogAction['expectedField']> =>
          field === 'farm' ||
          field === 'duration' ||
          field === 'waterVolume' ||
          field === 'chemicals' ||
          field === 'quantity' ||
          field === 'grade' ||
          field === 'cost' ||
          field === 'expenseType' ||
          field === 'fertilizers',
      )
    : undefined;

  return {
    kind,
    draft: isVoiceLogDraft(input.draft) ? input.draft : null,
    prefill: isVoiceLogFormPrefill(input.prefill) ? input.prefill : null,
    missingFields,
    expectedField,
    clarifyAttempts:
      typeof input.clarify_attempts === 'number' && Number.isFinite(input.clarify_attempts)
        ? input.clarify_attempts
        : undefined,
    clarifyExhausted: input.clarify_exhausted === true,
  };
}

export function buildAudioPayload(response: AssistantGatewayResponse): AssistantAudio | null {
  const hasAudio = Boolean(response.assistant_audio_b64 || response.assistant_audio_url);
  if (!hasAudio) return null;

  return {
    provider: response.audio_provider_used ?? undefined,
    mimeType: response.assistant_audio_mime_type ?? 'audio/mpeg',
    base64: response.assistant_audio_b64 ?? null,
    url: response.assistant_audio_url ?? null,
  };
}

export function getDefaultAssistantModel(): string {
  return assistantModelConfig.advisoryModel;
}
