/**
 * Advisory Handler Module
 * Handles the main LLM advisory flow with context assembly.
 */

import { assembleContext, type Citation, type ToolCall } from '../context/index.ts';
import { chatCompletionWithTimeout } from '../providers/index.ts';
import {
  buildSafetyFlags,
  isSprayOrFertigationTopic,
  buildBlockedAdviceMessage,
  type SafetyFlags,
} from '../safety/index.ts';
import type { HybridChatRoute } from '../routing/index.ts';

export interface AdvisoryHandlerInput {
  transcript: string;
  farmContext: Record<string, unknown> | null;
  attachments?: Array<{
    kind: 'image' | 'document';
    name: string;
    mimeType?: string;
    dataUrl?: string;
    textContent?: string;
    sourceUri?: string;
  }>;
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  memoryEnabled: boolean;
  ragEnabled: boolean;
  embeddingTokenCounter: { value: number };
  toolCalls: ToolCall[];
}

export interface AdvisoryHandlerResult {
  assistantText: string;
  citations: Citation[];
  safetyFlags: SafetyFlags;
  inputTokens: number;
  outputTokens: number;
  blocked: boolean;
  /** Structured cards rendered inline within the assistant bubble */
  cards?: Array<Record<string, unknown>>;
  /** Action buttons rendered below the assistant bubble */
  actions?: Array<Record<string, unknown>>;
}

/**
 * Handle advisory flow with context assembly and LLM
 */
export async function handleAdvisory(input: AdvisoryHandlerInput): Promise<AdvisoryHandlerResult> {
  const {
    transcript,
    farmContext,
    attachments,
    userId,
    farmId,
    locale,
    memoryEnabled,
    ragEnabled,
    embeddingTokenCounter,
    toolCalls,
  } = input;

  // Assemble context
  const { contextBlocks, imageAttachments, citations } = await assembleContext({
    transcript,
    farmContext,
    attachments,
    userId,
    farmId,
    locale,
    memoryEnabled,
    ragEnabled,
    embeddingTokenCounter,
    toolCalls,
  });

  // Preflight safety check for spray/fertigation without citations
  const strictGuardrailsPreflight = isSprayOrFertigationTopic(transcript);
  let assistantText = '';
  let blocked = false;
  let preflightSafetyFlags: SafetyFlags | null = null;

  if (strictGuardrailsPreflight && citations.length === 0) {
    console.warn('Blocking spray/fertigation query with no citations');
    assistantText = buildBlockedAdviceMessage(locale, true);
    preflightSafetyFlags = {
      blocked: true,
      risk_level: 'critical',
      reasons: ['Spray/fertigation advice requires verified sources'],
      escalation_suggested: true,
    };
    blocked = true;
  } else {
    // Call LLM for advisory response
    const chatResult = await chatCompletionWithTimeout({
      prompt: transcript,
      locale,
      contextBlocks,
      imageAttachments,
    });
    assistantText = chatResult.text;
    const inputTokens = chatResult.inputTokens;
    const outputTokens = chatResult.outputTokens;

    // Build safety flags
    const safetyFlags = buildSafetyFlags({
      adviceText: assistantText,
      transcript,
      routeDecision: 'advisory' as HybridChatRoute,
      citationCount: citations.length,
    });

    toolCalls.push({
      tool: 'safety.check_advice',
      status: 'ok',
      output: safetyFlags,
    });

    if (safetyFlags.blocked) {
      assistantText = buildBlockedAdviceMessage(locale, strictGuardrailsPreflight);
      blocked = true;
    }

    return {
      assistantText,
      citations,
      safetyFlags: preflightSafetyFlags ?? safetyFlags,
      inputTokens,
      outputTokens,
      blocked,
    };
  }

  // Return blocked result
  toolCalls.push({
    tool: 'safety.check_advice',
    status: 'ok',
    output: preflightSafetyFlags!,
  });

  return {
    assistantText,
    citations,
    safetyFlags: preflightSafetyFlags!,
    inputTokens: 0,
    outputTokens: 0,
    blocked,
  };
}
