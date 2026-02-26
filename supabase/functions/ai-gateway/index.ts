import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import {
  buildRouteClarificationCancelled,
  buildRouteClarificationPrompt,
  buildRouteClarificationRetry,
  buildVoiceLogCancelledMessage,
  buildVoiceLogClarificationMessage,
  buildVoiceLogClarifyExhaustedMessage,
  buildVoiceLogFormPrefill,
  buildVoiceLogNoFarmsMessage,
  buildVoiceLogOpeningFormMessage,
  decideChatRoute,
  getVoiceLogMissingFields,
  isRouteClarificationCancelResponse,
  resolveRouteClarificationResponse,
  resolveVoiceLogTurn,
  shouldAttemptVoiceLogExtraction,
  type ActivityLogExtractionResult,
  type HybridChatRoute,
  type VoiceLogDraft,
  type VoiceLogMissingField,
  type Farm as RouteFarm,
} from './voice-routing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssistantGatewayRequest {
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

type ToolName =
  | 'log_activity.create'
  | 'log_activity.query'
  | 'farm_context.get'
  | 'memory.search'
  | 'memory.write'
  | 'agronomy_kb.search'
  | 'safety.check_advice';

interface ToolCall {
  tool: ToolName;
  status: 'ok' | 'error' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
}

interface Citation {
  id: string;
  title: string;
  sourceType: 'farm_record' | 'kb_doc' | 'memory' | 'external';
  url?: string | null;
  snippet?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface SafetyFlags {
  blocked: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  escalation_suggested: boolean;
}

interface CostBreakdown {
  stt_cost_usd: number;
  llm_input_cost_usd: number;
  llm_output_cost_usd: number;
  tts_cost_usd: number;
  embedding_cost_usd: number;
  total_cost_usd: number;
}

interface TelemetryEvent {
  event_name: string;
  user_id: string | null;
  farm_id: number | null;
  trace_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

interface MemorySearchRow {
  content?: string | null;
  similarity?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface AgronomySearchRow {
  content?: string | null;
  similarity?: number | null;
  doc_title?: string | null;
  doc_source_url?: string | null;
  chunk_id?: string | null;
  locale?: string | null;
}

interface FarmRecordRow {
  id?: string | number;
  farm_id?: number | null;
  date?: string | null;
  duration?: number | string | null;
  chemical?: string | null;
  dose?: string | number | null;
  fertilizers?: unknown;
  water_volume?: number | string | null;
  cost?: number | string | null;
  type?: string | null;
}

interface VoiceLogActionPayload {
  kind: 'none' | 'cancelled' | 'clarify' | 'ready';
  draft?: VoiceLogDraft | null;
  prefill?: Record<string, unknown> | null;
  missing_fields?: VoiceLogMissingField[];
  expected_field?: VoiceLogMissingField | null;
  clarify_attempts?: number;
  clarify_exhausted?: boolean;
}

interface AssistantRouteState {
  voice_log_draft: VoiceLogDraft | null;
  voice_log_expected_field: VoiceLogMissingField | null;
  voice_log_clarify_attempts: number;
  route_clarification_pending: boolean;
  pending_ambiguous_transcript: string | null;
}

const DEFAULT_ROUTE_STATE: AssistantRouteState = {
  voice_log_draft: null,
  voice_log_expected_field: null,
  voice_log_clarify_attempts: 0,
  route_clarification_pending: false,
  pending_ambiguous_transcript: null,
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')?.trim() ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

const ADVISORY_MODEL = Deno.env.get('ASSISTANT_OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
const EXTRACTION_MODEL = Deno.env.get('ASSISTANT_EXTRACTION_MODEL')?.trim() || 'gpt-4o-mini';
const EMBEDDING_MODEL =
  Deno.env.get('ASSISTANT_EMBEDDING_MODEL')?.trim() || 'text-embedding-3-small';
const SARVAM_TTS_MODEL = Deno.env.get('ASSISTANT_SARVAM_TTS_MODEL')?.trim() || 'bulbul:v3';
const SARVAM_TTS_MAX_CHARS = 2500;
const SARVAM_STT_MODEL_RAW = Deno.env.get('ASSISTANT_SARVAM_STT_MODEL')?.trim() || 'saarika:v2.5';
const SARVAM_STT_MODEL = (() => {
  const normalized = SARVAM_STT_MODEL_RAW.toLowerCase();
  if (normalized === 'saarika:v2') return 'saarika:v2.5';
  return SARVAM_STT_MODEL_RAW;
})();
const SARVAM_TTS_EN_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_EN_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_HI_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_HI_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_MR_SPEAKER = Deno.env.get('ASSISTANT_SARVAM_TTS_MR_SPEAKER')?.trim() || 'shubh';
const SARVAM_TTS_PACE = Number.parseFloat(Deno.env.get('ASSISTANT_SARVAM_TTS_PACE')?.trim() || '1');

const USE_SARVAM_FOR_VOICE =
  (Deno.env.get('ASSISTANT_USE_SARVAM_VOICE') ?? 'true').toLowerCase() !== 'false';

const MAX_AUDIO_SIZE_MB = 10;
const MAX_TEXT_LENGTH = 5000;
const MAX_AUDIO_BASE64_LENGTH = Math.floor((MAX_AUDIO_SIZE_MB * 1024 * 1024 * 4) / 3);
const MIN_AUDIO_BASE64_LENGTH = 1000;
const MIN_AUDIO_ESTIMATED_BYTES = 700;

const STT_TIMEOUT_MS = 15000;
const TTS_TIMEOUT_MS = 10000;
const LLM_TIMEOUT_MS = 30000;

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60000;
const circuitBreakers = new Map<string, CircuitBreakerState>();

const responseCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const PRICING = {
  sarvam: {
    stt_per_second: 0.00013,
    tts_per_char: 0.00000001,
  },
  openai: {
    stt_per_second: 0.0001,
    tts_per_char: 0.000015,
    gpt_4o_mini_input_per_1k: 0.00015,
    gpt_4o_mini_output_per_1k: 0.0006,
    embedding_3_small_per_1k: 0.00002,
  },
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in ai-gateway');
}

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function resolveLocale(locale: string | undefined): 'en' | 'hi' | 'mr' {
  if (locale === 'hi') return 'hi';
  if (locale === 'mr') return 'mr';
  return 'en';
}

function generateTraceId(): string {
  return crypto.randomUUID();
}

async function withAbortTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}

function normalizeInputText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeBase64Input(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1).trim();
  }
  return trimmed;
}

function estimateBase64Bytes(base64Value: string): number {
  const normalized = base64Value.trim();
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function isLikelyInvalidAudioError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('audio data too small') ||
    lowered.includes('failed to read the file') ||
    lowered.includes('invalid audio') ||
    lowered.includes('decode') ||
    lowered.includes('unsupported') ||
    lowered.includes('empty transcript') ||
    lowered.includes('recording')
  );
}

function detectAudioFormatFromHeader(
  binary: Uint8Array,
): { mime: string; filename: string } | null {
  if (binary.length < 12) return null;

  // WAV: starts with "RIFF"
  if (binary[0] === 0x52 && binary[1] === 0x49 && binary[2] === 0x46 && binary[3] === 0x46) {
    return { mime: 'audio/wav', filename: 'audio.wav' };
  }
  // FLAC: starts with "fLaC"
  if (binary[0] === 0x66 && binary[1] === 0x4c && binary[2] === 0x61 && binary[3] === 0x43) {
    return { mime: 'audio/flac', filename: 'audio.flac' };
  }
  // OGG: starts with "OggS"
  if (binary[0] === 0x4f && binary[1] === 0x67 && binary[2] === 0x67 && binary[3] === 0x53) {
    return { mime: 'audio/ogg', filename: 'audio.ogg' };
  }
  // MP3: starts with ID3 tag or 0xFF 0xFB sync word
  if (
    (binary[0] === 0x49 && binary[1] === 0x44 && binary[2] === 0x33) ||
    (binary[0] === 0xff && (binary[1] & 0xe0) === 0xe0)
  ) {
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  }
  // CAF: starts with "caff"
  if (binary[0] === 0x63 && binary[1] === 0x61 && binary[2] === 0x66 && binary[3] === 0x66) {
    return { mime: 'audio/mp4', filename: 'audio.caf' };
  }
  // MP4/M4A: "ftyp" at offset 4
  if (binary[4] === 0x66 && binary[5] === 0x74 && binary[6] === 0x79 && binary[7] === 0x70) {
    return { mime: 'audio/mp4', filename: 'audio.m4a' };
  }
  // WebM: starts with 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (binary[0] === 0x1a && binary[1] === 0x45 && binary[2] === 0xdf && binary[3] === 0xa3) {
    return { mime: 'audio/webm', filename: 'audio.webm' };
  }
  return null;
}

function normalizeOpenAiAudioMime(mimeType: string): { mime: string; filename: string } {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes('wav')) return { mime: 'audio/wav', filename: 'audio.wav' };
  if (normalized.includes('flac')) return { mime: 'audio/flac', filename: 'audio.flac' };
  if (normalized.includes('webm')) return { mime: 'audio/webm', filename: 'audio.webm' };
  if (normalized.includes('ogg') || normalized.includes('oga'))
    return { mime: 'audio/ogg', filename: 'audio.ogg' };
  if (normalized.includes('x-m4a') || normalized.includes('m4a'))
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('mp4')) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('mpeg') || normalized.includes('mp3'))
    return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('caf')) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  if (normalized.includes('aac')) return { mime: 'audio/mpeg', filename: 'audio.mp3' };
  return { mime: 'audio/mpeg', filename: 'audio.mp3' };
}

