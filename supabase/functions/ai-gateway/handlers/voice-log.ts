/**
 * Voice Log Handler Module
 * Handles simplified activity logging flow (extract → clarify → ready).
 */

// Types re-exported from voice-routing

// Types re-exported from voice-routing
export interface VoiceLogDraft {
  type: 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';
  farmId: number | null;
  farmName: string | null;
  date: string;
  irrigation: { durationHours: number | null };
  spray: {
    waterVolume: number | null;
    chemicals: Array<{ name: string; quantity: number | null; unit: string | null }>;
  };
  harvest: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense: { cost: number | null; expenseType: string | null; remarks: string | null };
  fertigation: {
    waterVolume: number | null;
    fertilizers: Array<{ name: string; quantity: number | null; unit: string | null }>;
  };
}

export interface VoiceLogActionPayload {
  kind: 'none' | 'cancelled' | 'clarify' | 'ready';
  draft?: VoiceLogDraft | null;
  prefill?: Record<string, unknown> | null;
  missing_fields?: string[];
  expected_field?: string | null;
  clarify_attempts?: number;
  clarify_exhausted?: boolean;
}

export interface VoiceLogHandlerResult {
  assistantText: string;
  voiceLogAction: VoiceLogActionPayload | null;
  routeStateDirty: boolean;
}

/**
 * Handle voice log flow
 * This handler is a thin wrapper around the voice-routing module.
 * The actual logic is in voice-routing.ts for backward compatibility.
 */
export function handleVoiceLog(_input: {
  transcript: string;
  farms: Array<{ id: number; name: string }>;
  contextFarm: { id: number; name: string } | null;
  activeDraft: VoiceLogDraft | null;
  expectedField: string | null;
  clarifyAttempts: number;
  llmExtraction: unknown;
  locale: 'en' | 'hi' | 'mr';
  originContext: 'dashboard' | 'farm';
}): VoiceLogHandlerResult {
  // This is a placeholder - actual logic is in voice-routing.ts
  // The main entry point will call resolveVoiceLogTurn from voice-routing directly
  return {
    assistantText: '',
    voiceLogAction: null,
    routeStateDirty: false,
  };
}
