import { supabase } from '@/lib/supabase';
import { assistantFeatureFlags, assistantModelConfig } from '@/constants/assistant-flags';
import { normalizeAssistantCitations } from '@/services/rag-citations';
import { telemetry } from '@/services/telemetry';
import type {
  AIMessageAttachmentInput,
  AssistantAudio,
  AssistantInputMode,
  AssistantRouteDecision,
  AssistantSafetyMeta,
  AssistantToolEvent,
  AssistantTurnResponse,
  AssistantVoiceLogAction,
  ChatMessage,
} from '@/types/ai';
import type { VoiceLogDraft, VoiceLogFormPrefill } from '@/types/voice-log';
import type { SupportedLanguageCode } from '@/i18n/languages';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = Math.ceil((MAX_AUDIO_SIZE_BYTES * 4) / 3);

export enum AssistantGatewayErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  AUDIO_VALIDATION_FAILED = 'AUDIO_VALIDATION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  CANCELED = 'CANCELED',
  UNKNOWN = 'UNKNOWN',
}

export class AssistantGatewayError extends Error {
  code: AssistantGatewayErrorCode;
  details?: Record<string, unknown>;
  originalError?: Error;

  constructor(
    code: AssistantGatewayErrorCode,
    message: string,
    details?: Record<string, unknown>,
    originalError?: Error,
  ) {
    super(message);
    this.name = 'AssistantGatewayError';
    this.code = code;
    this.details = details;
    this.originalError = originalError;
  }
}

export interface SendAssistantTurnProgress {
  phase: 'preparing' | 'sending' | 'processing' | 'complete';
  percentage: number;
}