function parseJsonObjectFromText(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withoutCodeFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    const parsed: unknown = JSON.parse(withoutCodeFences);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/^[^0-9+.-]+/, '')
      .replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toRoundedPositiveNumber(value: unknown): number | null {
  const parsed = toOptionalNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => stringifyUnknown(item))
      .filter(Boolean)
      .join('; ');
    return joined.trim();
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const prioritized = [
      stringifyUnknown(row.message),
      stringifyUnknown(row.error),
      stringifyUnknown(row.detail),
      stringifyUnknown(row.details),
      stringifyUnknown(row.reason),
    ].filter(Boolean);
    if (prioritized.length > 0) return prioritized.join(' | ');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
}

async function computeContextHash(farmContext: Record<string, unknown> | null): Promise<string> {
  if (!farmContext) return 'none';
  const normalized = JSON.stringify(
    Object.keys(farmContext)
      .sort()
      .reduce((acc: Record<string, unknown>, key) => {
        acc[key] = farmContext[key];
        return acc;
      }, {}),
  );
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function roundUsd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function calculateCost(input: {
  sttProviderUsed: string | null;
  audioDurationSeconds: number;
  inputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
  ttsProviderUsed: string | null;
  ttsCharCount: number;
}): CostBreakdown {
  let sttCost = 0;
  if (input.sttProviderUsed === 'sarvam') {
    sttCost = input.audioDurationSeconds * PRICING.sarvam.stt_per_second;
  } else if (input.sttProviderUsed === 'openai' || input.sttProviderUsed === 'openai_fallback') {
    sttCost = input.audioDurationSeconds * PRICING.openai.stt_per_second;
  }

  const llmInputCost = (input.inputTokens / 1000) * PRICING.openai.gpt_4o_mini_input_per_1k;
  const llmOutputCost = (input.outputTokens / 1000) * PRICING.openai.gpt_4o_mini_output_per_1k;
  const embeddingCost = (input.embeddingTokens / 1000) * PRICING.openai.embedding_3_small_per_1k;

  let ttsCost = 0;
  if (input.ttsProviderUsed === 'sarvam') {
    ttsCost = input.ttsCharCount * PRICING.sarvam.tts_per_char;
  } else if (input.ttsProviderUsed === 'openai' || input.ttsProviderUsed === 'openai_fallback') {
    ttsCost = input.ttsCharCount * PRICING.openai.tts_per_char;
  }

  return {
    stt_cost_usd: roundUsd(sttCost),
    llm_input_cost_usd: roundUsd(llmInputCost),
    llm_output_cost_usd: roundUsd(llmOutputCost),
    tts_cost_usd: roundUsd(ttsCost),
    embedding_cost_usd: roundUsd(embeddingCost),
    total_cost_usd: roundUsd(sttCost + llmInputCost + llmOutputCost + ttsCost + embeddingCost),
  };
}

function getCacheKey(
  transcript: string,
  locale: string,
  userId: string,
  farmId: number | null,
  contextHash?: string,
): string {
  const contextSuffix = contextHash ? `:${contextHash}` : '';
  return `${userId}:${locale}:${farmId ?? 'none'}:${transcript.toLowerCase().trim()}${contextSuffix}`;
}

function checkCircuitBreaker(provider: string): boolean {
  const state = circuitBreakers.get(provider);
  if (!state || !state.isOpen) return true;
  if (Date.now() - state.lastFailureTime > RESET_TIMEOUT_MS) {
    state.isOpen = false;
    state.failures = 0;
    circuitBreakers.set(provider, state);
    return true;
  }
  return false;
}

function recordProviderFailure(provider: string): void {
  const state = circuitBreakers.get(provider) ?? {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };
  state.failures += 1;
  state.lastFailureTime = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
    console.error(`Circuit breaker opened for ${provider} after ${state.failures} failures`);
  }
  circuitBreakers.set(provider, state);
}

function recordProviderSuccess(provider: string): void {
  const state = circuitBreakers.get(provider);
  if (!state) return;
  state.failures = Math.max(0, state.failures - 1);
  if (state.failures === 0) state.isOpen = false;
  circuitBreakers.set(provider, state);
}

async function trackTelemetry(event: TelemetryEvent): Promise<void> {
  try {
    await serviceSupabase.from('telemetry_events').insert(event);
  } catch (error) {
    console.warn('Telemetry tracking failed', stringifyUnknown(error));
  }
}

function parseChemicalItems(
  value: unknown,
): Array<{ name: string; quantity: number | null; unit: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = toRecord(item);
      if (!row) return null;
      const name = toOptionalString(row.name) ?? '';
      const quantity = toRoundedPositiveNumber(row.quantity);
      const unit = toOptionalString(row.unit);
      if (!name && quantity === null && unit === null) return null;
      return {
        name,
        quantity,
        unit,
      };
    })
    .filter((item): item is { name: string; quantity: number | null; unit: string | null } =>
      Boolean(item),
    );
}

function parseFertilizerItems(
  value: unknown,
): Array<{ name: string; quantity: number | null; unit: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = toRecord(item);
      if (!row) return null;
      const name = toOptionalString(row.name) ?? '';
      const quantity = toRoundedPositiveNumber(row.quantity);
      const unit = toOptionalString(row.unit);
      if (!name && quantity === null && unit === null) return null;
      return {
        name,
        quantity,
        unit,
      };
    })
    .filter((item): item is { name: string; quantity: number | null; unit: string | null } =>
      Boolean(item),
    );
}

function parseActivityExtractionResult(raw: string): ActivityLogExtractionResult | null {
  const obj = parseJsonObjectFromText(raw);
  if (!obj) return null;

  const intentRaw = toOptionalString(obj.intent);
  const intent: ActivityLogExtractionResult['intent'] =
    intentRaw === 'log_activity' || intentRaw === 'query_history' || intentRaw === 'advisory'
      ? intentRaw
      : 'none';

  const activityTypeRaw = toOptionalString(obj.activity_type);
  const activityType =
    activityTypeRaw === 'irrigation' ||
    activityTypeRaw === 'spray' ||
    activityTypeRaw === 'harvest' ||
    activityTypeRaw === 'expense' ||
    activityTypeRaw === 'fertigation'
      ? activityTypeRaw
      : null;

  const farmName = toOptionalString(obj.farm_name);
  const dateIsoRaw = toOptionalString(obj.date_iso);
  const dateIso = dateIsoRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateIsoRaw) ? dateIsoRaw : null;
  const dateRelativeRaw = toOptionalString(obj.date_relative);
  const dateRelative: 'today' | 'yesterday' | null =
    dateRelativeRaw === 'today' || dateRelativeRaw === 'yesterday' ? dateRelativeRaw : null;

  const confidenceRaw = toOptionalNumber(obj.confidence);
  const confidence =
    confidenceRaw !== null ? Math.min(1, Math.max(0, confidenceRaw)) : intent === 'none' ? 0 : 0.6;

  const intentConfidenceRaw = toOptionalNumber(obj.intent_confidence);
  const intentConfidence =
    intentConfidenceRaw !== null ? Math.min(1, Math.max(0, intentConfidenceRaw)) : confidence;

  const irrigationRaw = toRecord(obj.irrigation);
  const sprayRaw = toRecord(obj.spray);
  const harvestRaw = toRecord(obj.harvest);
  const expenseRaw = toRecord(obj.expense);
  const fertigationRaw = toRecord(obj.fertigation);

  return {
    intent,
    intentConfidence,
    activityType,
    cancel: obj.cancel === true,
    farmName,
    dateIso,
    dateRelative,
    confidence,
    irrigation: {
      durationHours: toRoundedPositiveNumber(irrigationRaw?.duration_hours ?? null),
    },
    spray: {
      waterVolume: toRoundedPositiveNumber(sprayRaw?.water_volume ?? null),
      chemicals: parseChemicalItems(sprayRaw?.chemicals ?? []),
    },
    harvest: {
      quantity: toRoundedPositiveNumber(harvestRaw?.quantity ?? null),
      grade: toOptionalString(harvestRaw?.grade ?? null),
      price: toRoundedPositiveNumber(harvestRaw?.price ?? null),
      buyer: toOptionalString(harvestRaw?.buyer ?? null),
    },
    expense: {
      cost: toRoundedPositiveNumber(expenseRaw?.cost ?? null),
      expenseType: toOptionalString(expenseRaw?.expense_type ?? null),
      remarks: toOptionalString(expenseRaw?.remarks ?? null),
    },
    fertigation: {
      waterVolume: toRoundedPositiveNumber(fertigationRaw?.water_volume ?? null),
      fertilizers: parseFertilizerItems(fertigationRaw?.fertilizers ?? []),
    },
  };
}

