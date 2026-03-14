/**
 * AI Chat Types for Vinesight
 * Chat interface for farming AI assistant
 */

import type { VoiceLogDraft, VoiceLogFormPrefill, VoiceLogMissingField } from './voice-log';

export type AssistantInputMode = 'text' | 'audio';

export interface AssistantAudio {
  provider?: 'sarvam' | 'openai' | 'local_fallback' | string;
  mimeType?: string | null;
  base64?: string | null;
  url?: string | null;
  durationMs?: number | null;
}

export interface AssistantCitation {
  id?: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external' | string;
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssistantSafetyMeta {
  blocked: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  escalationSuggested?: boolean;
}

export interface AssistantToolEvent {
  tool: string;
  status: 'ok' | 'error' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

export type AssistantRouteDecision =
  | 'voice_log'
  | 'farm_query'
  | 'advisory'
  | 'clarify_route'
  | 'fallback_llm';

export interface AssistantVoiceLogAction {
  kind: 'none' | 'cancelled' | 'clarify' | 'ready';
  draft?: VoiceLogDraft | null;
  prefill?: VoiceLogFormPrefill | null;
  missingFields?: VoiceLogMissingField[];
  expectedField?: VoiceLogMissingField | null;
  clarifyAttempts?: number;
  clarifyExhausted?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  conversationId?: string;
  turnId?: string;
  inputMode?: AssistantInputMode;
  audio?: AssistantAudio | null;
  toolEvents?: AssistantToolEvent[];
  citations?: AssistantCitation[];
  safety?: AssistantSafetyMeta | null;
  traceId?: string;
  audioMeta?: {
    providerUsed?: string | null;
    sttProviderUsed?: string | null;
    ttsSkippedReason?: string | null;
    providerFallbackReason?: string | null;
  };
}

export interface ChatSession {
  id: string;
  farmId?: number;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageResponse {
  message: ChatMessage;
  suggestions?: string[];
}

export interface AIMessageAttachmentInput {
  kind: 'image' | 'document';
  name: string;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  sourceUri?: string;
}

export interface AssistantTurnResponse {
  message: ChatMessage;
  suggestions?: string[];
  latencyMs?: number | null;
  providerUsed?: string | null;
  modelUsed?: string | null;
  memoryWrites?: Array<Record<string, unknown>>;
  toolCalls?: AssistantToolEvent[];
  traceId?: string;
  routeDecision?: AssistantRouteDecision | null;
  voiceLogAction?: AssistantVoiceLogAction | null;
  sttProviderUsed?: string | null;
  sttConfidence?: number | null;
  sttLatencyMs?: number | null;
  ttsGenerationMs?: number | null;
  ttsSkippedReason?: string | null;
  providerFallbackReason?: string | null;
  /** Transcript of the user's audio input (only present for audio input_mode) */
  userTranscript?: string | null;
}
