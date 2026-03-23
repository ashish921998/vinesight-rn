import type {
  AIMessageAttachmentInput,
  AssistantInputMode,
  AssistantRouteDecision,
  AssistantToolEvent,
  ChatMessage,
} from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';

export enum AssistantGatewayErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  AUDIO_VALIDATION_FAILED = 'AUDIO_VALIDATION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  CANCELED = 'CANCELED',
  EMPTY_TRANSCRIPT = 'EMPTY_TRANSCRIPT',
  UNKNOWN = 'UNKNOWN',
}

export class AssistantGatewayError extends Error {
  code: AssistantGatewayErrorCode;
  details?: Record<string, unknown>;
  originalError?: Error;

  constructor(
    code: AssistantGatewayErrorCode,
    message: string,
    details?: Record<string, unknown>,
    originalError?: Error,
  ) {
    super(message);
    this.name = 'AssistantGatewayError';
    this.code = code;
    this.details = details;
    this.originalError = originalError;
  }
}

export interface SendAssistantTurnProgress {
  phase: 'preparing' | 'sending' | 'processing' | 'complete';
  percentage: number;
}

export interface SendAssistantTurnOptions {
  requestId?: string;
  onProgress?: (progress: SendAssistantTurnProgress) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface PendingGatewayRequest {
  id: string;
  controller: AbortController;
  startedAt: number;
}

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
  locale: SupportedLanguageCode;
  input_mode: AssistantInputMode;
  input_text?: string | null;
  input_audio_b64?: string | null;
  audio_format?: string | null;
  audio_duration?: number | null;
  attachments?: AIMessageAttachmentInput[];
  client_capabilities?: {
    can_play_audio?: boolean;
    provider_fallback_enabled?: boolean;
    rag_enabled?: boolean;
    memory_enabled?: boolean;
    client_persisted_user_turn?: boolean;
  };
}

export interface AssistantGatewayResponse {
  assistant_text: string;
  user_transcript?: string | null;
  stt_transcript?: string | null;
  assistant_audio_b64?: string | null;
  assistant_audio_url?: string | null;
  assistant_audio_mime_type?: string | null;
  audio_provider_used?: string | null;
  model_used?: string | null;
  tool_calls?: AssistantToolEvent[];
  tool_results?: Array<Record<string, unknown>>;
  memory_writes?: Array<Record<string, unknown>>;
  citations?: unknown[];
  safety_flags?: {
    blocked?: boolean;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    reasons?: string[];
    escalation_suggested?: boolean;
  };
  trace_id?: string;
  latency_ms?: number;
  conversation_id?: string;
  turn_id?: string;
  suggestions?: string[];
  route_decision?: AssistantRouteDecision | null;
  voice_log_action?: {
    kind?: 'none' | 'cancelled' | 'clarify' | 'ready';
    draft?: Record<string, unknown> | null;
    prefill?: Record<string, unknown> | null;
    missing_fields?: string[];
    expected_field?: string | null;
    clarify_attempts?: number;
    clarify_exhausted?: boolean;
  } | null;
  stt_provider_used?: string | null;
  stt_confidence?: number | null;
  stt_latency_ms?: number | null;
  tts_generation_ms?: number | null;
  tts_skipped_reason?: string | null;
  effective_locale?: 'en' | 'hi' | 'mr';
  tts_locale?: 'en' | 'hi' | 'mr';
  provider_fallback_reason?: string | null;
}

export interface SendAssistantTurnInput {
  conversationId?: string | null;
  userMessage: string;
  language: SupportedLanguageCode;
  inputMode?: AssistantInputMode;
  clientCanPlayAudio?: boolean;
  inputAudioBase64?: string | null;
  audioFormat?: string | null;
  audioDuration?: number | null;
  attachments?: AIMessageAttachmentInput[];
  conversationHistory?: ChatMessage[];
  clientPersistedUserTurn?: boolean;
  farmContext?: {
    farmId?: number | null;
    farmName?: string;
    cropVariety?: string;
    area?: number;
    region?: string;
    growthStage?: string;
    daysSincePruning?: number;
  };
}