function parseRouteStateFromMetadata(metadata: unknown): AssistantRouteState {
  const routeState = toRecord(toRecord(metadata)?.assistant_route_state ?? null);
  if (!routeState) return { ...DEFAULT_ROUTE_STATE };

  const draftCandidate = toRecord(routeState.voice_log_draft);
  const expectedField = toOptionalString(routeState.voice_log_expected_field);
  const rawAttempts = toOptionalNumber(routeState.voice_log_clarify_attempts);

  const parsed: AssistantRouteState = {
    voice_log_draft: draftCandidate ? (draftCandidate as unknown as VoiceLogDraft) : null,
    voice_log_expected_field:
      expectedField === 'farm' ||
      expectedField === 'duration' ||
      expectedField === 'waterVolume' ||
      expectedField === 'chemicals' ||
      expectedField === 'quantity' ||
      expectedField === 'grade' ||
      expectedField === 'cost' ||
      expectedField === 'expenseType' ||
      expectedField === 'fertilizers'
        ? expectedField
        : null,
    voice_log_clarify_attempts:
      rawAttempts !== null && Number.isFinite(rawAttempts) && rawAttempts >= 0
        ? Math.floor(rawAttempts)
        : 0,
    route_clarification_pending: routeState.route_clarification_pending === true,
    pending_ambiguous_transcript: toOptionalString(routeState.pending_ambiguous_transcript),
  };

  return parsed;
}

async function readConversationRouteState(
  conversationId: string | null,
): Promise<AssistantRouteState> {
  if (!conversationId) return { ...DEFAULT_ROUTE_STATE };

  const { data, error } = await serviceSupabase
    .from('assistant_conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.warn('Failed to load assistant conversation metadata', error.message);
    return { ...DEFAULT_ROUTE_STATE };
  }

  return parseRouteStateFromMetadata(data?.metadata);
}

async function writeConversationRouteState(
  conversationId: string | null,
  nextState: AssistantRouteState,
): Promise<void> {
  if (!conversationId) return;

  const { data, error } = await serviceSupabase
    .from('assistant_conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.warn('Failed to reload conversation metadata for update', error.message);
    return;
  }

  const currentMetadata = toRecord(data?.metadata) ?? {};
  const mergedMetadata: Record<string, unknown> = {
    ...currentMetadata,
    assistant_route_state: nextState,
  };

  const { error: updateError } = await serviceSupabase
    .from('assistant_conversations')
    .update({
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    console.warn('Failed to save assistant route state', updateError.message);
  }
}

async function fetchUserFarms(userId: string | null): Promise<RouteFarm[]> {
  if (!userId) return [];

  const { data, error } = await serviceSupabase
    .from('farms')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Failed to fetch farms for route resolution', error.message);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const id = toOptionalNumber((row as Record<string, unknown>).id);
      const name = toOptionalString((row as Record<string, unknown>).name);
      if (id === null || !name) return null;
      return { id, name };
    })
    .filter((row): row is RouteFarm => Boolean(row));
}

async function extractActivityIntent(
  input: {
    transcript: string;
    locale: 'en' | 'hi' | 'mr';
    farmNames: string[];
    contextFarmName?: string | null;
  },
  signal?: AbortSignal,
): Promise<ActivityLogExtractionResult | null> {
  if (!OPENAI_API_KEY) return null;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      max_tokens: 280,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract farm activity logging intent and slots. Return strict JSON only with keys: intent, intent_confidence, activity_type, cancel, farm_name, date_relative, date_iso, irrigation, spray, harvest, expense, fertigation, confidence.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            transcript: input.transcript,
            language: input.locale,
            today_iso: todayIso,
            context_farm_name: input.contextFarmName ?? null,
            known_farm_names: input.farmNames,
          }),
        },
      ],
    }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) return null;

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  return parseActivityExtractionResult(content);
}

function buildDeterministicQueryIntent(input: {
  transcript: string;
  activity: ReturnType<typeof detectActivity>;
}): { category: string | null; confidence: number } {
  const historyScore = isLikelyHistoryIntent(input.transcript) ? 0.72 : 0;
  if (historyScore === 0) {
    return { category: null, confidence: 0 };
  }
  return {
    category: input.activity ?? 'general',
    confidence: input.activity ? 0.8 : 0.65,
  };
}

function isLikelyHistoryIntent(text: string): boolean {
  return (
    /\b(total|how much|how many|last|latest|history|record)\b/i.test(text) ||
    /कितना|कितने|किती|इतिहास|एकूण|कुल|शेवट/i.test(text)
  );
}

function detectActivity(text: string): 'irrigation' | 'spray' | 'fertigation' | 'expense' | null {
  if (/\birrigat|\bwater|सिंचाई|सिंचन|पाणी|ठिबक/i.test(text)) return 'irrigation';
  if (/\bspray|chemical|pesticide|स्प्रे|फवारणी|छिड़काव/i.test(text)) return 'spray';
  if (/\bfertigat|fertiliz|खत|उर्वरक|फर्टिगेशन/i.test(text)) return 'fertigation';
  if (/\bexpense|cost|spend|खर्च|लागत/i.test(text)) return 'expense';
  return null;
}

function parseExplicitDate(text: string): string | null {
  const directIso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (directIso?.[1]) return directIso[1];
  return null;
}

function isSprayOrFertigationTopic(text: string): boolean {
  return /(spray|pesticide|fungicide|insecticide|chemical|fertigation|fertiliz|dose|dosage|ppm|ml\/l|gm\/l|फवारणी|स्प्रे|छिड़काव|खत|फर्टिगेशन|उर्वरक)/i.test(
    text,
  );
}

function hasDosageSignal(text: string): boolean {
  return /(\d+(\.\d+)?\s?(ml|mL|gm|g|kg|l|liter|litre|ppm|%)\b|\bdose\b|\bdosage\b|\brange\b)/i.test(
    text,
  );
}

function hasPpeSignal(text: string): boolean {
  return /(ppe|gloves|mask|respirator|goggles|protective|safety kit|long sleeves|हातमोजे|मास्क|सुरक्षा|दस्ताने)/i.test(
    text,
  );
}

function hasUncertaintySignal(text: string): boolean {
  return /(uncertain|depends|if symptoms persist|verify|confirm|may vary|likely|confidence|अनिश्चित|तपासा|पुष्टि|कदाचित|बहुधा)/i.test(
    text,
  );
}

function hasEscalationSignal(text: string): boolean {
  return /(consult|agronomist|expert|extension officer|lab test|soil test|escalate|seek local advice|तज्ञ|विशेषज्ञ|कृषी अधिकारी|प्रयोगशाळा)/i.test(
    text,
  );
}

function buildSafetyFlags(input: {
  adviceText: string;
  transcript: string;
  routeDecision: HybridChatRoute;
  citationCount: number;
}): SafetyFlags {
  const reasons: string[] = [];
  const lower = input.adviceText.toLowerCase();
  const combinedText = `${input.transcript}\n${input.adviceText}`;
  const strictGuardrails = isSprayOrFertigationTopic(combinedText);
  const isAdvisoryRoute =
    input.routeDecision === 'advisory' || input.routeDecision === 'fallback_llm';

  if (isAdvisoryRoute && input.citationCount === 0) {
    reasons.push('Advisory response missing citations');
  }

  if (strictGuardrails && !hasDosageSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing dosage range');
  }

  if (strictGuardrails && !hasPpeSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing PPE guidance');
  }

  if (strictGuardrails && !hasUncertaintySignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing uncertainty statement');
  }

  if (strictGuardrails && !hasEscalationSignal(input.adviceText)) {
    reasons.push('Spray/fertigation advice missing escalation trigger');
  }

  if (
    /(mix|dose|ml|gm|kg|liter)/i.test(input.adviceText) &&
    !/(safety|ppe|gloves|mask|protect)/i.test(input.adviceText)
  ) {
    reasons.push('Dosage advice missing explicit safety precautions');
  }

  if (/\bguarantee|100% cure|certainly\b/i.test(lower)) {
    reasons.push('Overconfident claim detected');
  }

  if (/(banned|illegal|unapproved)/i.test(lower)) {
    reasons.push('Potentially unsafe or non-compliant recommendation');
  }

  let risk: SafetyFlags['risk_level'] = 'low';
  if (reasons.length >= 3) risk = 'critical';
  else if (reasons.length === 2) risk = 'high';
  else if (reasons.length === 1) risk = 'medium';

  const blockedByStrictGuardrails = strictGuardrails && reasons.length >= 2;

  return {
    blocked: risk === 'critical' || blockedByStrictGuardrails,
    risk_level: risk,
    reasons,
    escalation_suggested: risk === 'high' || risk === 'critical',
  };
}

function buildBlockedAdviceMessage(locale: 'en' | 'hi' | 'mr', strictGuardrails: boolean): string {
  if (strictGuardrails) {
    if (locale === 'hi') {
      return 'सुरक्षित स्प्रे/फर्टिगेशन सलाह देने के लिए आवश्यक जानकारी या सत्यापन पूरा नहीं है। कृपया उत्पाद लेबल, फसल अवस्था और स्थानीय मौसम साझा करें, या स्थानीय कृषि विशेषज्ञ से पुष्टि करें।';
    }
    if (locale === 'mr') {
      return 'सुरक्षित फवारणी/फर्टिगेशन सल्ल्यासाठी आवश्यक माहिती किंवा पडताळणी अपुरी आहे. कृपया उत्पादन लेबल, पिकाची अवस्था आणि स्थानिक हवामान द्या, किंवा स्थानिक कृषी तज्ञांशी खात्री करा.';
    }
    return 'I cannot provide spray/fertigation advice yet because key safety details are missing or unverified. Share product label, crop stage, and local weather, or confirm with a local agronomy expert.';
  }

  if (locale === 'hi') {
    return 'यह सलाह जोखिमपूर्ण लग रही है। कृपया स्थानीय कृषि विशेषज्ञ से पुष्टि करें।';
  }
  if (locale === 'mr') {
    return 'ही सूचना जोखमीची वाटते. कृपया स्थानिक कृषी तज्ञांची खात्री करा.';
  }
  return 'This recommendation appears risky. Please confirm with a local agronomy expert.';
}

