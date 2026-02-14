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

const ADVISORY_MODEL = Deno.env.get('ASSISTANT_OPENAI_MODEL')?.trim() || 'gpt-4o';
const EXTRACTION_MODEL = Deno.env.get('ASSISTANT_EXTRACTION_MODEL')?.trim() || 'gpt-4o-mini';
const EMBEDDING_MODEL =
  Deno.env.get('ASSISTANT_EMBEDDING_MODEL')?.trim() || 'text-embedding-3-small';

const USE_SARVAM_FOR_VOICE =
  (Deno.env.get('ASSISTANT_USE_SARVAM_VOICE') ?? 'true').toLowerCase() !== 'false';

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

function normalizeInputText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
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

async function extractActivityIntent(input: {
  transcript: string;
  locale: 'en' | 'hi' | 'mr';
  farmNames: string[];
  contextFarmName?: string | null;
}): Promise<ActivityLogExtractionResult | null> {
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

async function callOpenAIChat(input: {
  prompt: string;
  locale: 'en' | 'hi' | 'mr';
  contextBlocks: string[];
}): Promise<string> {
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

  return content.trim();
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
): Promise<{ transcript: string; confidence: number | null }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: base64Audio,
      mime_type: mimeType,
      model: 'saarika:v3',
      with_timestamps: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? 'Sarvam STT failed');
  }

  const transcript = data?.transcript ?? data?.text;
  if (typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Sarvam STT returned empty transcript');
  }

  const confidenceRaw = toOptionalNumber(
    data?.confidence ?? data?.avg_confidence ?? data?.metadata?.confidence,
  );
  const confidence =
    confidenceRaw !== null
      ? Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw))
      : null;

  return { transcript: transcript.trim(), confidence };
}

