/**
 * Shared Types Module
 * Common types used across the ai-gateway modules.
 */

export interface AssistantGatewayRequest {
  conversation_id: string | null;
  user_id: string | null;
  farm_context: {
    farm_id?: number | null;
    farm_name?: string | null;
    crop_variety?: string | null;
    area?: number | null;
    region?: string | null;
    growth_stage?: string | null;
    days_since_pruning?: number | null;
  } | null;
  locale: 'en' | 'hi' | 'mr';
  input_mode: 'text' | 'audio';
  input_text?: string | null;
  input_audio_b64?: string | null;
  audio_format?: string | null;
  audio_duration?: number | null;
  attachments?: Array<{
    kind: 'image' | 'document';
    name: string;
    mimeType?: string;
    dataUrl?: string;
    textContent?: string;
    sourceUri?: string;
  }>;
  client_capabilities?: {
    can_play_audio?: boolean;
    provider_fallback_enabled?: boolean;
    rag_enabled?: boolean;
    memory_enabled?: boolean;
    client_persisted_user_turn?: boolean;
  };
}

export type ToolName =
  | 'log_activity.create'
  | 'log_activity.query'
  | 'farm_context.get'
  | 'routing.decide'
  | 'stt.transcribe'
  | 'memory.search'
  | 'memory.write'
  | 'agronomy_kb.search'
  | 'safety.check_advice';

export interface ToolCall {
  tool: ToolName;
  status: 'ok' | 'error' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

export interface Citation {
  id: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external';
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface SafetyFlags {
  blocked: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  escalation_suggested: boolean;
}

export interface CostBreakdown {
  stt_cost_usd: number;
  llm_input_cost_usd: number;
  llm_output_cost_usd: number;
  tts_cost_usd: number;
  embedding_cost_usd: number;
  total_cost_usd: number;
}

export interface AssistantRouteState {
  voice_log_draft: Record<string, unknown> | null;
  voice_log_expected_field: string | null;
  voice_log_clarify_attempts: number;
  route_clarification_pending: boolean;
  pending_ambiguous_transcript: string | null;
  /** Detected voice locale persisted across follow-up turns (e.g. 'mr', 'hi') */
  detected_locale: 'en' | 'hi' | 'mr' | null;
}

export const DEFAULT_ROUTE_STATE: AssistantRouteState = {
  voice_log_draft: null,
  voice_log_expected_field: null,
  voice_log_clarify_attempts: 0,
  route_clarification_pending: false,
  pending_ambiguous_transcript: null,
  detected_locale: null,
};

export interface VoiceLogActionPayload {
  kind: 'none' | 'cancelled' | 'clarify' | 'ready';
  draft?: Record<string, unknown> | null;
  prefill?: Record<string, unknown> | null;
  missing_fields?: string[];
  expected_field?: string | null;
  clarify_attempts?: number;
  clarify_exhausted?: boolean;
}

export interface AssistantGatewayResponse {
  assistant_text: string;
  assistant_audio_b64: string | null;
  assistant_audio_mime_type: string | null;
  audio_provider_used: string | null;
  stt_provider_used: string | null;
  stt_confidence: number | null;
  stt_latency_ms: number | null;
  tts_generation_ms: number | null;
  tts_skipped_reason: string | null;
  effective_locale: 'en' | 'hi' | 'mr';
  tts_locale: 'en' | 'hi' | 'mr';
  cost_breakdown: CostBreakdown;
  route_decision: string;
  voice_log_action: VoiceLogActionPayload | null;
  provider_fallback_reason: string | null;
  model_used: string;
  tool_calls: Array<{ tool: string; status: string }>;
  tool_results: Array<{ tool: string; status: string }>;
  memory_writes: Array<Record<string, unknown>>;
  citations: Citation[];
  safety_flags: SafetyFlags;
  trace_id: string;
  latency_ms: number;
  conversation_id: string | null;
  turn_id: string | null;
  suggestions: string[];
}