async function callOpenAIChat(
  input: {
    prompt: string;
    locale: 'en' | 'hi' | 'mr';
    contextBlocks: string[];
  },
  signal?: AbortSignal,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const languageInstruction =
    input.locale === 'hi'
      ? 'Respond in Hindi only.'
      : input.locale === 'mr'
        ? 'Respond in Marathi only.'
        : 'Respond in English only.';

  const safetyInstruction =
    'You are a vineyard assistant. Give concise, practical guidance. For spray/fertigation recommendations, use short headings for: Condition, Confidence, Dosage Range, Safety/PPE, Re-entry Interval, Uncertainty, and Escalation Trigger. If evidence is insufficient, ask clarifying questions instead of guessing dosage.';

  const contextPrompt =
    input.contextBlocks.length > 0 ? `\n\nContext:\n${input.contextBlocks.join('\n\n')}` : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ADVISORY_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: `${languageInstruction} ${safetyInstruction}`,
        },
        {
          role: 'user',
          content: `${input.prompt}${contextPrompt}`,
        },
      ],
    }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? 'OpenAI chat request failed';
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned an empty response');
  }

  const usage = toRecord(data?.usage);
  const inputTokens =
    toOptionalNumber(usage?.prompt_tokens) ?? toOptionalNumber(usage?.input_tokens) ?? 0;
  const outputTokens =
    toOptionalNumber(usage?.completion_tokens) ?? toOptionalNumber(usage?.output_tokens) ?? 0;

  return { text: content.trim(), inputTokens, outputTokens };
}

async function callOpenAIEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || !text.trim()) return null;

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  const data = await response.json();
  if (!response.ok) return null;

  const embedding = data?.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}

async function callSarvamStt(
  base64Audio: string,
  mimeType: string,
  locale: 'en' | 'hi' | 'mr',
  signal?: AbortSignal,
): Promise<{ transcript: string; confidence: number | null }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const normalizedMimeType = (() => {
    const normalized = mimeType.trim().toLowerCase();
    if (!normalized) return 'audio/mpeg';
    if (normalized.includes('wav')) return 'audio/wav';
    if (normalized.includes('x-m4a') || normalized.includes('m4a')) return 'audio/mp4';
    if (normalized.includes('mp4')) return 'audio/mp4';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'audio/mpeg';
    if (normalized.startsWith('audio/')) return normalized;
    return 'audio/mpeg';
  })();

  if (normalizedMimeType.includes('mp4')) {
    throw new Error('sarvam_unsupported_audio_container');
  }

  const languageCode = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const candidateModels = Array.from(new Set([SARVAM_STT_MODEL, 'saarika:v2.5']));
  const cleanBase64 = normalizeBase64Input(base64Audio);
  const audioBytes = Uint8Array.from(atob(cleanBase64), (ch) => ch.charCodeAt(0));
  const filename = normalizedMimeType.includes('wav')
    ? 'audio.wav'
    : normalizedMimeType.includes('m4a')
      ? 'audio.m4a'
      : normalizedMimeType.includes('mp4')
        ? 'audio.mp4'
        : normalizedMimeType.includes('aac')
          ? 'audio.aac'
          : 'audio.mp3';

  let lastError = 'Sarvam STT failed';
  for (const model of candidateModels) {
    const form = new FormData();
    form.append('model', model);
    form.append('language_code', languageCode);
    form.append('with_timestamps', 'false');
    form.append('file', new Blob([audioBytes], { type: normalizedMimeType }), filename);

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: form,
      signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = stringifyUnknown(data) || `Sarvam STT failed (${response.status})`;
      lastError = `${reason} [model=${model}, mime=${normalizedMimeType}]`;
      continue;
    }

    const transcript =
      toOptionalString(data?.transcript) ??
      toOptionalString(data?.text) ??
      toOptionalString(data?.data?.transcript) ??
      toOptionalString(data?.result?.transcript);

    if (!transcript) {
      lastError = `Sarvam STT returned empty transcript [model=${model}, mime=${normalizedMimeType}]`;
      continue;
    }

    const confidenceRaw = toOptionalNumber(
      data?.confidence ??
        data?.avg_confidence ??
        data?.metadata?.confidence ??
        data?.data?.confidence,
    );
    const confidence =
      confidenceRaw !== null
        ? Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw))
        : null;

    return { transcript: transcript.trim(), confidence };
  }

  throw new Error(lastError);
}

async function callOpenAIStt(
  base64Audio: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ transcript: string; confidence: number | null }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const cleanBase64 = normalizeBase64Input(base64Audio);
  const binary = Uint8Array.from(atob(cleanBase64), (ch) => ch.charCodeAt(0));

  const headerDetected = detectAudioFormatFromHeader(binary);
  const mimeBasedAudio = normalizeOpenAiAudioMime(mimeType);
  const openAiAudio = headerDetected ?? mimeBasedAudio;

  const headerHex = Array.from(binary.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  console.log(
    `[OpenAI STT] clientMime=${mimeType} mimeNormalized=${mimeBasedAudio.mime}/${mimeBasedAudio.filename} headerDetected=${headerDetected ? `${headerDetected.mime}/${headerDetected.filename}` : 'none'} using=${openAiAudio.mime}/${openAiAudio.filename} bytes=${binary.length} header=${headerHex}`,
  );

  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('file', new Blob([binary], { type: openAiAudio.mime }), openAiAudio.filename);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(
      `[OpenAI STT] rejected: ${JSON.stringify(data?.error)} mime=${openAiAudio.mime} filename=${openAiAudio.filename} bytes=${binary.length}`,
    );
    throw new Error(data?.error?.message ?? 'OpenAI STT failed');
  }

  const transcript = data?.text;
  if (typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('OpenAI STT returned empty transcript');
  }

  return { transcript: transcript.trim(), confidence: null };
}

async function callSarvamTts(
  text: string,
  locale: 'en' | 'hi' | 'mr',
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const languageCode = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const speaker =
    locale === 'mr'
      ? SARVAM_TTS_MR_SPEAKER
      : locale === 'hi'
        ? SARVAM_TTS_HI_SPEAKER
        : SARVAM_TTS_EN_SPEAKER;
  const pace =
    Number.isFinite(SARVAM_TTS_PACE) && SARVAM_TTS_PACE > 0
      ? Math.max(0.5, Math.min(SARVAM_TTS_PACE, 2))
      : 1;

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, SARVAM_TTS_MAX_CHARS),
      model: SARVAM_TTS_MODEL,
      target_language_code: languageCode,
      speaker,
      pace,
      output_audio_codec: 'mp3',
    }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = stringifyUnknown(data) || 'Sarvam TTS failed';
    throw new Error(message);
  }

  const audioBase64 =
    (Array.isArray(data?.audios) && typeof data.audios[0] === 'string' ? data.audios[0] : null) ||
    (typeof data?.audio === 'string' && data.audio) ||
    (typeof data?.audio_base64 === 'string' && data.audio_base64);
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new Error('Sarvam TTS returned no audio data');
  }

  return { base64: audioBase64, mimeType: 'audio/mpeg' };
}

async function callOpenAITts(
  text: string,
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      format: 'mp3',
    }),
    signal,
  });

  if (!response.ok) {
    let message = 'OpenAI TTS failed';
    try {
      const data = await response.json();
      message = stringifyUnknown(data);
    } catch {
      // ignore parse errors, use default message
    }
    throw new Error(message);
  }

  const binary = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(binary)));
  return { base64, mimeType: 'audio/mpeg' };
}