async function callOpenAIStt(
  base64Audio: string,
  mimeType: string,
): Promise<{ transcript: string; confidence: number | null }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const boundary = `----assistant-gateway-${crypto.randomUUID()}`;
  const filename = mimeType.includes('wav') ? 'audio.wav' : 'audio.mp3';
  const binary = Uint8Array.from(atob(base64Audio), (ch) => ch.charCodeAt(0));

  const bodyParts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  const pushText = (value: string) => bodyParts.push(encoder.encode(value));

  pushText(`--${boundary}\r\n`);
  pushText(`Content-Disposition: form-data; name="model"\r\n\r\n`);
  pushText(`whisper-1\r\n`);

  pushText(`--${boundary}\r\n`);
  pushText(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`);
  pushText(`Content-Type: ${mimeType}\r\n\r\n`);
  bodyParts.push(binary);
  pushText(`\r\n--${boundary}--\r\n`);

  const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of bodyParts) {
    merged.set(part, offset);
    offset += part.length;
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: merged,
  });

  const data = await response.json();
  if (!response.ok) {
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
): Promise<{ base64: string; mimeType: string }> {
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not configured');

  const languageCode = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      target_language_code: languageCode,
      speaker: locale === 'en' ? 'anushka' : 'meera',
      format: 'mp3',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? 'Sarvam TTS failed');
  }

  const audioBase64 = data?.audio ?? data?.audio_base64;
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    throw new Error('Sarvam TTS returned no audio data');
  }

  return { base64: audioBase64, mimeType: 'audio/mpeg' };
}

async function callOpenAITts(text: string): Promise<{ base64: string; mimeType: string }> {
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
  });

  if (!response.ok) {
    let message = 'OpenAI TTS failed';
    try {
      const data = await response.json();
      message = data?.error?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return {
    base64: btoa(binary),
    mimeType: 'audio/mpeg',
  };
}

async function resolveConversationId(
  inputConversationId: string | null,
  userId: string | null,
  farmId: number | null,
  locale: string,
): Promise<string | null> {
  if (!userId) return inputConversationId;
  if (inputConversationId) return inputConversationId;

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

  const table = tableByActivity[input.activity];
  const explicitDate = parseExplicitDate(input.transcript);

  let query = serviceSupabase
    .from(table)
    .select(
      'id, farm_id, date, duration, chemical, dose, fertilizers, water_volume, cost, type, farms!inner(user_id, name)',
    )
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

  const rows: FarmRecordRow[] = Array.isArray(data) ? (data as FarmRecordRow[]) : [];
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
      ? `Latest irrigation: ${latest?.duration ?? 0} hours on ${latestDate}.`
      : input.activity === 'spray'
        ? `Latest spray: ${latest?.chemical ?? 'Unknown'} (${latest?.dose ?? '-'}) on ${latestDate}.`
        : input.activity === 'expense'
          ? `Latest expense: ₹${Number(latest?.cost ?? 0).toFixed(2)} (${latest?.type ?? 'other'}) on ${latestDate}.`
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
    const locale = resolveLocale(body?.locale);
    const providerFallbackEnabled = body?.client_capabilities?.provider_fallback_enabled !== false;
    const clientPersistedUserTurn = body?.client_capabilities?.client_persisted_user_turn === true;

    let transcript = normalizeInputText(body?.input_text);
    const inputMode: 'text' | 'audio' = body?.input_mode === 'audio' ? 'audio' : 'text';
    let effectiveInputMode: 'text' | 'audio' = inputMode;

    const toolCalls: ToolCall[] = [];
    let sttProviderUsed: string | null = null;
    let sttConfidence: number | null = null;
    let sttLatencyMs: number | null = null;
    let ttsGenerationMs: number | null = null;
    let providerFallbackReason: string | null = null;

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
        try {
          if (USE_SARVAM_FOR_VOICE) {
            const sttStartedAt = Date.now();
            const sttResult = await callSarvamStt(audioBase64, audioMimeType);
            sttLatencyMs = Date.now() - sttStartedAt;
            transcript = sttResult.transcript;
            sttConfidence = sttResult.confidence;
            sttProviderUsed = 'sarvam';
            toolCalls.push({
              tool: 'farm_context.get',
              status: 'ok',
              output: {
                stt_provider: 'sarvam',
                stt_confidence: sttConfidence,
                stt_latency_ms: sttLatencyMs,
              },
            });
          } else {
            const sttStartedAt = Date.now();
            const sttResult = await callOpenAIStt(audioBase64, audioMimeType);
            sttLatencyMs = Date.now() - sttStartedAt;
            transcript = sttResult.transcript;
            sttConfidence = sttResult.confidence;
            sttProviderUsed = 'openai';
          }
        } catch (error) {
          if (!providerFallbackEnabled) {
            throw error;
          }

          const sttStartedAt = Date.now();
          const sttResult = await callOpenAIStt(audioBase64, audioMimeType);
          sttLatencyMs = Date.now() - sttStartedAt;
          transcript = sttResult.transcript;
          sttConfidence = sttResult.confidence;
          sttProviderUsed = 'openai_fallback';
          providerFallbackReason = error instanceof Error ? error.message : 'sarvam_stt_failed';
          toolCalls.push({
            tool: 'farm_context.get',
            status: 'ok',
            output: {
              stt_provider: 'openai_fallback',
              stt_confidence: sttConfidence,
              stt_latency_ms: sttLatencyMs,
            },
          });
        }
      }
    }

    if (!transcript) {
      return jsonResponse({ error: 'Input transcript is empty' }, 400);
    }

    const farmId = body?.farm_context?.farm_id ?? null;
    const userId = body?.user_id ?? null;
    const conversationId = await resolveConversationId(
      body?.conversation_id ?? null,
      userId,
      farmId,
      locale,
    );

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
        llmExtraction = await extractActivityIntent({
          transcript: effectiveTranscript,
          locale,
          farmNames: farmsForRouting.map((farmRow) => farmRow.name),
          contextFarmName: contextFarmForRouting?.name ?? body?.farm_context?.farm_name ?? null,
        });
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
          toolCalls,
        }),
        searchRagContext({
          query: effectiveTranscript,
          locale,
          enabled: body?.client_capabilities?.rag_enabled !== false,
          toolCalls,
        }),
      ]);

      citations = [...citations, ...memoryContext.citations, ...ragContext.citations];

      const farmContextBlock = body?.farm_context
        ? `Farm context: ${JSON.stringify(body.farm_context)}`
        : '';

      assistantText = await callOpenAIChat({
        prompt: effectiveTranscript,
        locale,
        contextBlocks: [
          farmContextBlock,
          ...memoryContext.contextBlocks,
          ...ragContext.contextBlocks,
        ].filter(Boolean),
      });
    }

    if (routeStateDirty) {
      await writeConversationRouteState(conversationId, nextRouteState);
    }

    const strictGuardrailsRequired = isSprayOrFertigationTopic(
      `${effectiveTranscript}\n${assistantText}`,
    );
    const safetyFlags = buildSafetyFlags({
      adviceText: assistantText,
      transcript: effectiveTranscript,
      routeDecision,
      citationCount: citations.length,
    });
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

    if (body?.client_capabilities?.can_play_audio !== false) {
      try {
        if (USE_SARVAM_FOR_VOICE) {
          const ttsStartedAt = Date.now();
          const tts = await callSarvamTts(assistantText, locale);
          ttsGenerationMs = Date.now() - ttsStartedAt;
          audioBase64 = tts.base64;
          audioMimeType = tts.mimeType;
          audioProviderUsed = 'sarvam';
        } else {
          const ttsStartedAt = Date.now();
          const tts = await callOpenAITts(assistantText);
          ttsGenerationMs = Date.now() - ttsStartedAt;
          audioBase64 = tts.base64;
          audioMimeType = tts.mimeType;
          audioProviderUsed = 'openai';
        }
      } catch (error) {
        if (providerFallbackEnabled) {
          try {
            const ttsStartedAt = Date.now();
            const tts = await callOpenAITts(assistantText);
            ttsGenerationMs = Date.now() - ttsStartedAt;
            audioBase64 = tts.base64;
            audioMimeType = tts.mimeType;
            audioProviderUsed = 'openai_fallback';
            providerFallbackReason = error instanceof Error ? error.message : 'sarvam_tts_failed';
          } catch (fallbackError) {
            console.warn('Both TTS providers failed', error, fallbackError);
          }
        }
      }
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
