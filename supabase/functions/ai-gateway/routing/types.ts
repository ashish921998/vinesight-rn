/**
 * Routing Types Module
 * All shared TypeScript type definitions for the routing system.
 */

// ============================================================
// MARK: - Route Types
// ============================================================

export type HybridChatRoute =
  | 'voice_log'
  | 'farm_query'
  | 'advisory'
  | 'clarify_route'
  | 'fallback_llm';

// ============================================================
// MARK: - Voice Log Types
// ============================================================

export type VoiceLogActivityType = 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';

export type VoiceLogOriginContext = 'dashboard' | 'farm';

export type VoiceLogMissingField =
  | 'farm'
  | 'duration'
  | 'waterVolume'
  | 'chemicals'
  | 'quantity'
  | 'grade'
  | 'cost'
  | 'expenseType'
  | 'fertilizers';

export interface Farm {
  id?: number | null;
  name: string;
}

export interface VoiceLogChemicalItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface VoiceLogFertilizerItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface VoiceLogDraft {
  type: VoiceLogActivityType;
  farmId: number | null;
  farmName: string | null;
  date: string;
  irrigation: { durationHours: number | null };
  spray: { waterVolume: number | null; chemicals: VoiceLogChemicalItem[] };
  harvest: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense: { cost: number | null; expenseType: string | null; remarks: string | null };
  fertigation: { waterVolume: number | null; fertilizers: VoiceLogFertilizerItem[] };
}

export interface VoiceLogFormPrefill {
  type: VoiceLogActivityType;
  date: string;
  irrigation?: { durationHours: number | null };
  spray?: { waterVolume: number | null; chemicals: VoiceLogChemicalItem[] };
  harvest?: {
    quantity: number | null;
    grade: string | null;
    price: number | null;
    buyer: string | null;
  };
  expense?: { cost: number | null; expenseType: string | null; remarks: string | null };
  fertigation?: { waterVolume: number | null; fertilizers: VoiceLogFertilizerItem[] };
}

export type VoiceLogTurnResult =
  | { kind: 'none' }
  | { kind: 'cancelled' }
  | { kind: 'clarify'; draft: VoiceLogDraft; missingFields: VoiceLogMissingField[] }
  | { kind: 'ready'; draft: VoiceLogDraft };

// ============================================================
// MARK: - Query Intent Types
// ============================================================

export interface QueryIntent {
  category: string | null;
  queryType: string | null;
  timeRange: unknown;
  farmName: string | null;
  farmId: number | null;
  confidence: number;
  rawTranscript: string;
}