async function resolveConversationId(
  inputConversationId: string | null,
  userId: string | null,
  farmId: number | null,
  locale: string,
): Promise<string | null> {
  if (!userId) return null;
  if (inputConversationId) {
    const { data, error } = await serviceSupabase
      .from('assistant_conversations')
      .select('id')
      .eq('id', inputConversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to validate assistant conversation ownership', error.message);
      return null;
    }

    return data?.id ?? null;
  }

  const { data, error } = await serviceSupabase
    .from('assistant_conversations')
    .insert({
      user_id: userId,
      farm_id: farmId,
      locale,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to create assistant conversation', error.message);
    return null;
  }

  return data?.id ?? null;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

async function resolveAuthenticatedUserId(req: Request): Promise<string | null> {
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return null;

  const { data, error } = await serviceSupabase.auth.getUser(bearerToken);
  if (error) {
    console.warn('Failed to resolve authenticated user', error.message);
    return null;
  }

  return data.user?.id ?? null;
}

async function writeConversationTurn(input: {
  conversationId: string | null;
  userId: string | null;
  farmId: number | null;
  role: 'user' | 'assistant';
  content: string;
  inputMode?: 'text' | 'audio';
  traceId: string;
  latencyMs?: number;
  provider?: string | null;
  model?: string | null;
  citations?: Citation[];
  toolCalls?: ToolCall[];
  safetyFlags?: SafetyFlags;
}): Promise<string | null> {
  if (!input.conversationId || !input.userId || !input.content.trim()) return null;

  const { data, error } = await serviceSupabase
    .from('assistant_turns')
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      farm_id: input.farmId,
      role: input.role,
      content: input.content,
      input_mode: input.inputMode ?? 'text',
      trace_id: input.traceId,
      latency_ms: input.latencyMs ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      citations: input.citations ?? null,
      tool_calls: input.toolCalls ?? null,
      safety_flags: input.safetyFlags ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to write assistant turn', error.message);
    return null;
  }

  return data?.id ?? null;
}

async function searchMemoryContext(input: {
  query: string;
  userId: string | null;
  farmId: number | null;
  enabled: boolean;
  embeddingTokenCounter?: { value: number };
  toolCalls: ToolCall[];
}): Promise<{ contextBlocks: string[]; citations: Citation[] }> {
  if (!input.enabled || !input.userId || !input.query.trim()) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'skipped',
      input: { enabled: input.enabled },
      output: { reason: 'disabled_or_missing_user' },
    });
    return { contextBlocks: [], citations: [] };
  }

  if (input.embeddingTokenCounter) {
    input.embeddingTokenCounter.value += estimateTokens(input.query);
  }
  const embedding = await callOpenAIEmbedding(input.query);
  if (!embedding) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      input: { queryLength: input.query.length },
      error: 'embedding_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  const { data, error } = await serviceSupabase.rpc('match_assistant_memories', {
    query_embedding: embedding,
    match_count: 5,
    p_user_id: input.userId,
    p_farm_id: input.farmId,
  });

  if (error) {
    input.toolCalls.push({
      tool: 'memory.search',
      status: 'error',
      error: error.message,
    });
    return { contextBlocks: [], citations: [] };
  }

  const rows: MemorySearchRow[] = Array.isArray(data) ? (data as MemorySearchRow[]) : [];
  input.toolCalls.push({
    tool: 'memory.search',
    status: 'ok',
    output: { count: rows.length },
  });

  const contextBlocks = rows
    .map((row) => (typeof row.content === 'string' ? row.content.trim() : ''))
    .filter((content) => content.length > 0)
    .map((content) => `Memory: ${content}`);

  return {
    contextBlocks,
    citations: rows.map(
      (row, idx: number) =>
        ({
          id: `memory-${idx + 1}`,
          title: 'User memory',
          sourceType: 'memory',
          snippet: row.content ?? null,
          confidence: typeof row.similarity === 'number' ? row.similarity : null,
          metadata: row.metadata ?? null,
        }) satisfies Citation,
    ),
  };
}

async function searchRagContext(input: {
  query: string;
  locale: 'en' | 'hi' | 'mr';
  enabled: boolean;
  embeddingTokenCounter?: { value: number };
  toolCalls: ToolCall[];
}): Promise<{ contextBlocks: string[]; citations: Citation[] }> {
  if (!input.enabled || !input.query.trim()) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'skipped',
      input: { enabled: input.enabled },
      output: { reason: 'disabled_or_empty_query' },
    });
    return { contextBlocks: [], citations: [] };
  }

  if (input.embeddingTokenCounter) {
    input.embeddingTokenCounter.value += estimateTokens(input.query);
  }
  const embedding = await callOpenAIEmbedding(input.query);
  if (!embedding) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'error',
      input: { queryLength: input.query.length },
      error: 'embedding_unavailable',
    });
    return { contextBlocks: [], citations: [] };
  }

  const { data, error } = await serviceSupabase.rpc('match_agronomy_chunks', {
    query_embedding: embedding,
    match_count: 5,
    p_locale: input.locale,
  });

  if (error) {
    input.toolCalls.push({
      tool: 'agronomy_kb.search',
      status: 'error',
      error: error.message,
    });
    return { contextBlocks: [], citations: [] };
  }

  const rows: AgronomySearchRow[] = Array.isArray(data) ? (data as AgronomySearchRow[]) : [];
  input.toolCalls.push({
    tool: 'agronomy_kb.search',
    status: 'ok',
    output: { count: rows.length },
  });

  const contextBlocks = rows
    .map((row) => (typeof row.content === 'string' ? row.content.trim() : ''))
    .filter((content) => content.length > 0)
    .map((content) => `Agronomy KB: ${content}`);

  return {
    contextBlocks,
    citations: rows.map(
      (row, idx: number) =>
        ({
          id: `kb-${idx + 1}`,
          title: row.doc_title ?? 'Agronomy knowledge',
          sourceType: 'kb_doc',
          url: row.doc_source_url ?? null,
          snippet: row.content ?? null,
          confidence: typeof row.similarity === 'number' ? row.similarity : null,
          metadata: {
            chunk_id: row.chunk_id ?? null,
            locale: row.locale ?? null,
          },
        }) satisfies Citation,
    ),
  };
}

async function queryFarmRecords(input: {
  transcript: string;
  userId: string | null;
  farmId: number | null;
  activity: ReturnType<typeof detectActivity>;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ answer: string | null; citations: Citation[] }> {
  if (!input.userId || !input.activity) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'skipped',
      output: { reason: 'missing_user_or_activity' },
    });
    return { answer: null, citations: [] };
  }

  const tableByActivity: Record<string, string> = {
    irrigation: 'irrigation_records',
    spray: 'spray_records',
    fertigation: 'fertigation_records',
    expense: 'expense_records',
  };

  const selectByActivity: Record<string, string> = {
    irrigation: 'id, farm_id, date, duration, farms!inner(user_id, name)',
    spray: 'id, farm_id, date, chemical, dose, water_volume, farms!inner(user_id, name)',
    fertigation: 'id, farm_id, date, fertilizers, water_volume, farms!inner(user_id, name)',
    expense: 'id, farm_id, date, cost, type, farms!inner(user_id, name)',
  };

  const table = tableByActivity[input.activity];
  const explicitDate = parseExplicitDate(input.transcript);

  let query = serviceSupabase
    .from(table)
    .select(selectByActivity[input.activity] ?? 'id, farm_id, date, farms!inner(user_id, name)')
    .eq('farms.user_id', input.userId)
    .order('date', { ascending: false })
    .limit(50);

  if (input.farmId) {
    query = query.eq('farm_id', input.farmId);
  }
  if (explicitDate) {
    query = query.eq('date', explicitDate);
  }

  const { data, error } = await query;
  if (error) {
    input.toolCalls.push({
      tool: 'log_activity.query',
      status: 'error',
      error: error.message,
    });
    return { answer: null, citations: [] };
  }

  const validateFarmRecord = (row: unknown): row is FarmRecordRow => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Record<string, unknown>;
    const validId = typeof candidate.id === 'string' || typeof candidate.id === 'number';
    const validDate = candidate.date === null || typeof candidate.date === 'string';
    return validId && validDate;
  };

  const rows: FarmRecordRow[] = Array.isArray(data) ? data.filter(validateFarmRecord) : [];
  input.toolCalls.push({
    tool: 'log_activity.query',
    status: 'ok',
    output: { table, count: rows.length },
  });

  if (rows.length === 0) {
    const message =
      input.locale === 'hi'
        ? 'कोई रिकॉर्ड नहीं मिला।'
        : input.locale === 'mr'
          ? 'कोणतीही नोंद आढळली नाही.'
          : 'No records found.';
    return { answer: message, citations: [] };
  }

  if (/\btotal|how much|how many|कितना|कितने|किती|एकूण|कुल/i.test(input.transcript)) {
    if (input.activity === 'irrigation') {
      const total = rows.reduce((sum: number, row) => sum + Number(row.duration ?? 0), 0);
      return {
        answer:
          input.locale === 'hi'
            ? `कुल सिंचाई ${total.toFixed(2)} घंटे है।`
            : input.locale === 'mr'
              ? `एकूण सिंचन ${total.toFixed(2)} तास आहे.`
              : `Total irrigation is ${total.toFixed(2)} hours.`,
        citations: [
          {
            id: 'farm-total-1',
            title: 'Farm operation logs',
            sourceType: 'farm_record',
            snippet: `Computed from ${rows.length} irrigation record(s).`,
          },
        ],
      };
    }

    if (input.activity === 'expense') {
      const total = rows.reduce((sum: number, row) => sum + Number(row.cost ?? 0), 0);
      return {
        answer:
          input.locale === 'hi'
            ? `कुल खर्च ₹${total.toFixed(2)} है।`
            : input.locale === 'mr'
              ? `एकूण खर्च ₹${total.toFixed(2)} आहे.`
              : `Total expense is ₹${total.toFixed(2)}.`,
        citations: [
          {
            id: 'farm-total-2',
            title: 'Farm expense logs',
            sourceType: 'farm_record',
            snippet: `Computed from ${rows.length} expense record(s).`,
          },
        ],
      };
    }
  }

  const latest = rows[0];
  const latestDate = latest?.date ?? 'unknown date';
  const latestAnswer =
    input.activity === 'irrigation'
      ? input.locale === 'hi'
        ? `नवीनतम सिंचाई: ${latest?.duration ?? 0} घंटे ${latestDate} को।`
        : input.locale === 'mr'
          ? `अलीकडील सिंचन: ${latest?.duration ?? 0} तास ${latestDate} रोजी.`
          : `Latest irrigation: ${latest?.duration ?? 0} hours on ${latestDate}.`
      : input.activity === 'spray'
        ? input.locale === 'hi'
          ? `नवीनतम स्प्रे: ${latest?.chemical ?? 'अज्ञात'} (${latest?.dose ?? '-'}) ${latestDate} को।`
          : input.locale === 'mr'
            ? `अलीकडील फवारणी: ${latest?.chemical ?? 'अज्ञात'} (${latest?.dose ?? '-'}) ${latestDate} रोजी.`
            : `Latest spray: ${latest?.chemical ?? 'Unknown'} (${latest?.dose ?? '-'}) on ${latestDate}.`
        : input.activity === 'expense'
          ? input.locale === 'hi'
            ? `नवीनतम खर्च: ₹${Number(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'अन्य'}) ${latestDate} को।`
            : input.locale === 'mr'
              ? `अलीकडील खर्च: ₹${Number(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'इतर'}) ${latestDate} रोजी.`
              : `Latest expense: ₹${Number(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'other'}) on ${latestDate}.`
          : input.locale === 'hi'
            ? `नवीनतम ${input.activity} रिकॉर्ड ${latestDate} का है।`
            : input.locale === 'mr'
              ? `अलीकडील ${input.activity} नोंद ${latestDate} ची आहे.`
              : `Latest ${input.activity} record is from ${latestDate}.`;

  return {
    answer: latestAnswer,
    citations: [
      {
        id: 'farm-latest-1',
        title: 'Latest farm log record',
        sourceType: 'farm_record',
        snippet: JSON.stringify(latest),
      },
    ],
  };
}

