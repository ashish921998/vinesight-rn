import { supabase } from '@/lib/supabase';
import { assistantFeatureFlags } from '@/constants/assistant-flags';
import { normalizeAssistantCitations } from '@/services/rag-citations';
import { telemetry } from '@/services/telemetry';
import type { AssistantInputMode, AssistantTurnResponse } from '@/types/ai';
import {
  AssistantGatewayError,
  AssistantGatewayErrorCode,
  type AssistantGatewayRequest,
  type AssistantGatewayResponse,
  type PendingGatewayRequest,
  type SendAssistantTurnInput,
  type SendAssistantTurnOptions,
} from '@/services/assistant-gateway-types';
import {
  buildAudioPayload,
  getDefaultAssistantModel,
  normalizeBase64Payload,
  parseInvokeError,
  toSafetyMeta,
  toVoiceLogAction,
  validateAudioPayload,
} from '@/services/assistant-gateway-utils';

const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Strip trailing "Sources:" / "SOURCES" blocks the LLM sometimes appends to its text.
 * Structured citations are already delivered separately via the `citations` field.
 */
function stripTrailingSourcesBlock(text: string): string {
  return text.replace(/\n{1,3}(?:sources|SOURCES):?\s*\n[\s\S]*$/, '').trim();
}

const pendingGatewayRequests = new Map<string, PendingGatewayRequest>();

export {
  AssistantGatewayError,
  AssistantGatewayErrorCode,
  type SendAssistantTurnInput,
  type SendAssistantTurnOptions,
  type SendAssistantTurnProgress,
} from '@/services/assistant-gateway-types';

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

    if (__DEV__) {
      console.log('[assistant-gateway] TTS diagnostics:', {
        hasAudioB64: Boolean(response.assistant_audio_b64),
        audioB64Length: response.assistant_audio_b64?.length ?? 0,
        hasAudioUrl: Boolean(response.assistant_audio_url),
        audioMimeType: response.assistant_audio_mime_type ?? null,
        audioProviderUsed: response.audio_provider_used ?? null,
        ttsSkippedReason: response.tts_skipped_reason ?? null,
        ttsGenerationMs: response.tts_generation_ms ?? null,
        builtAudioPayload: audio
          ? {
              provider: audio.provider,
              mimeType: audio.mimeType,
              hasBase64: Boolean(audio.base64),
              hasUrl: Boolean(audio.url),
            }
          : null,
      });
    }

    const result: AssistantTurnResponse = {
      message: {
        id: response.turn_id ?? Date.now().toString(),
        role: 'assistant',
        content: stripTrailingSourcesBlock(response.assistant_text),
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
      modelUsed: response.model_used ?? getDefaultAssistantModel(),
      latencyMs: response.latency_ms ?? elapsed,
      toolCalls: response.tool_calls,
      memoryWrites: response.memory_writes,
      traceId: response.trace_id,
      routeDecision: response.route_decision ?? null,
      voiceLogAction: toVoiceLogAction(response.voice_log_action),
      sttTranscript: response.stt_transcript?.trim() || null,
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