export interface SendAssistantTurnOptions {
  requestId?: string;
  onProgress?: (progress: SendAssistantTurnProgress) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface PendingGatewayRequest {
  id: string;
  controller: AbortController;
  startedAt: number;
}

const pendingGatewayRequests = new Map<string, PendingGatewayRequest>();

interface AssistantGatewayRequest {
  conversation_id: string | null;
  user_id: string | null;
  farm_context: {
    farm_id?: number | null;
    farm_name?: string | null;
    crop_variety?: string | null;
    area?: number | null;
    region?: string | null;
    growth_stage?: string | null;
    days_since_pruning?: number | null;
  } | null;
  locale: SupportedLanguageCode;
  input_mode: AssistantInputMode;
  input_text?: string | null;
  input_audio_b64?: string | null;
  audio_format?: string | null;
  audio_duration?: number | null;
  attachments?: AIMessageAttachmentInput[];
  client_capabilities?: {
    can_play_audio?: boolean;
    provider_fallback_enabled?: boolean;
    rag_enabled?: boolean;
    memory_enabled?: boolean;
    client_persisted_user_turn?: boolean;
  };
}

interface AssistantGatewayResponse {
  assistant_text: string;
  /** STT transcript of user's audio input (only present for audio input_mode) */
  user_transcript?: string | null;
  assistant_audio_b64?: string | null;
  assistant_audio_url?: string | null;
  assistant_audio_mime_type?: string | null;
  audio_provider_used?: string | null;
  model_used?: string | null;
  tool_calls?: AssistantToolEvent[];
  tool_results?: Array<Record<string, unknown>>;
  memory_writes?: Array<Record<string, unknown>>;
  citations?: unknown[];
  safety_flags?: {
    blocked?: boolean;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    reasons?: string[];
    escalation_suggested?: boolean;
  };
  trace_id?: string;
  latency_ms?: number;
  conversation_id?: string;
  turn_id?: string;
  suggestions?: string[];
  route_decision?: AssistantRouteDecision | null;
  voice_log_action?: {
    kind?: 'none' | 'cancelled' | 'clarify' | 'ready';
    draft?: Record<string, unknown> | null;
    prefill?: Record<string, unknown> | null;
    missing_fields?: string[];
    expected_field?: string | null;
    clarify_attempts?: number;
    clarify_exhausted?: boolean;
  } | null;
  stt_provider_used?: string | null;
  stt_confidence?: number | null;
  stt_latency_ms?: number | null;
  tts_generation_ms?: number | null;
  tts_skipped_reason?: string | null;
  provider_fallback_reason?: string | null;
}

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

function normalizeBase64Payload(value: string): string {
  return value.replace(/^data:[^;]+;base64,/i, '').trim();
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

function validateAudioPayload(
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
    typeof v.irrigation === 'object' &&
    typeof v.spray === 'object' &&
    typeof v.harvest === 'object' &&
    typeof v.expense === 'object' &&
    typeof v.fertigation === 'object'
  );
}

function isVoiceLogFormPrefill(value: unknown): value is VoiceLogFormPrefill {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && typeof v.date === 'string';
}

function parseInvokeError(
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

  const errObj = error as Record<string, unknown>;
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

export function cancelPendingAssistantTurnRequest(requestId: string): boolean {
  const request = pendingGatewayRequests.get(requestId);
  if (!request) return false;
  request.controller.abort();
  pendingGatewayRequests.delete(requestId);
  telemetry.capture('assistant_gateway_request_cancelled', {
    request_id: requestId,
    duration_ms: Date.now() - request.startedAt,
  });
  return true;
}

export function cancelAllPendingAssistantTurnRequests(): number {
  let cancelled = 0;
  for (const [requestId, request] of pendingGatewayRequests.entries()) {
    request.controller.abort();
    cancelled += 1;
    pendingGatewayRequests.delete(requestId);
  }
  telemetry.capture('assistant_gateway_all_requests_cancelled', {
    count: cancelled,
  });
  return cancelled;
}

function toSafetyMeta(input: AssistantGatewayResponse['safety_flags']): AssistantSafetyMeta | null {
  if (!input) return null;
  return {
    blocked: input.blocked === true,
    riskLevel: input.risk_level ?? 'low',
    reasons: Array.isArray(input.reasons) ? input.reasons : [],
    escalationSuggested: input.escalation_suggested === true,
  };
}

function toVoiceLogAction(
  input: AssistantGatewayResponse['voice_log_action'],
): AssistantVoiceLogAction | null {
  if (!input || !input.kind) return null;

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
    kind: input.kind,
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

async function resolveUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface SendAssistantTurnInput {
  conversationId?: string | null;
  userMessage: string;
  language: SupportedLanguageCode;
  inputMode?: AssistantInputMode;
  clientCanPlayAudio?: boolean;
  inputAudioBase64?: string | null;
  audioFormat?: string | null;
  audioDuration?: number | null;
  attachments?: AIMessageAttachmentInput[];
  conversationHistory?: ChatMessage[];
  clientPersistedUserTurn?: boolean;
  farmContext?: {
    farmId?: number | null;
    farmName?: string;
    cropVariety?: string;
    area?: number;
    region?: string;
    growthStage?: string;
    daysSincePruning?: number;
  };
}

function buildAudioPayload(response: AssistantGatewayResponse): AssistantAudio | null {
  const hasAudio = Boolean(response.assistant_audio_b64 || response.assistant_audio_url);
  if (!hasAudio) return null;

  return {
    provider: response.audio_provider_used ?? undefined,
    mimeType: response.assistant_audio_mime_type ?? 'audio/mpeg',
    base64: response.assistant_audio_b64 ?? null,
    url: response.assistant_audio_url ?? null,
  };
}

export async function sendAssistantTurn(
  input: SendAssistantTurnInput,
  options?: SendAssistantTurnOptions,
): Promise<AssistantTurnResponse> {
  const requestId =
    options?.requestId ?? `ai-gateway-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestStart = Date.now();
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  let requestTimedOut = false;
  const controller = new AbortController();
  const previousRequest = pendingGatewayRequests.get(requestId);
  if (previousRequest) {
    previousRequest.controller.abort();
    pendingGatewayRequests.delete(requestId);
  }
  pendingGatewayRequests.set(requestId, {
    id: requestId,
    controller,
    startedAt: requestStart,
  });
  const externalSignal = options?.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternal);
  }

  try {
    options?.onProgress?.({ phase: 'preparing', percentage: 10 });
    const userId = await resolveUserId();
    const requestedInputMode = input.inputMode ?? 'text';
    const hasAudioPayload =
      requestedInputMode === 'audio' &&
      typeof input.inputAudioBase64 === 'string' &&
      input.inputAudioBase64.trim().length > 0;

    if (hasAudioPayload) {
      const validation = validateAudioPayload(input.inputAudioBase64 as string);
      if (!validation.valid) {
        throw new AssistantGatewayError(
          AssistantGatewayErrorCode.AUDIO_VALIDATION_FAILED,
          validation.error,
          {
            requestId,
            inputMode: requestedInputMode,
          },
        );
      }
    }

    const effectiveInputMode: AssistantInputMode = hasAudioPayload ? 'audio' : 'text';
    const normalizedInput = input.userMessage.trim();

    if (!hasAudioPayload && !normalizedInput) {
      throw new AssistantGatewayError(
        AssistantGatewayErrorCode.INVALID_REQUEST,
        'Empty request: no audio or text input provided',
        {
          requestId,
          inputMode: requestedInputMode,
        },
      );
    }

    const clientCanPlayAudio =
      typeof input.clientCanPlayAudio === 'boolean'
        ? input.clientCanPlayAudio
        : effectiveInputMode === 'audio';

    const payload: AssistantGatewayRequest = {
      conversation_id: input.conversationId ?? null,
      user_id: userId,
      locale: input.language,
      input_mode: effectiveInputMode,
      input_text: normalizedInput || null,
      input_audio_b64: hasAudioPayload
        ? (normalizeBase64Payload(input.inputAudioBase64 ?? '') ?? null)
        : null,
      audio_format: hasAudioPayload ? (input.audioFormat ?? null) : null,
      audio_duration:
        hasAudioPayload &&
        typeof input.audioDuration === 'number' &&
        Number.isFinite(input.audioDuration)
          ? input.audioDuration
          : null,
      attachments: input.attachments ?? [],
      farm_context: input.farmContext
        ? {
            farm_id: input.farmContext.farmId ?? null,
            farm_name: input.farmContext.farmName ?? null,
            crop_variety: input.farmContext.cropVariety ?? null,
            area: input.farmContext.area ?? null,
            region: input.farmContext.region ?? null,
            growth_stage: input.farmContext.growthStage ?? null,
            days_since_pruning: input.farmContext.daysSincePruning ?? null,
          }
        : null,
      client_capabilities: {
        can_play_audio: clientCanPlayAudio,
        provider_fallback_enabled: assistantFeatureFlags.providerFallbackEnabled,
        rag_enabled: assistantFeatureFlags.ragEnabled,
        memory_enabled: assistantFeatureFlags.memoryEnabled,
        client_persisted_user_turn: input.clientPersistedUserTurn === true,
      },
    };

    options?.onProgress?.({ phase: 'sending', percentage: 35 });
    const timeoutId = setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, timeoutMs);

    let data: AssistantGatewayResponse | null = null;
    let error: unknown = null;
    try {
      const invokeResult = await supabase.functions.invoke<AssistantGatewayResponse>('ai-gateway', {
        body: payload,
        signal: controller.signal,
      });
      data = invokeResult.data ?? null;
      error = invokeResult.error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (requestTimedOut) {
      throw new AssistantGatewayError(
        AssistantGatewayErrorCode.TIMEOUT,
        `Request timeout after ${timeoutMs}ms`,
        { requestId, timeoutMs },
      );
    }

    if (error) {
      throw error;
    }

    const response = data;
    if (!response?.assistant_text?.trim()) {
      telemetry.capture('assistant_gateway_invalid_response', {
        request_id: requestId,
        reason: 'missing_assistant_text',
        has_text:
          typeof response?.assistant_text === 'string' && response.assistant_text.length > 0,
        text_length:
          typeof response?.assistant_text === 'string' ? response.assistant_text.length : 0,
        tool_count: Array.isArray(response?.tool_calls) ? response.tool_calls.length : 0,
        has_memory_writes:
          Array.isArray(response?.memory_writes) && response.memory_writes.length > 0,
        citation_count: Array.isArray(response?.citations) ? response.citations.length : 0,
      });
      throw new AssistantGatewayError(
        AssistantGatewayErrorCode.INVALID_RESPONSE,
        'Missing assistant response text',
        {
          requestId,
        },
      );
    }

    options?.onProgress?.({ phase: 'processing', percentage: 80 });

    const citations = normalizeAssistantCitations(response.citations);
    const audio = buildAudioPayload(response);
    const elapsed = Date.now() - requestStart;

    const result: AssistantTurnResponse = {
      message: {
        id: response.turn_id ?? Date.now().toString(),
        role: 'assistant',
        content: response.assistant_text,
        timestamp: new Date(),
        conversationId: response.conversation_id ?? input.conversationId ?? undefined,
        turnId: response.turn_id,
        inputMode: effectiveInputMode,
        audio,
        toolEvents: response.tool_calls,
        citations,
        safety: toSafetyMeta(response.safety_flags),
        traceId: response.trace_id,
        audioMeta: {
          providerUsed: response.audio_provider_used ?? 'ai-gateway',
          sttProviderUsed: response.stt_provider_used ?? null,
          ttsSkippedReason: response.tts_skipped_reason ?? null,
          providerFallbackReason: response.provider_fallback_reason ?? null,
        },
      },
      suggestions: Array.isArray(response.suggestions) ? response.suggestions : undefined,
      providerUsed: response.audio_provider_used ?? 'ai-gateway',
      modelUsed: response.model_used ?? assistantModelConfig.advisoryModel,
      latencyMs: response.latency_ms ?? elapsed,
      toolCalls: response.tool_calls,
      memoryWrites: response.memory_writes,
      traceId: response.trace_id,
      routeDecision: response.route_decision ?? null,
      voiceLogAction: toVoiceLogAction(response.voice_log_action),
      sttProviderUsed: response.stt_provider_used ?? null,
      sttConfidence:
        typeof response.stt_confidence === 'number' && Number.isFinite(response.stt_confidence)
          ? response.stt_confidence
          : null,
      sttLatencyMs:
        typeof response.stt_latency_ms === 'number' && Number.isFinite(response.stt_latency_ms)
          ? response.stt_latency_ms
          : null,
      ttsGenerationMs:
        typeof response.tts_generation_ms === 'number' &&
        Number.isFinite(response.tts_generation_ms)
          ? response.tts_generation_ms
          : null,
      ttsSkippedReason: response.tts_skipped_reason ?? null,
      providerFallbackReason: response.provider_fallback_reason ?? null,
      userTranscript: response.user_transcript ?? null,
    };
    options?.onProgress?.({ phase: 'complete', percentage: 100 });
    return result;
  } catch (error) {
    let parsedError = parseInvokeError(error, 'sendAssistantTurn', {
      requestId,
      durationMs: Date.now() - requestStart,
    });
    if (requestTimedOut && parsedError.code === AssistantGatewayErrorCode.CANCELED) {
      parsedError = new AssistantGatewayError(
        AssistantGatewayErrorCode.TIMEOUT,
        `Request timeout after ${timeoutMs}ms`,
        {
          requestId,
          durationMs: Date.now() - requestStart,
        },
        parsedError,
      );
    }

    telemetry.capture('assistant_gateway_error', {
      request_id: requestId,
      error_code: parsedError.code,
      error_message: `code:${parsedError.code}`,
      duration_ms: Date.now() - requestStart,
    });

    throw parsedError;
  } finally {
    const currentPendingRequest = pendingGatewayRequests.get(requestId);
    if (currentPendingRequest?.controller === controller) {
      pendingGatewayRequests.delete(requestId);
    }
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}
