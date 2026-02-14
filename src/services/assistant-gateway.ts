import { supabase } from '@/lib/supabase';
import { aiService } from '@/services/ai-service';
import { assistantFeatureFlags, assistantModelConfig } from '@/constants/assistant-flags';
import { normalizeAssistantCitations } from '@/services/rag-citations';
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
import type { SupportedLanguageCode } from '@/i18n/languages';

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

async function extractInvokeErrorContext(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null | undefined)?.context as
    | {
        status?: number;
        statusText?: string;
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      }
    | undefined;

  if (!context) return '';

  const status =
    typeof context.status === 'number'
      ? `status=${context.status}${context.statusText ? ` ${context.statusText}` : ''}`
      : '';

  let body = '';
  try {
    if (typeof context.json === 'function') {
      body = toDebugString(await context.json());
    } else if (typeof context.text === 'function') {
      body = toDebugString(await context.text());
    }
  } catch {
    // ignore parse/read failures
  }

  if (!status && !body) return '';
  if (status && body) return `${status} body=${body}`;
  return status || `body=${body}`;
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
    draft: input.draft as AssistantVoiceLogAction['draft'],
    prefill: input.prefill as AssistantVoiceLogAction['prefill'],
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
  inputAudioBase64?: string | null;
  audioFormat?: string | null;
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

async function fallbackToLegacyAssistant(
  input: SendAssistantTurnInput,
): Promise<AssistantTurnResponse> {
  const legacy = await aiService.sendMessage(
    input.userMessage,
    input.conversationHistory ?? [],
    input.farmContext
      ? {
          farmName: input.farmContext.farmName,
          cropVariety: input.farmContext.cropVariety,
          area: input.farmContext.area,
          region: input.farmContext.region,
          growthStage: input.farmContext.growthStage,
          daysSincePruning: input.farmContext.daysSincePruning,
        }
      : undefined,
    input.language,
    input.attachments ?? [],
  );

  return {
    message: {
      ...legacy.message,
      inputMode: input.inputMode ?? 'text',
      conversationId: input.conversationId ?? undefined,
    },
    suggestions: legacy.suggestions,
    providerUsed: 'openai-proxy',
    modelUsed: assistantModelConfig.advisoryModel,
  };
}

export async function sendAssistantTurn(
  input: SendAssistantTurnInput,
): Promise<AssistantTurnResponse> {
  if (!assistantFeatureFlags.serverVoiceEnabled) {
    return fallbackToLegacyAssistant(input);
  }

  const requestStart = Date.now();

  try {
    const userId = await resolveUserId();
    const requestedInputMode = input.inputMode ?? 'text';
    const hasAudioPayload =
      requestedInputMode === 'audio' &&
      typeof input.inputAudioBase64 === 'string' &&
      input.inputAudioBase64.trim().length > 0;
    const effectiveInputMode: AssistantInputMode = hasAudioPayload ? 'audio' : 'text';
    const normalizedInput = input.userMessage.trim();

    const payload: AssistantGatewayRequest = {
      conversation_id: input.conversationId ?? null,
      user_id: userId,
      locale: input.language,
      input_mode: effectiveInputMode,
      input_text: normalizedInput || null,
      input_audio_b64: hasAudioPayload ? (input.inputAudioBase64 ?? null) : null,
      audio_format: hasAudioPayload ? (input.audioFormat ?? 'audio/mpeg') : null,
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
        can_play_audio: true,
        provider_fallback_enabled: assistantFeatureFlags.providerFallbackEnabled,
        rag_enabled: assistantFeatureFlags.ragEnabled,
        memory_enabled: assistantFeatureFlags.memoryEnabled,
        client_persisted_user_turn: input.clientPersistedUserTurn === true,
      },
    };

    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: payload,
    });

    if (error) {
      const invokeContext = await extractInvokeErrorContext(error);
      const responsePayload = toDebugString(data);
      const responseContext = responsePayload ? `response=${responsePayload}` : '';
      const errorContext = [invokeContext, responseContext].filter(Boolean).join(' | ');
      throw new Error(
        `ai-gateway invoke failed: ${error.message}${errorContext ? ` | ${errorContext}` : ''}`,
      );
    }

    const response = (data ?? null) as AssistantGatewayResponse | null;
    if (!response?.assistant_text?.trim()) {
      const responsePayload = toDebugString(response);
      const errorContext = responsePayload ? ` | response=${responsePayload}` : '';
      throw new Error(`Missing assistant response text${errorContext}`);
    }

    const citations = normalizeAssistantCitations(response.citations);
    const audio = buildAudioPayload(response);
    const elapsed = Date.now() - requestStart;

    return {
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
    };
  } catch (error) {
    if (!assistantFeatureFlags.providerFallbackEnabled) {
      throw error instanceof Error ? error : new Error('Assistant gateway failed');
    }
    return fallbackToLegacyAssistant(input);
  }
}
