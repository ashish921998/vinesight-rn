/**
 * Main Request Handler
 * Orchestrates the complete AI gateway request flow.
 */

import {
  buildRouteClarificationCancelled,
  buildRouteClarificationPrompt,
  buildRouteClarificationRetry,
  buildVoiceLogCancelledMessage,
  buildVoiceLogClarificationMessage,
  buildVoiceLogClarifyExhaustedMessage,
  buildVoiceLogFormPrefill,
  buildVoiceLogOpeningFormMessage,
  decideChatRoute,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
  type ActivityLogExtractionResult,
  type HybridChatRoute,
  type VoiceLogDraft,
  type VoiceLogMissingField,
} from '../voice-routing.ts';

import {
  calculateCost,
  cleanExpiredCircuitBreakers,
  estimateTokens,
  generateTraceId,
  jsonResponse,
  resolveAuthenticatedUserId,
  trackTelemetry,
  writeConversationRouteState,
  writeConversationTurn,
} from '../utils/index.ts';

import {
  chatCompletionWithTimeout,
  generateEmbedding,
  generateSpeech,
  getAdvisoryModel,
} from '../providers/index.ts';

import {
  buildAttachmentContextBlocks,
  detectActivity,
  searchMemoryContext,
  searchRagContext,
  writeMemory,
  type ToolCall,
} from '../context/index.ts';

import {
  buildBlockedAdviceMessage,
  buildSafetyFlags,
  isSprayOrFertigationTopic,
  type SafetyFlags,
} from '../safety/index.ts';

import { buildDeterministicQueryIntent, extractActivityIntent } from '../routing/index.ts';

import { processStt, setupConversation } from './request-processor.ts';

import type {
  AssistantGatewayRequest,
  CostBreakdown,
  AssistantRouteState,
  VoiceLogActionPayload,
} from '../types.ts';

/**
 * Handle incoming AI gateway request
 */
