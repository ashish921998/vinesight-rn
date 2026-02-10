/**
 * Voice Assistant Types
 * Types for the ReadOnly Farm Assistant query pipeline
 */

// ============================================================
// MARK: - Intent Types
// ============================================================

export type IntentCategory = 'spray' | 'irrigation' | 'fertigation' | 'expense';

export type QueryType = 'history' | 'total' | 'last';

export interface QueryIntent {
  category: IntentCategory | null;
  queryType: QueryType;
  timeRange: { start: Date; end: Date } | null;
  farmName: string | null;
  farmId: number | null;
  confidence: number;
  rawTranscript: string;
}

// ============================================================
// MARK: - Answer Types
// ============================================================

export interface AssistantAnswerRow {
  date: string;
  primary: string;
  secondary?: string;
  farmName: string;
}

export interface AssistantAnswer {
  category: IntentCategory;
  queryType: QueryType;
  summary: {
    label: string;
    value: string | number;
    unit?: string;
  };
  rows: AssistantAnswerRow[];
  timeRange: { start: Date; end: Date };
  farmFilter: string | null;
  totalRecordCount: number;
  verbalizedText?: string;
}

// ============================================================
// MARK: - Clarification & Unsupported
// ============================================================

export interface ClarificationPrompt {
  question: string;
  options: string[];
}

export interface UnsupportedIntentResponse {
  type: 'close_but_unsupported';
  message: string;
  suggestion: string;
}

// ============================================================
// MARK: - Status
// ============================================================

export type FarmAssistantStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'fetching'
  | 'answered'
  | 'clarifying'
  | 'error';