async function writeMemory(input: {
  conversationId: string | null;
  userId: string | null;
  farmId: number | null;
  transcript: string;
  answer: string;
  enabled: boolean;
  toolCalls: ToolCall[];
}): Promise<Array<Record<string, unknown>>> {
  if (!input.enabled || !input.userId || !input.conversationId) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'skipped',
      output: { reason: 'disabled_or_missing_identity' },
    });
    return [];
  }

  const summary = `${input.transcript.slice(0, 160)} -> ${input.answer.slice(0, 220)}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);

  const payload = {
    conversation_id: input.conversationId,
    user_id: input.userId,
    farm_id: input.farmId,
    memory_type: 'summary',
    content: summary,
    metadata: {
      source: 'ai_gateway',
      transcript_preview: input.transcript.slice(0, 80),
    },
    importance: 0.45,
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await serviceSupabase
    .from('assistant_memories')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    input.toolCalls.push({
      tool: 'memory.write',
      status: 'error',
      error: error.message,
    });
    return [];
  }

  input.toolCalls.push({
    tool: 'memory.write',
    status: 'ok',
    output: { memory_id: data?.id ?? null },
  });

  return [
    {
      memory_id: data?.id ?? null,
      memory_type: 'summary',
      expires_at: expiresAt.toISOString(),
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const start = Date.now();
  const traceId = generateTraceId();

  try {
    const body = (await req.json()) as AssistantGatewayRequest;
    const authenticatedUserId = await resolveAuthenticatedUserId(req);
    const locale = resolveLocale(body?.locale);
    const providerFallbackEnabled = body?.client_capabilities?.provider_fallback_enabled !== false;
    const clientPersistedUserTurn = body?.client_capabilities?.client_persisted_user_turn === true;

    if (!authenticatedUserId) {
      return jsonResponse({ error: 'Authentication required for gateway operations' }, 401);
    }

    if (body?.user_id && body.user_id !== authenticatedUserId) {
      return jsonResponse({ error: 'user_id does not match authenticated user' }, 403);
    }

    if (body?.input_text && body.input_text.length > MAX_TEXT_LENGTH) {
      return jsonResponse({ error: `Text input exceeds ${MAX_TEXT_LENGTH} characters` }, 400);
    }

    if (body?.input_audio_b64) {
      const cleanBase64 = normalizeBase64Input(body.input_audio_b64);
      if (cleanBase64.length > MAX_AUDIO_BASE64_LENGTH) {
        return jsonResponse(
          { error: `Audio exceeds ${MAX_AUDIO_SIZE_MB}MB limit`, max_size_mb: MAX_AUDIO_SIZE_MB },
          413,
        );
      }
      if (cleanBase64.length > 0 && cleanBase64.length < MIN_AUDIO_BASE64_LENGTH) {
        return jsonResponse(
          {
            error: 'INVALID_AUDIO',
            message: 'Audio recording is too short. Please speak for at least 1 second.',
            min_base64_length: MIN_AUDIO_BASE64_LENGTH,
          },
          400,
        );
      }
    }

    let transcript = normalizeInputText(body?.input_text);
    const inputMode: 'text' | 'audio' = body?.input_mode === 'audio' ? 'audio' : 'text';
    let effectiveInputMode: 'text' | 'audio' = inputMode;
    const embeddingTokenCounter = { value: 0 };
    let llmInputTokens = 0;
    let llmOutputTokens = 0;
    let preflightSafetyFlags: SafetyFlags | null = null;
    let cacheHit = false;

    const toolCalls: ToolCall[] = [];
    let sttProviderUsed: string | null = null;
    let sttConfidence: number | null = null;
    let sttLatencyMs: number | null = null;
    let ttsGenerationMs: number | null = null;
    let ttsSkippedReason: string | null = null;
    let providerFallbackReason: string | null = null;

    await trackTelemetry({
      event_name: 'ai_gateway_request_started',
      user_id: authenticatedUserId,
      farm_id: body?.farm_context?.farm_id ?? null,
      trace_id: traceId,
      properties: {
        input_mode: inputMode,
        locale,
        has_audio: Boolean(body?.input_audio_b64),
      },
      timestamp: new Date().toISOString(),
    });

    if (inputMode === 'audio') {
      const audioBase64 = body?.input_audio_b64?.trim();
      const audioMimeType = body?.audio_format?.trim() || 'audio/mpeg';
      if (!audioBase64) {
        if (!transcript) {
          return jsonResponse(
            { error: 'Audio input mode requires input_audio_b64 or input_text' },
            400,
          );
        }

        effectiveInputMode = 'text';
        sttProviderUsed = 'client_transcript';
        toolCalls.push({
          tool: 'farm_context.get',
          status: 'skipped',
          output: { stt_provider: 'client_transcript' },
        });
      } else {
        const normalizedAudioBase64 = normalizeBase64Input(audioBase64);
        const estimatedAudioBytes = estimateBase64Bytes(normalizedAudioBase64);
        if (normalizedAudioBase64.length < MIN_AUDIO_BASE64_LENGTH) {
          return jsonResponse(
            {
              error: 'INVALID_AUDIO',
              message: 'Audio recording is too short. Please speak for at least 1 second.',
              base64_length: normalizedAudioBase64.length,
            },
            400,
          );
        }
        if (estimatedAudioBytes < MIN_AUDIO_ESTIMATED_BYTES) {
          return jsonResponse(
            {
              error: 'INVALID_AUDIO',
              message: 'Audio data is too small to transcribe. Please try again.',
              estimated_audio_bytes: estimatedAudioBytes,
            },
            400,
          );
        }

        const sarvamUnsupportedContainer = /\b(mp4|m4a|x-m4a|caf|x-caf)\b/i.test(audioMimeType);
        console.log(
          `[STT dispatch] audioMimeType=${audioMimeType} sarvamUnsupported=${sarvamUnsupportedContainer} useSarvam=${USE_SARVAM_FOR_VOICE} base64len=${normalizedAudioBase64.length} estimatedBytes=${estimatedAudioBytes}`,
        );

        try {
          let sttResult: { transcript: string; confidence: number | null };
          let sttStartedAt: number;
          if (USE_SARVAM_FOR_VOICE && !sarvamUnsupportedContainer) {
            const canUseSarvam = checkCircuitBreaker('sarvam_stt');
            if (canUseSarvam) {
              try {
                sttStartedAt = Date.now();
                sttResult = await withAbortTimeout(
                  (signal) => callSarvamStt(audioBase64, audioMimeType, locale, signal),
                  STT_TIMEOUT_MS,
                  `Sarvam STT timed out after ${STT_TIMEOUT_MS}ms`,
                );
                sttLatencyMs = Date.now() - sttStartedAt;
                sttProviderUsed = 'sarvam';
                sttConfidence = sttResult.confidence;
                recordProviderSuccess('sarvam_stt');
              } catch (error) {
                recordProviderFailure('sarvam_stt');
                if (!providerFallbackEnabled) throw error;
                console.warn('Sarvam STT failed, falling back to OpenAI:', stringifyUnknown(error));
                sttStartedAt = Date.now();
                sttResult = await withAbortTimeout(
                  (signal) => callOpenAIStt(audioBase64, audioMimeType, signal),
                  STT_TIMEOUT_MS,
                  `OpenAI STT fallback timed out after ${STT_TIMEOUT_MS}ms`,
                );
                sttLatencyMs = Date.now() - sttStartedAt;
                sttProviderUsed = 'openai_fallback';
                sttConfidence = sttResult.confidence;
                providerFallbackReason =
                  error instanceof Error ? error.message : 'sarvam_stt_failed';
              }
            } else {
              console.warn('Sarvam STT circuit breaker open; using OpenAI directly');
              sttStartedAt = Date.now();
              sttResult = await withAbortTimeout(
                (signal) => callOpenAIStt(audioBase64, audioMimeType, signal),
                STT_TIMEOUT_MS,
                `OpenAI STT timed out after ${STT_TIMEOUT_MS}ms`,
              );
              sttLatencyMs = Date.now() - sttStartedAt;
              sttProviderUsed = 'openai';
              sttConfidence = sttResult.confidence;
              providerFallbackReason = 'sarvam_stt_circuit_open';
            }
          } else {
            sttStartedAt = Date.now();
            sttResult = await withAbortTimeout(
              (signal) => callOpenAIStt(audioBase64, audioMimeType, signal),
              STT_TIMEOUT_MS,
              `OpenAI STT timed out after ${STT_TIMEOUT_MS}ms`,
            );
            sttLatencyMs = Date.now() - sttStartedAt;
            sttProviderUsed = 'openai';
            sttConfidence = sttResult.confidence;
          }
          transcript = sttResult.transcript;
          toolCalls.push({
            tool: 'farm_context.get',
            status: 'ok',
            output: {
              stt_provider: sttProviderUsed,
              stt_confidence: sttConfidence,
              stt_latency_ms: sttLatencyMs,
              provider_fallback_reason: providerFallbackReason,
            },
          });
        } catch (error) {
          const errorMessage = stringifyUnknown(error);
          if (isLikelyInvalidAudioError(errorMessage)) {
            return jsonResponse(
              {
                error: 'INVALID_AUDIO_FORMAT',
                message:
                  'The audio recording could not be processed. Please try again and speak for at least 1 second.',
                details: errorMessage,
                stt_provider_used: sttProviderUsed,
              },
              400,
            );
          }
          throw error;
        }
      }
    }

    if (!transcript) {
      return jsonResponse({ error: 'Input transcript is empty' }, 400);
    }

    const farmId = body?.farm_context?.farm_id ?? null;
    const userId = authenticatedUserId;
    const requestedConversationId = body?.conversation_id ?? null;
    const conversationId = await resolveConversationId(
      requestedConversationId,
      userId,
      farmId,
      locale,
    );

    if (requestedConversationId && !conversationId) {
      return jsonResponse({ error: 'Conversation not found for authenticated user' }, 403);
    }

    if (conversationId && !clientPersistedUserTurn) {
      await writeConversationTurn({
        conversationId,
        userId,
        farmId,
        role: 'user',
        content: transcript,
        inputMode: effectiveInputMode,
        traceId,
      });
    }

    const activity = detectActivity(transcript);
    const farmsForRouting = await fetchUserFarms(userId);
    const contextFarmForRouting =
      farmId !== null ? (farmsForRouting.find((farmRow) => farmRow.id === farmId) ?? null) : null;

    const routeState = await readConversationRouteState(conversationId);
    const nextRouteState: AssistantRouteState = {
      ...routeState,
    };
    let routeStateDirty = false;

    let routeDecision: HybridChatRoute = 'fallback_llm';
    let voiceLogAction: VoiceLogActionPayload | null = null;
    let llmExtraction: ActivityLogExtractionResult | null = null;
    let effectiveTranscript = transcript;
    let forcedRoute: 'voice_log' | 'farm_query' | null = null;

    let assistantText = '';
    let citations: Citation[] = [];

    if (nextRouteState.route_clarification_pending) {
      const clarifiedRoute = resolveRouteClarificationResponse(transcript);
      if (!clarifiedRoute) {
        if (isRouteClarificationCancelResponse(transcript)) {
          nextRouteState.route_clarification_pending = false;
          nextRouteState.pending_ambiguous_transcript = null;
          routeStateDirty = true;
          routeDecision = 'clarify_route';
          assistantText = buildRouteClarificationCancelled(locale);
        } else {
          routeDecision = 'clarify_route';
          assistantText = buildRouteClarificationRetry(locale);
        }
      } else {
        forcedRoute = clarifiedRoute;
        routeDecision = clarifiedRoute;
        nextRouteState.route_clarification_pending = false;
        if (nextRouteState.pending_ambiguous_transcript) {
          effectiveTranscript = nextRouteState.pending_ambiguous_transcript;
        }
        nextRouteState.pending_ambiguous_transcript = null;
        routeStateDirty = true;
      }
    }

    if (!assistantText) {
      if (
        shouldAttemptVoiceLogExtraction(
          effectiveTranscript,
          Boolean(nextRouteState.voice_log_draft),
        )
      ) {
        llmExtraction = await withAbortTimeout(
          (signal) =>
            extractActivityIntent(
              {
                transcript: effectiveTranscript,
                locale,
                farmNames: farmsForRouting.map((farmRow) => farmRow.name),
                contextFarmName:
                  contextFarmForRouting?.name ?? body?.farm_context?.farm_name ?? null,
              },
              signal,
            ),
          LLM_TIMEOUT_MS,
          `Intent extraction timed out after ${LLM_TIMEOUT_MS}ms`,
        );
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
        tool: 'farm_context.get',
        status: 'ok',
        output: {
          route_decision: routeDecision,
          llm_intent: llmExtraction?.intent ?? null,
          llm_intent_confidence: llmExtraction?.intentConfidence ?? null,
          deterministic_confidence: deterministicQuery.confidence,
          forced_route: forcedRoute,
        },
      });
      await trackTelemetry({
        event_name: 'route_decided',
        user_id: userId,
        farm_id: farmId,
        trace_id: traceId,
        properties: {
          route: routeDecision,
          llm_intent: llmExtraction?.intent ?? null,
          confidence: llmExtraction?.intentConfidence ?? null,
        },
        timestamp: new Date().toISOString(),
      });

      if (routeDecision === 'clarify_route') {
        nextRouteState.route_clarification_pending = true;
        nextRouteState.pending_ambiguous_transcript = effectiveTranscript;
        routeStateDirty = true;
        assistantText = buildRouteClarificationPrompt(locale);
      } else if (routeDecision === 'voice_log') {
        const logTurn = resolveVoiceLogTurn({
          transcript: effectiveTranscript,
          farms: farmsForRouting,
          contextFarm: contextFarmForRouting,
          activeDraft: nextRouteState.voice_log_draft,
          originContext: farmId !== null ? 'farm' : 'dashboard',
          llmExtraction,
          expectedField: nextRouteState.voice_log_expected_field,
        });

        if (logTurn.kind === 'cancelled') {
          nextRouteState.voice_log_draft = null;
          nextRouteState.voice_log_expected_field = null;
          nextRouteState.voice_log_clarify_attempts = 0;
          routeStateDirty = true;
          assistantText = buildVoiceLogCancelledMessage(locale);
          voiceLogAction = {
            kind: 'cancelled',
          };
        } else if (logTurn.kind === 'clarify') {
          if (logTurn.missingFields.includes('farm') && farmsForRouting.length === 0) {
            nextRouteState.voice_log_draft = null;
            nextRouteState.voice_log_expected_field = null;
            nextRouteState.voice_log_clarify_attempts = 0;
            routeStateDirty = true;
            assistantText = buildVoiceLogNoFarmsMessage(locale);
            voiceLogAction = { kind: 'none' };
          } else {
            const previousMissing = nextRouteState.voice_log_draft
              ? getVoiceLogMissingFields(nextRouteState.voice_log_draft)
              : null;
            const madeProgress =
              !previousMissing ||
              logTurn.missingFields.length < previousMissing.length ||
              logTurn.missingFields.join(',') !== previousMissing.join(',');
            const nextAttempts = madeProgress ? 0 : nextRouteState.voice_log_clarify_attempts + 1;
            const maxClarifyAttempts = 3;

            if (nextRouteState.voice_log_draft && nextAttempts >= maxClarifyAttempts) {
              assistantText = buildVoiceLogClarifyExhaustedMessage(locale);
              voiceLogAction = {
                kind: 'ready',
                draft: logTurn.draft,
                prefill: buildVoiceLogFormPrefill(logTurn.draft) as Record<string, unknown>,
                missing_fields: logTurn.missingFields,
                expected_field: logTurn.missingFields[0] ?? null,
                clarify_attempts: nextAttempts,
                clarify_exhausted: true,
              };
              nextRouteState.voice_log_draft = null;
              nextRouteState.voice_log_expected_field = null;
              nextRouteState.voice_log_clarify_attempts = 0;
            } else {
              nextRouteState.voice_log_draft = logTurn.draft;
              nextRouteState.voice_log_expected_field = logTurn.missingFields[0] ?? null;
              nextRouteState.voice_log_clarify_attempts = nextAttempts;
              assistantText = buildVoiceLogClarificationMessage(locale, logTurn.missingFields);
              voiceLogAction = {
                kind: 'clarify',
                draft: logTurn.draft,
                missing_fields: logTurn.missingFields,
                expected_field: logTurn.missingFields[0] ?? null,
                clarify_attempts: nextAttempts,
              };
            }

            routeStateDirty = true;
          }
        } else if (logTurn.kind === 'ready') {
          nextRouteState.voice_log_draft = null;
          nextRouteState.voice_log_expected_field = null;
          nextRouteState.voice_log_clarify_attempts = 0;
          routeStateDirty = true;
          assistantText = buildVoiceLogOpeningFormMessage(locale, logTurn.draft);
          voiceLogAction = {
            kind: 'ready',
            draft: logTurn.draft,
            prefill: buildVoiceLogFormPrefill(logTurn.draft) as Record<string, unknown>,
          };
          toolCalls.push({
            tool: 'log_activity.create',
            status: 'ok',
            input: { transcript: effectiveTranscript, activity: logTurn.draft.type },
            output: { requires_confirmation: true, ready_for_handoff: true },
          });
        }
      }
    }

    if (!assistantText && routeDecision === 'farm_query' && activity) {
      const queryResult = await queryFarmRecords({
        transcript: effectiveTranscript,
        userId,
        farmId,
        activity,
        locale,
        toolCalls,
      });

      assistantText = queryResult.answer ?? '';
      citations = queryResult.citations;
    }

    if (!assistantText) {
      const [memoryContext, ragContext] = await Promise.all([
        searchMemoryContext({
          query: effectiveTranscript,
          userId,
          farmId,
          enabled: body?.client_capabilities?.memory_enabled !== false,
          embeddingTokenCounter,
          toolCalls,
        }),
        searchRagContext({
          query: effectiveTranscript,
          locale,
          enabled: body?.client_capabilities?.rag_enabled !== false,
          embeddingTokenCounter,
          toolCalls,
        }),
      ]);

      citations = [...citations, ...memoryContext.citations, ...ragContext.citations];
      const strictGuardrailsPreflight = isSprayOrFertigationTopic(effectiveTranscript);
      if (strictGuardrailsPreflight && citations.length === 0) {
        console.warn('Blocking spray/fertigation query with no citations');
        assistantText = buildBlockedAdviceMessage(locale, true);
        preflightSafetyFlags = {
          blocked: true,
          risk_level: 'critical',
          reasons: ['Spray/fertigation advice requires verified sources'],
          escalation_suggested: true,
        };
      } else {
        const farmContextBlock = body?.farm_context
          ? `Farm context: ${JSON.stringify(body.farm_context)}`
          : '';
        const contextHash = await computeContextHash(body?.farm_context ?? null);
        const cacheKey = getCacheKey(
          effectiveTranscript,
          locale,
          authenticatedUserId,
          farmId,
          contextHash,
        );
        const cached = responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          cacheHit = true;
          assistantText = cached.text;
        } else {
          const chatResult = await withAbortTimeout(
            (signal) =>
              callOpenAIChat(
                {
                  prompt: effectiveTranscript,
                  locale,
                  contextBlocks: [
                    farmContextBlock,
                    ...memoryContext.contextBlocks,
                    ...ragContext.contextBlocks,
                  ].filter(Boolean),
                },
                signal,
              ),
            LLM_TIMEOUT_MS,
            `Advisory generation timed out after ${LLM_TIMEOUT_MS}ms`,
          );
          assistantText = chatResult.text;
          llmInputTokens = chatResult.inputTokens;
          llmOutputTokens = chatResult.outputTokens;
          responseCache.set(cacheKey, { text: assistantText, timestamp: Date.now() });
        }
      }
    }

    if (routeStateDirty) {
      await writeConversationRouteState(conversationId, nextRouteState);
    }

    const strictGuardrailsRequired = isSprayOrFertigationTopic(
      `${effectiveTranscript}\n${assistantText}`,
    );
    let safetyFlags: SafetyFlags;
    if (preflightSafetyFlags) {
      safetyFlags = preflightSafetyFlags;
    } else {
      safetyFlags = buildSafetyFlags({
        adviceText: assistantText,
        transcript: effectiveTranscript,
        routeDecision,
        citationCount: citations.length,
      });
    }
    toolCalls.push({
      tool: 'safety.check_advice',
      status: 'ok',
      output: safetyFlags,
    });

    if (safetyFlags.blocked) {
      assistantText = buildBlockedAdviceMessage(locale, strictGuardrailsRequired);
    }

    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;
    let audioProviderUsed: string | null = null;
    let usedSarvamTts = false;

    if (body?.client_capabilities?.can_play_audio !== false) {
      try {
        if (USE_SARVAM_FOR_VOICE && checkCircuitBreaker('sarvam_tts')) {
          usedSarvamTts = true;
          const ttsStartedAt = Date.now();
          const tts = await withAbortTimeout(
            (signal) => callSarvamTts(assistantText, locale, signal),
            TTS_TIMEOUT_MS,
            `Sarvam TTS timed out after ${TTS_TIMEOUT_MS}ms`,
          );
          ttsGenerationMs = Date.now() - ttsStartedAt;
          audioBase64 = tts.base64;
          audioMimeType = tts.mimeType;
          audioProviderUsed = 'sarvam';
          recordProviderSuccess('sarvam_tts');
        } else {
          const ttsStartedAt = Date.now();
          const tts = await withAbortTimeout(
            (signal) => callOpenAITts(assistantText, signal),
            TTS_TIMEOUT_MS,
            `OpenAI TTS timed out after ${TTS_TIMEOUT_MS}ms`,
          );
          ttsGenerationMs = Date.now() - ttsStartedAt;
          audioBase64 = tts.base64;
          audioMimeType = tts.mimeType;
          audioProviderUsed = 'openai';
          if (USE_SARVAM_FOR_VOICE) {
            providerFallbackReason = providerFallbackReason ?? 'sarvam_tts_circuit_open';
          }
        }
      } catch (error) {
        if (usedSarvamTts) {
          recordProviderFailure('sarvam_tts');
        }
        if (!providerFallbackEnabled) {
          throw error instanceof Error ? error : new Error('Sarvam TTS failed');
        }
        try {
          const ttsStartedAt = Date.now();
          const tts = await withAbortTimeout(
            (signal) => callOpenAITts(assistantText, signal),
            TTS_TIMEOUT_MS,
            `OpenAI TTS fallback timed out after ${TTS_TIMEOUT_MS}ms`,
          );
          ttsGenerationMs = Date.now() - ttsStartedAt;
          audioBase64 = tts.base64;
          audioMimeType = tts.mimeType;
          audioProviderUsed = 'openai_fallback';
          providerFallbackReason = error instanceof Error ? error.message : 'sarvam_tts_failed';
        } catch (fallbackError) {
          console.warn('Both TTS providers failed', error, fallbackError);
          throw fallbackError instanceof Error
            ? fallbackError
            : new Error('Both Sarvam and OpenAI TTS failed');
        }
      }
      if (!audioBase64) {
        ttsSkippedReason = 'tts_returned_no_audio';
      }
    } else {
      ttsSkippedReason = 'client_can_play_audio_false';
    }

    const memoryWrites = await writeMemory({
      conversationId,
      userId,
      farmId,
      transcript: effectiveTranscript,
      answer: assistantText,
      enabled: body?.client_capabilities?.memory_enabled !== false,
      toolCalls,
    });

    const latency = Date.now() - start;
    const costBreakdown = calculateCost({
      sttProviderUsed,
      audioDurationSeconds: body?.audio_duration ?? (sttLatencyMs ? sttLatencyMs / 1000 : 0),
      inputTokens: llmInputTokens,
      outputTokens: llmOutputTokens,
      embeddingTokens: embeddingTokenCounter.value,
      ttsProviderUsed: audioProviderUsed,
      ttsCharCount: assistantText.length,
    });

    await trackTelemetry({
      event_name: 'provider_selected',
      user_id: userId,
      farm_id: farmId,
      trace_id: traceId,
      properties: {
        stt_provider: sttProviderUsed,
        tts_provider: audioProviderUsed,
        fallback_reason: providerFallbackReason ?? null,
        cache_hit: cacheHit,
      },
      timestamp: new Date().toISOString(),
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
      provider: audioProviderUsed ?? 'openai',
      model: ADVISORY_MODEL,
      citations,
      toolCalls,
      safetyFlags,
    });

    return jsonResponse({
      assistant_text: assistantText,
      assistant_audio_b64: audioBase64,
      assistant_audio_mime_type: audioMimeType,
      audio_provider_used: audioProviderUsed,
      stt_provider_used: sttProviderUsed,
      stt_confidence: sttConfidence,
      stt_latency_ms: sttLatencyMs,
      tts_generation_ms: ttsGenerationMs,
      tts_skipped_reason: ttsSkippedReason,
      cost_breakdown: costBreakdown,
      route_decision: routeDecision,
      voice_log_action: voiceLogAction,
      provider_fallback_reason: providerFallbackReason,
      model_used: ADVISORY_MODEL,
      tool_calls: toolCalls,
      tool_results: toolCalls.map((item) => ({
        tool: item.tool,
        status: item.status,
      })),
      memory_writes: memoryWrites,
      citations,
      safety_flags: safetyFlags,
      trace_id: traceId,
      latency_ms: latency,
      conversation_id: conversationId,
      turn_id: assistantTurnId,
      suggestions: [],
    });
  } catch (error) {
    console.error('ai-gateway error', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        trace_id: traceId,
      },
      500,
    );
  }
});
