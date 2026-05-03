/**
 * Clarify Handler Module
 * Handles route clarification when user intent is ambiguous.
 */

import {
  buildRouteClarificationCancelled,
  buildRouteClarificationPrompt,
  buildRouteClarificationRetry,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  type HybridChatRoute,
} from '../routing/index.ts';

export interface ClarifyHandlerResult {
  assistantText: string;
  resolvedRoute: Exclude<HybridChatRoute, 'advisory' | 'clarify_route' | 'fallback_llm'> | null;
  cancelled: boolean;
  routeStateDirty: boolean;
  /** Structured cards rendered inline within the assistant bubble */
  cards?: Array<Record<string, unknown>>;
  /** Action buttons rendered below the assistant bubble */
  actions?: Array<Record<string, unknown>>;
}

/**
 * Handle route clarification flow
 */
export function handleClarify(input: {
  transcript: string;
  locale: 'en' | 'hi' | 'mr';
}): ClarifyHandlerResult {
  const { transcript, locale } = input;

  const clarifiedRoute = resolveRouteClarificationResponse(transcript);

  if (!clarifiedRoute) {
    if (isRouteClarificationCancelResponse(transcript)) {
      return {
        assistantText: buildRouteClarificationCancelled(locale),
        resolvedRoute: null,
        cancelled: true,
        routeStateDirty: true,
      };
    }
    return {
      assistantText: buildRouteClarificationRetry(locale),
      resolvedRoute: null,
      cancelled: false,
      routeStateDirty: false,
    };
  }

  return {
    assistantText: '',
    resolvedRoute: clarifiedRoute,
    cancelled: false,
    routeStateDirty: true,
  };
}

/**
 * Build clarification prompt
 */
export function buildClarificationPrompt(locale: 'en' | 'hi' | 'mr'): string {
  return buildRouteClarificationPrompt(locale);
}