export async function handleRequest(req: Request): Promise<Response> {
  const start = Date.now();
  const traceId = generateTraceId();

  cleanExpiredCircuitBreakers();

  try {
    let body: AssistantGatewayRequest;
    try {
      body = (await req.json()) as AssistantGatewayRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body' }, 400);
    }

    const authenticatedUserId = await resolveAuthenticatedUserId(req);
    const locale = body?.locale ?? 'en';
    const providerFallbackEnabled = body?.client_capabilities?.provider_fallback_enabled !== false;

    if (!authenticatedUserId) {
      return jsonResponse({ error: 'Authentication required for gateway operations' }, 401);
    }
    if (body?.user_id && body.user_id !== authenticatedUserId) {
      return jsonResponse({ error: 'user_id does not match authenticated user' }, 403);
    }

    const toolCalls: ToolCall[] = [];
    const embeddingTokenCounter = { value: 0 };
    let llmInputTokens = 0;
    let llmOutputTokens = 0;
    let preflightSafetyFlags: SafetyFlags | null = null;

    await trackTelemetry({
      event_name: 'ai_gateway_request_started',
      user_id: authenticatedUserId,
      farm_id: body?.farm_context?.farm_id ?? null,
      trace_id: traceId,
      properties: { input_mode: body?.input_mode, locale },
      timestamp: new Date().toISOString(),
    });

    // STT
    const sttResult = await processStt(body, locale, providerFallbackEnabled, toolCalls);
    if (sttResult.response) return sttResult.response;
    const {
      transcript,
      effectiveInputMode,
      sttProviderUsed,
      sttConfidence,
      providerFallbackReason,
    } = sttResult.result!;

    // Conversation setup
    const convSetup = await setupConversation(
      body,
      authenticatedUserId,
      effectiveInputMode,
      transcript,
      traceId,
    );
    const { farmId, userId, conversationId, farmsForRouting, contextFarmForRouting, routeState } =
      convSetup;

    if (body?.conversation_id && !conversationId) {
      return jsonResponse({ error: 'Conversation not found for authenticated user' }, 403);
    }

    // Route decision
    const nextRouteState: AssistantRouteState = { ...routeState };
    let routeStateDirty = false;
    let routeDecision: HybridChatRoute = 'fallback_llm';
    let voiceLogAction: VoiceLogActionPayload | null = null;
    let llmExtraction: ActivityLogExtractionResult | null = null;
    let effectiveTranscript = transcript;
    let forcedRoute: 'voice_log' | 'farm_query' | null = null;
    let assistantText = '';
    let citations: ReturnType<typeof searchMemoryContext> extends Promise<infer R>
      ? R['citations']
      : never = [];

    // Handle route clarification
    if (nextRouteState.route_clarification_pending) {
      const clarifiedRoute = resolveRouteClarificationResponse(transcript);
      if (!clarifiedRoute) {
        if (isRouteClarificationCancelResponse(transcript)) {
          nextRouteState.route_clarification_pending = false;
          routeStateDirty = true;
          routeDecision = 'clarify_route';
          assistantText = buildRouteClarificationCancelled(locale);
        } else {
          routeDecision = 'clarify_route';
          assistantText = buildRouteClarificationRetry(locale);
        }
      } else {
        forcedRoute = clarifiedRoute;
        routeDecision = clarifiedRoute;
        nextRouteState.route_clarification_pending = false;
        if (nextRouteState.pending_ambiguous_transcript) {
          effectiveTranscript = nextRouteState.pending_ambiguous_transcript;
        }
        routeStateDirty = true;
      }
    }

    const activity = detectActivity(effectiveTranscript);

    // Route decision
    if (!assistantText) {
      if (
        shouldAttemptVoiceLogExtraction(
          effectiveTranscript,
          Boolean(nextRouteState.voice_log_draft),
        )
      ) {
        llmExtraction = await extractActivityIntent({
          transcript: effectiveTranscript,
          locale,
          farmNames: farmsForRouting.map((f) => f.name),
          contextFarmName: contextFarmForRouting?.name ?? body?.farm_context?.farm_name ?? null,
        });
      }

      const deterministicQuery = buildDeterministicQueryIntent({
        transcript: effectiveTranscript,
        activity,
      });

      routeDecision =
        forcedRoute ??
        decideChatRoute({
          transcript: effectiveTranscript,
          hasActiveDraft: Boolean(nextRouteState.voice_log_draft),
          llmExtraction,
          deterministicQueryIntent: {
            category: deterministicQuery.category,
            queryType: deterministicQuery.category ? 'history' : null,
            timeRange: null,
            farmName: null,
            farmId: null,
            confidence: deterministicQuery.confidence,
            rawTranscript: effectiveTranscript,
          },
        });

      toolCalls.push({
        tool: 'routing.decide',
        status: 'ok',
        output: { route_decision: routeDecision },
      });

      // Handle routes
      if (routeDecision === 'clarify_route') {
        nextRouteState.route_clarification_pending = true;
        nextRouteState.pending_ambiguous_transcript = effectiveTranscript;
        routeStateDirty = true;
        assistantText = buildRouteClarificationPrompt(locale);
      } else if (routeDecision === 'voice_log') {
        const logTurn = resolveVoiceLogTurn({
          transcript: effectiveTranscript,
          farms: farmsForRouting,
          contextFarm: contextFarmForRouting,
          activeDraft: nextRouteState.voice_log_draft as VoiceLogDraft,
          originContext: farmId !== null ? 'farm' : 'dashboard',
          llmExtraction,
          expectedField: nextRouteState.voice_log_expected_field as VoiceLogMissingField,
        });

        if (logTurn.kind === 'cancelled') {
          nextRouteState.voice_log_draft = null;
          routeStateDirty = true;
          assistantText = buildVoiceLogCancelledMessage(locale);
          voiceLogAction = { kind: 'cancelled' };
        } else if (logTurn.kind === 'clarify') {
          const nextAttempts = nextRouteState.voice_log_clarify_attempts + 1;
          if (nextAttempts >= 3) {
            assistantText = buildVoiceLogClarifyExhaustedMessage(locale);
            voiceLogAction = {
              kind: 'ready',
              draft: logTurn.draft,
              prefill: buildVoiceLogFormPrefill(logTurn.draft),
            };
          } else {
            nextRouteState.voice_log_draft = logTurn.draft as unknown as Record<string, unknown>;
            nextRouteState.voice_log_clarify_attempts = nextAttempts;
            assistantText = buildVoiceLogClarificationMessage(locale, logTurn.missingFields);
            voiceLogAction = {
              kind: 'clarify',
              draft: logTurn.draft,
              missing_fields: logTurn.missingFields,
            };
          }
          routeStateDirty = true;
        } else if (logTurn.kind === 'ready') {
          nextRouteState.voice_log_draft = null;
          routeStateDirty = true;
          assistantText = buildVoiceLogOpeningFormMessage(locale, logTurn.draft);
          voiceLogAction = {
            kind: 'ready',
            draft: logTurn.draft,
            prefill: buildVoiceLogFormPrefill(logTurn.draft),
          };
        }
      }
    }

    if (routeStateDirty) {
      await writeConversationRouteState(
        conversationId,
        nextRouteState as unknown as Record<string, unknown>,
      );
    }

    // Advisory fallback
    if (!assistantText) {
      const memoryEnabled = body?.client_capabilities?.memory_enabled !== false;
      const ragEnabled = body?.client_capabilities?.rag_enabled !== false;
      let sharedQueryEmbedding: number[] | null | undefined = undefined;

      if ((memoryEnabled || ragEnabled) && effectiveTranscript.trim()) {
        embeddingTokenCounter.value += estimateTokens(effectiveTranscript);
        sharedQueryEmbedding = await generateEmbedding(effectiveTranscript);
      }

      const [memoryContext, ragContext] = await Promise.all([
        searchMemoryContext({
          query: effectiveTranscript,
          userId,
          farmId,
          enabled: memoryEnabled,
          embedding: sharedQueryEmbedding,
          embeddingTokenCounter,
          toolCalls,
        }),
        searchRagContext({
          query: effectiveTranscript,
          locale,
          enabled: ragEnabled,
          embedding: sharedQueryEmbedding,
          embeddingTokenCounter,
          toolCalls,
        }),
      ]);

      citations = [...memoryContext.citations, ...ragContext.citations];
      const strictGuardrailsPreflight = isSprayOrFertigationTopic(effectiveTranscript);

      if (strictGuardrailsPreflight && citations.length === 0) {
        assistantText = buildBlockedAdviceMessage(locale, true);
        preflightSafetyFlags = {
          blocked: true,
          risk_level: 'critical',
          reasons: ['Spray/fertigation advice requires verified sources'],
          escalation_suggested: true,
        };
      } else {
        const farmContextBlock = body?.farm_context
          ? `Farm context: ${JSON.stringify(body.farm_context)}`
          : '';
        const attachmentContextBlocks = buildAttachmentContextBlocks(body?.attachments);
        const chatResult = await chatCompletionWithTimeout({
          prompt: effectiveTranscript,
          locale,
          contextBlocks: [
            farmContextBlock,
            ...attachmentContextBlocks,
            ...memoryContext.contextBlocks,
            ...ragContext.contextBlocks,
          ].filter(Boolean),
        });
        assistantText = chatResult.text;
        llmInputTokens = chatResult.inputTokens;
        llmOutputTokens = chatResult.outputTokens;
      }
    }

    // Safety
    const safetyFlags: SafetyFlags =
      preflightSafetyFlags ??
      buildSafetyFlags({
        adviceText: assistantText,
        transcript: effectiveTranscript,
        routeDecision,
        citationCount: citations.length,
      });
    toolCalls.push({ tool: 'safety.check_advice', status: 'ok', output: safetyFlags });
    if (safetyFlags.blocked)
      assistantText = buildBlockedAdviceMessage(
        locale,
        isSprayOrFertigationTopic(effectiveTranscript),
      );

    // TTS
    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;
    let audioProviderUsed: string | null = null;

    if (body?.client_capabilities?.can_play_audio !== false) {
      const ttsResult = await generateSpeech({
        text: assistantText,
        locale,
        providerFallbackEnabled,
        canPlayAudio: true,
      });
      if (ttsResult) {
        audioBase64 = ttsResult.base64;
        audioMimeType = ttsResult.mimeType;
        audioProviderUsed = ttsResult.provider;
      }
    }

    // Memory write
    const memoryWrites = await writeMemory({
      conversationId,
      userId,
      farmId,
      transcript: effectiveTranscript,
      answer: assistantText,
      enabled: body?.client_capabilities?.memory_enabled !== false && !safetyFlags.blocked,
      embeddingTokenCounter,
      toolCalls,
    });

    // Response
    const latency = Date.now() - start;
    const costBreakdown: CostBreakdown = calculateCost({
      sttProviderUsed,
      audioDurationSeconds: body?.audio_duration ?? 0,
      inputTokens: llmInputTokens,
      outputTokens: llmOutputTokens,
      embeddingTokens: embeddingTokenCounter.value,
      ttsProviderUsed: audioProviderUsed,
      ttsCharCount: assistantText.length,
    });

    const assistantTurnId = await writeConversationTurn({
      conversationId,
      userId,
      farmId,
      role: 'assistant',
      content: assistantText,
      inputMode: 'text',
      traceId,
      latencyMs: latency,
      provider: audioProviderUsed ?? 'openai',
      model: getAdvisoryModel(),
      citations,
      toolCalls,
      safetyFlags,
    });

    return jsonResponse({
      assistant_text: assistantText,
      assistant_audio_b64: audioBase64,
      assistant_audio_mime_type: audioMimeType,
      audio_provider_used: audioProviderUsed,
      stt_provider_used: sttProviderUsed,
      stt_confidence: sttConfidence,
      cost_breakdown: costBreakdown,
      route_decision: routeDecision,
      voice_log_action: voiceLogAction,
      provider_fallback_reason: providerFallbackReason,
      model_used: getAdvisoryModel(),
      tool_calls: toolCalls.map((t) => ({ tool: t.tool, status: t.status })),
      tool_results: toolCalls.map((t) => ({ tool: t.tool, status: t.status })),
      memory_writes: memoryWrites,
      citations,
      safety_flags: safetyFlags,
      trace_id: traceId,
      latency_ms: latency,
      conversation_id: conversationId,
      turn_id: assistantTurnId,
      suggestions: [],
    });
  } catch (error) {
    console.error('ai-gateway error', { traceId, error });
    return jsonResponse({ error: 'Internal server error', trace_id: traceId }, 500);
  }
}
