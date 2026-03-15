/**
 * Voice Log Handler Module
 * Handles simplified activity logging flow (extract → clarify → ready).
 * Returns prefill data for client confirmation - does NOT write to DB.
 */

import {
  buildVoiceLogCancelledMessage,
  buildVoiceLogClarificationMessage,
  buildVoiceLogClarifyExhaustedMessage,
  buildVoiceLogFormPrefill,
  buildVoiceLogNoFarmsMessage,
  buildVoiceLogOpeningFormMessage,
  getVoiceLogMissingFields,
  resolveVoiceLogTurn,
  type ActivityLogExtractionResult,
  type Farm,
  type VoiceLogDraft,
  type VoiceLogMissingField,
  type VoiceLogOriginContext,
  type VoiceLogTurnResult,
} from '../routing/index.ts';

// Re-export types for convenience
export type {
  VoiceLogDraft,
  VoiceLogActivityType,
  VoiceLogMissingField,
  VoiceLogOriginContext,
} from '../routing/index.ts';

export interface VoiceLogActionPayload {
  kind: 'none' | 'cancelled' | 'clarify' | 'ready';
  draft?: VoiceLogDraft | null;
  prefill?: Record<string, unknown> | null;
  missing_fields?: string[];
  expected_field?: string | null;
  clarify_attempts?: number;
  clarify_exhausted?: boolean;
}

export interface VoiceLogHandlerInput {
  transcript: string;
  farms: Array<{ id: number; name: string }>;
  contextFarm: { id: number; name: string } | null;
  activeDraft: VoiceLogDraft | null;
  expectedField: VoiceLogMissingField | null;
  clarifyAttempts: number;
  llmExtraction: ActivityLogExtractionResult | null;
  locale: 'en' | 'hi' | 'mr';
  originContext: VoiceLogOriginContext;
}

export interface VoiceLogHandlerResult {
  assistantText: string;
  voiceLogAction: VoiceLogActionPayload | null;
  routeStateDirty: boolean;
  nextDraft?: VoiceLogDraft | null;
  nextExpectedField?: VoiceLogMissingField | null;
  nextClarifyAttempts?: number;
}

/**
 * Handle voice log flow
 * Processes user input for activity logging, returns prefill data for client confirmation.
 * Does NOT write to database - that's done by the client after user confirms.
 */
export function handleVoiceLog(input: VoiceLogHandlerInput): VoiceLogHandlerResult {
  const {
    transcript,
    farms,
    contextFarm,
    activeDraft,
    expectedField,
    clarifyAttempts,
    llmExtraction,
    locale,
    originContext,
  } = input;

  // Use the routing module to resolve the turn
  const turnResult: VoiceLogTurnResult = resolveVoiceLogTurn({
    transcript,
    farms: farms as Farm[],
    contextFarm: contextFarm as Farm | null,
    activeDraft,
    originContext,
    llmExtraction,
    expectedField,
  });

  // Handle each turn result kind
  if (turnResult.kind === 'none') {
    return {
      assistantText: '',
      voiceLogAction: null,
      routeStateDirty: false,
    };
  }

  if (turnResult.kind === 'cancelled') {
    return {
      assistantText: buildVoiceLogCancelledMessage(locale),
      voiceLogAction: { kind: 'cancelled' },
      routeStateDirty: true,
      nextDraft: null,
      nextExpectedField: null,
      nextClarifyAttempts: 0,
    };
  }

  if (turnResult.kind === 'clarify') {
    // Reset counter if user made progress (fewer missing fields than before)
    const prevMissingCount = activeDraft ? getVoiceLogMissingFields(activeDraft).length : Infinity;
    const madeProgress = turnResult.missingFields.length < prevMissingCount;
    const nextAttempts = madeProgress ? 0 : clarifyAttempts + 1;

    // Check if we've exhausted clarification attempts
    if (nextAttempts >= 3) {
      return {
        assistantText: buildVoiceLogClarifyExhaustedMessage(locale),
        voiceLogAction: {
          kind: 'ready',
          draft: turnResult.draft,
          prefill: buildVoiceLogFormPrefill(turnResult.draft),
        },
        routeStateDirty: true,
        nextDraft: null,
        nextExpectedField: null,
        nextClarifyAttempts: 0,
      };
    }

    // Check if user needs to select a farm but has no farms available
    const needsFarm = turnResult.missingFields.includes('farm');
    if (needsFarm && farms.length === 0) {
      return {
        assistantText: buildVoiceLogNoFarmsMessage(locale),
        voiceLogAction: { kind: 'none' },
        routeStateDirty: true,
        nextDraft: null,
        nextExpectedField: null,
        nextClarifyAttempts: 0,
      };
    }

    // Continue clarification
    return {
      assistantText: buildVoiceLogClarificationMessage(locale, turnResult.missingFields),
      voiceLogAction: {
        kind: 'clarify',
        draft: turnResult.draft,
        missing_fields: turnResult.missingFields,
      },
      routeStateDirty: true,
      nextDraft: turnResult.draft,
      nextExpectedField: turnResult.missingFields[0] ?? null,
      nextClarifyAttempts: nextAttempts,
    };
  }

  // turnResult.kind === 'ready'
  return {
    assistantText: buildVoiceLogOpeningFormMessage(locale, turnResult.draft),
    voiceLogAction: {
      kind: 'ready',
      draft: turnResult.draft,
      prefill: buildVoiceLogFormPrefill(turnResult.draft),
    },
    routeStateDirty: true,
    nextDraft: null,
    nextExpectedField: null,
    nextClarifyAttempts: 0,
  };
}
