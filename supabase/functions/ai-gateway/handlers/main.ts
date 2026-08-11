/**
 * Main Request Handler
 * Orchestrates the complete AI gateway request flow.
 * Dispatches to dedicated handler modules based on route decision.
 */

import {
  buildDeterministicQueryIntent,
  decideChatRoute,
  extractActivityIntent,
  shouldAttemptVoiceLogExtraction,
  type ActivityLogExtractionResult,
  type HybridChatRoute,
  type VoiceLogDraft,
  type VoiceLogMissingField,
} from '../routing/index.ts';

import {
  calculateCost,
  cleanExpiredCircuitBreakers,
  detectLocaleFromText,
  generateTraceId,
  jsonResponse,
  resolveAuthenticatedUserId,
  resolveLocaleFromBcp47,
  resolveEffectiveAssistantLocale,
  resolveLocale,
  resolveTtsLocale,
  trackTelemetry,
  writeConversationRouteState,
  writeConversationTurn,
} from '../utils/index.ts';

import { generateSpeech, getAdvisoryModel } from '../providers/index.ts';

import { detectActivity, writeMemory, type Citation, type ToolCall } from '../context/index.ts';

import {
  buildBlockedAdviceMessage,
  buildSafetyFlags,
  isSprayOrFertigationTopic,
  type SafetyFlags,
} from '../safety/index.ts';

import { processStt, setupConversation } from './request-processor.ts';
import { handleAdvisory } from './advisory.ts';
import { handleFarmQuery } from './farm-query.ts';
import { handleVoiceLog } from './voice-log.ts';
import { handleClarify, buildClarificationPrompt } from './clarify.ts';

import type {
  AssistantGatewayRequest,
  CostBreakdown,
  AssistantRouteState,
  VoiceLogActionPayload,
  AssistantMessageCardPayload,
  AssistantMessageActionPayload,
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
    const locale = resolveLocale(body?.locale);
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

    // Track STT timing
    let sttLatencyMs: number | null = null;

    await trackTelemetry({
      event_name: 'ai_gateway_request_started',
      user_id: authenticatedUserId,
      farm_id: body?.farm_context?.farm_id ?? null,
      trace_id: traceId,
      properties: { input_mode: body?.input_mode, locale },
      timestamp: new Date().toISOString(),
    });

    // STT
    const sttStart = Date.now();
    const sttResult = await processStt(body, locale, providerFallbackEnabled, toolCalls);
    if (sttResult.response) return sttResult.response;
    const {
      transcript,
      effectiveInputMode,
      sttProviderUsed,
      sttConfidence,
      providerFallbackReason,
      detectedLanguage,
    } = sttResult.result!;
    if (sttProviderUsed) {
      sttLatencyMs = Date.now() - sttStart;
    }

    // Conversation setup (needed before effectiveLocale to access persisted detected_locale)
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

    if (!conversationId) {
      console.error('[ai-gateway] Failed to resolve or create conversationId; aborting request', {
        traceId,
        bodyConversationId: body?.conversation_id ?? null,
        userId: authenticatedUserId,
      });
      return jsonResponse({ error: 'Could not create conversation' }, 500);
    }

    // For voice input, prefer detected language from STT over app locale.
    // For text follow-ups in a multi-turn flow, restore the persisted detected_locale.
    const sttDetectedLocale =
      effectiveInputMode === 'audio' ? resolveLocaleFromBcp47(detectedLanguage) : null;
    const effectiveLocale: 'en' | 'hi' | 'mr' = resolveEffectiveAssistantLocale({
      inputMode: effectiveInputMode,
      detectedLanguage,
      routeStateDetectedLocale: routeState.detected_locale,
      locale,
      transcript,
    });

    // Route decision
    const nextRouteState: AssistantRouteState = { ...routeState };
    let routeStateDirty = false;

    // On audio turns, sync persisted detected_locale with current STT result.
    // When STT didn't return a language code,
    // use text-based Devanagari detection so the locale signal isn't lost.
    const detectedLocaleForPersistence: 'en' | 'hi' | 'mr' | null =
      sttDetectedLocale ?? detectLocaleFromText(transcript);
    // Only update locale when STT actually returned a language code, or when
    // there's no existing persisted locale to preserve (prevents 'hi' fallback
    // from overwriting a valid 'mr' that STT failed to detect).
    const shouldUpdateLocale =
      effectiveInputMode === 'audio' &&
      (sttDetectedLocale != null || routeState.detected_locale == null) &&
      detectedLocaleForPersistence !== null &&
      detectedLocaleForPersistence !== routeState.detected_locale;
    if (shouldUpdateLocale) {
      nextRouteState.detected_locale = detectedLocaleForPersistence;
      routeStateDirty = true;
    }
    let routeDecision: HybridChatRoute = 'fallback_llm';
    let voiceLogAction: VoiceLogActionPayload | null = null;
    let llmExtraction: ActivityLogExtractionResult | null = null;
    let effectiveTranscript = transcript;
    let forcedRoute: 'voice_log' | 'farm_query' | null = null;
    let assistantText = '';
    let citations: Citation[] = [];
    let safetyFlags: SafetyFlags | null = null;
    let blocked = false;
    let cards: AssistantMessageCardPayload[] = [];
    let actions: AssistantMessageActionPayload[] = [];

    // Handle route clarification using clarify handler
    if (nextRouteState.route_clarification_pending) {
      const clarifyResult = handleClarify({ transcript, locale: effectiveLocale });
      if (clarifyResult.resolvedRoute) {
        forcedRoute = clarifyResult.resolvedRoute;
        routeDecision = clarifyResult.resolvedRoute;
        nextRouteState.route_clarification_pending = false;
        if (nextRouteState.pending_ambiguous_transcript) {
          effectiveTranscript = nextRouteState.pending_ambiguous_transcript;
        }
        nextRouteState.pending_ambiguous_transcript = null;
        routeStateDirty = true;
        if (clarifyResult.cards) cards = clarifyResult.cards as AssistantMessageCardPayload[];
        if (clarifyResult.actions)
          actions = clarifyResult.actions as AssistantMessageActionPayload[];
      } else if (clarifyResult.cancelled) {
        nextRouteState.route_clarification_pending = false;
        nextRouteState.pending_ambiguous_transcript = null;
        routeStateDirty = true;
        routeDecision = 'clarify_route';
        assistantText = clarifyResult.assistantText;
        if (clarifyResult.cards) cards = clarifyResult.cards as AssistantMessageCardPayload[];
        if (clarifyResult.actions)
          actions = clarifyResult.actions as AssistantMessageActionPayload[];
      } else {
        routeDecision = 'clarify_route';
        assistantText = clarifyResult.assistantText;
        if (clarifyResult.cards) cards = clarifyResult.cards as AssistantMessageCardPayload[];
        if (clarifyResult.actions)
          actions = clarifyResult.actions as AssistantMessageActionPayload[];
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
          locale: effectiveLocale,
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

      // Dispatch to handler modules based on route decision
      if (routeDecision === 'clarify_route') {
        nextRouteState.route_clarification_pending = true;
        nextRouteState.pending_ambiguous_transcript = effectiveTranscript;
        routeStateDirty = true;
        assistantText = buildClarificationPrompt(effectiveLocale);
      } else if (routeDecision === 'voice_log') {
        // Use voice-log handler
        const voiceLogResult = handleVoiceLog({
          transcript: effectiveTranscript,
          farms: farmsForRouting,
          contextFarm: contextFarmForRouting,
          activeDraft: nextRouteState.voice_log_draft as VoiceLogDraft,
          expectedField: nextRouteState.voice_log_expected_field as VoiceLogMissingField,
          clarifyAttempts: nextRouteState.voice_log_clarify_attempts,
          llmExtraction,
          locale: effectiveLocale,
          originContext: farmId !== null ? 'farm' : 'dashboard',
        });

        // When voice-log resolves to 'none' (no action), fall through to advisory
        // so the user gets a meaningful response instead of an empty assistant_text.
        if (!voiceLogResult.assistantText) {
          routeDecision = 'fallback_llm';
          if (nextRouteState.voice_log_draft) {
            nextRouteState.voice_log_draft = null;
            nextRouteState.voice_log_expected_field = null;
            nextRouteState.voice_log_clarify_attempts = 0;
            routeStateDirty = true;
          }
        } else {
          assistantText = voiceLogResult.assistantText;
          voiceLogAction = voiceLogResult.voiceLogAction;
          routeStateDirty = routeStateDirty || voiceLogResult.routeStateDirty;
          if (voiceLogResult.nextDraft !== undefined) {
            nextRouteState.voice_log_draft = voiceLogResult.nextDraft as unknown as Record<
              string,
              unknown
            >;
          }
          if (voiceLogResult.nextExpectedField !== undefined) {
            nextRouteState.voice_log_expected_field = voiceLogResult.nextExpectedField;
          }
          if (voiceLogResult.nextClarifyAttempts !== undefined) {
            nextRouteState.voice_log_clarify_attempts = voiceLogResult.nextClarifyAttempts;
          }
          if (voiceLogResult.cards) cards = voiceLogResult.cards as AssistantMessageCardPayload[];
          if (voiceLogResult.actions)
            actions = voiceLogResult.actions as AssistantMessageActionPayload[];
        }
      }

      if (routeDecision === 'farm_query') {
        // Use farm-query handler
        const farmQueryResult = await handleFarmQuery({
          transcript: effectiveTranscript,
          userId,
          farmId,
          locale: effectiveLocale,
          toolCalls,
        });
        assistantText = farmQueryResult.assistantText;
        citations = farmQueryResult.citations;
        routeDecision = 'farm_query';
        if (farmQueryResult.cards) cards = farmQueryResult.cards as AssistantMessageCardPayload[];
        if (farmQueryResult.actions)
          actions = farmQueryResult.actions as AssistantMessageActionPayload[];
      } else if (routeDecision === 'advisory' || routeDecision === 'fallback_llm') {
        // Use advisory handler
        const advisoryResult = await handleAdvisory({
          transcript: effectiveTranscript,
          farmContext: body?.farm_context ?? null,
          attachments: body?.attachments,
          userId,
          farmId,
          locale: effectiveLocale,
          memoryEnabled: body?.client_capabilities?.memory_enabled !== false,
          ragEnabled: body?.client_capabilities?.rag_enabled !== false,
          embeddingTokenCounter,
          toolCalls,
        });
        assistantText = advisoryResult.assistantText;
        citations = advisoryResult.citations;
        safetyFlags = advisoryResult.safetyFlags;
        llmInputTokens = advisoryResult.inputTokens;
        llmOutputTokens = advisoryResult.outputTokens;
        blocked = advisoryResult.blocked;
        if (advisoryResult.cards) cards = advisoryResult.cards as AssistantMessageCardPayload[];
        if (advisoryResult.actions)
          actions = advisoryResult.actions as AssistantMessageActionPayload[];
      }
    }

    if (routeStateDirty) {
      await writeConversationRouteState(
        conversationId,
        nextRouteState as unknown as Record<string, unknown>,
      );
    }

    // Only advisory/fallback LLM responses should go through the advisory safety checker.
    // Clarification, voice-log, and deterministic farm-query responses are control-flow text,
    // not agronomy advice, and can be falsely blocked by spray/fertigation guardrails.
    if (!safetyFlags && (routeDecision === 'advisory' || routeDecision === 'fallback_llm')) {
      safetyFlags = buildSafetyFlags({
        adviceText: assistantText,
        transcript: effectiveTranscript,
        routeDecision,
        citationCount: citations.length,
      });
      toolCalls.push({ tool: 'safety.check_advice', status: 'ok', output: safetyFlags });
    } else if (!safetyFlags) {
      safetyFlags = {
        blocked: false,
        risk_level: 'low',
        reasons: [],
        escalation_suggested: false,
      };
    }
    if (safetyFlags.blocked && !blocked) {
      assistantText = buildBlockedAdviceMessage(
        effectiveLocale,
        isSprayOrFertigationTopic(effectiveTranscript),
      );
    }

    // TTS
    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;
    let audioProviderUsed: string | null = null;
    let ttsGenerationMs: number | null = null;
    let ttsSkippedReason: string | null = null;

    // Compute TTS locale unconditionally (used in response even when audio is skipped)
    const ttsLocale = resolveTtsLocale(assistantText, effectiveLocale, sttDetectedLocale);

    if (body?.client_capabilities?.can_play_audio !== false) {
      if (ttsLocale !== effectiveLocale) {
        console.log(
          `[ai-gateway] TTS locale override: ${effectiveLocale} → ${ttsLocale} (text script mismatch)`,
        );
      }
      const ttsStart = Date.now();
      const ttsResult = await generateSpeech({
        text: assistantText,
        locale: ttsLocale,
        providerFallbackEnabled,
        canPlayAudio: true,
      });
      if (ttsResult) {
        audioBase64 = ttsResult.base64;
        audioMimeType = ttsResult.mimeType;
        audioProviderUsed = ttsResult.provider;
        ttsGenerationMs = Date.now() - ttsStart;
      } else {
        ttsSkippedReason = 'tts_failed';
      }
    } else {
      ttsSkippedReason = 'can_play_audio_false';
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
      provider: audioProviderUsed ?? 'sarvam',
      model: getAdvisoryModel(),
      citations,
      toolCalls,
      safetyFlags,
    });

    return jsonResponse({
      assistant_text: assistantText,
      user_transcript: effectiveInputMode === 'audio' ? transcript : null,
      assistant_audio_b64: audioBase64,
      assistant_audio_mime_type: audioMimeType,
      audio_provider_used: audioProviderUsed,
      stt_provider_used: sttProviderUsed,
      stt_confidence: sttConfidence,
      stt_latency_ms: sttLatencyMs,
      tts_generation_ms: ttsGenerationMs,
      tts_skipped_reason: ttsSkippedReason,
      effective_locale: effectiveLocale,
      tts_locale: ttsLocale,
      cost_breakdown: costBreakdown,
      route_decision: routeDecision,
      voice_log_action: voiceLogAction,
      provider_fallback_reason: providerFallbackReason,
      model_used: getAdvisoryModel(),
      tool_calls: toolCalls.map((t) => ({ tool: t.tool, status: t.status })),
      tool_results: toolCalls.map((t) => ({ tool: t.tool, status: t.status, output: t.output })),
      memory_writes: memoryWrites,
      citations,
      safety_flags: safetyFlags,
      trace_id: traceId,
      latency_ms: latency,
      conversation_id: conversationId,
      turn_id: assistantTurnId,
      suggestions: [],
      cards,
      actions,
    });
  } catch (error) {
    console.error('ai-gateway error', { traceId, error });
    return jsonResponse({ error: 'Internal server error', trace_id: traceId }, 500);
  }
}
