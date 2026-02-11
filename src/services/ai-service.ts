/**
 * AI Chat Service for Vinesight
 * Uses OpenAI GPT-4o for farming assistance
 */

import { AIMessageAttachmentInput, ChatMessage, SendMessageResponse } from '../types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';
import { GLOSSARY_MR } from '@/i18n/glossary.mr';
import { GLOSSARY_HI } from '@/i18n/glossary.hi';
import type {
  ActivityLogExtractionResult,
  VoiceLogActivityType,
  VoiceLogChemicalItem,
  VoiceLogFertilizerItem,
} from '@/types/voice-log';
import { supabase } from '@/lib/supabase';

const SYSTEM_PROMPT_EN = `You are Vinesight AI Assistant, an expert agricultural assistant specialized in grape farming and viticulture. You help farmers with:
- Disease identification and management
- Irrigation recommendations
- Fertilizer and nutrient management
- Pest control strategies
- Pruning and canopy management
- Weather-based farming advice
- Harvest timing and quality management
- Soil health and improvement

Provide clear, practical, and actionable advice. When suggesting treatments, always mention safety precautions and recommended dosages. Be concise but thorough. Use metrics appropriate for grape farming (acres, mm/day, kg/acre, etc.). If required information is missing or uncertain, explicitly say you do not know and ask one concise follow-up question.`;

function buildSystemPrompt(language: SupportedLanguageCode): string {
  if (language === 'mr') {
    const glossary = GLOSSARY_MR;
    const glossaryLines = Object.entries(glossary)
      .map(([k, v]) => `- ${k}: "${v}"`)
      .join('\n');

    return `You are Vinesight AI Assistant, an expert agricultural assistant specialized in grape farming and viticulture.

LANGUAGE MODE: Marathi (mr)

Hard constraints:
- Respond ONLY in Marathi.
- Keep sentences short: max 18 words per sentence.
- Do NOT use English verbs.
- Use bullet points for actions.
- Give direct, actionable steps. Do not add explanations unless the user asks.
- Always use Arabic numerals (0-9), not Devanagari numerals.

Glossary (MUST use these exact terms when applicable):
${glossaryLines}

Domain focus:
- Disease and pest management
- Irrigation recommendations
- Fertilizer and nutrient management
- Pruning and canopy management
- Weather-based farming advice
- Harvest timing
- Soil health

Safety:
- When suggesting treatments, include safety precautions and recommended dosage (with units).
- If required information is missing or uncertain, explicitly say you do not know and ask one concise follow-up question.`;
  }

  if (language === 'hi') {
    const glossary = GLOSSARY_HI;
    const glossaryLines = Object.entries(glossary)
      .map(([k, v]) => `- ${k}: "${v}"`)
      .join('\n');

    return `You are Vinesight AI Assistant, an expert agricultural assistant specialized in grape farming and viticulture.

LANGUAGE MODE: Hindi (hi)

Hard constraints:
- Respond ONLY in Hindi.
- Keep sentences short: max 18 words per sentence.
- Do NOT use English verbs.
- Use bullet points for actions.
- Give direct, actionable steps. Do not add explanations unless the user asks.
- Always use Arabic numerals (0-9), not Devanagari numerals.

Glossary (MUST use these exact terms when applicable):
${glossaryLines}

Domain focus:
- Disease and pest management
- Irrigation recommendations
- Fertilizer and nutrient management
- Pruning and canopy management
- Weather-based farming advice
- Harvest timing
- Soil health

Safety:
- When suggesting treatments, include safety precautions and recommended dosage (with units).
- If required information is missing or uncertain, explicitly say you do not know and ask one concise follow-up question.`;
  }

  return SYSTEM_PROMPT_EN;
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

function toVoiceLogActivityType(value: unknown): VoiceLogActivityType | null {
  if (
    value !== 'irrigation' &&
    value !== 'spray' &&
    value !== 'harvest' &&
    value !== 'expense' &&
    value !== 'fertigation'
  ) {
    return null;
  }
  return value;
}

function parseChemicalItems(value: unknown): VoiceLogChemicalItem[] {
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
    .filter((item): item is VoiceLogChemicalItem => Boolean(item));
}

function parseFertilizerItems(value: unknown): VoiceLogFertilizerItem[] {
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
    .filter((item): item is VoiceLogFertilizerItem => Boolean(item));
}

function parseExtractionResult(raw: string): ActivityLogExtractionResult | null {
  const obj = parseJsonObjectFromText(raw);
  if (!obj) return null;

  const intentRaw = toOptionalString(obj.intent);
  const intent: 'log_activity' | 'query_history' | 'advisory' | 'none' =
    intentRaw === 'log_activity' || intentRaw === 'query_history' || intentRaw === 'advisory'
      ? intentRaw
      : 'none';
  const activityType = toVoiceLogActivityType(obj.activity_type);

  const cancel = obj.cancel === true;
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
    cancel,
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAICompletionResponse {
  choices: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

async function callOpenAIProxy(params: {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}): Promise<OpenAICompletionResponse> {
  const { data, error } = await supabase.functions.invoke('openai-proxy', {
    body: params,
  });

  if (error) {
    throw new Error(`AI proxy request failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`AI proxy error: ${data.error.message ?? data.error}`);
  }

  return data as OpenAICompletionResponse;
}

class AIService {
  async sendMessage(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    farmContext?: {
      farmName?: string;
      cropVariety?: string;
      area?: number;
      region?: string;
      growthStage?: string;
      daysSincePruning?: number;
    },
    language: SupportedLanguageCode = 'en',
    attachments: AIMessageAttachmentInput[] = [],
  ): Promise<SendMessageResponse> {
    const contextInfo = farmContext
      ? `\n\nCurrent Farm Context:\n- Farm: ${farmContext.farmName || 'Not specified'}\n- Crop: ${farmContext.cropVariety || 'Grapes'}\n- Area: ${farmContext.area || 'Not specified'} acres\n- Region: ${farmContext.region || 'Not specified'}\n- Growth Stage: ${farmContext.growthStage || 'Not specified'}\n- Days Since Pruning: ${farmContext.daysSincePruning || 'Not specified'} days`
      : '';

    const userContentParts: OpenAIContentPart[] = [];
    const trimmedUserMessage = userMessage.trim();
    if (trimmedUserMessage) {
      userContentParts.push({ type: 'text', text: trimmedUserMessage });
    }

    if (attachments.length > 0) {
      const attachmentNames = attachments.map((attachment) => attachment.name).join(', ');
      userContentParts.push({ type: 'text', text: `Attached files: ${attachmentNames}` });
    }

    attachments.forEach((attachment) => {
      if (attachment.kind === 'image' && attachment.dataUrl) {
        userContentParts.push({ type: 'image_url', image_url: { url: attachment.dataUrl } });
        return;
      }
      if (attachment.kind === 'document' && attachment.textContent?.trim()) {
        userContentParts.push({
          type: 'text',
          text: `Document "${attachment.name}" content:\n${attachment.textContent.trim()}`,
        });
        return;
      }
      userContentParts.push({
        type: 'text',
        text: `File "${attachment.name}" was attached but its contents could not be read. Analyze based on available context only.`,
      });
    });

    const userContent: string | OpenAIContentPart[] =
      userContentParts.length > 0 ? userContentParts : userMessage;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: buildSystemPrompt(language) + contextInfo },
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userContent },
    ];

    try {
      const response = await callOpenAIProxy({
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000,
      });

      const assistantMessage =
        response.choices[0]?.message?.content ||
        'I apologize, but I encountered an issue generating a response. Please try again.';

      const suggestions = await this.generateFollowUpSuggestions(userMessage, language);

      return {
        message: {
          id: Date.now().toString(),
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date(),
        },
        suggestions,
      };
    } catch (error) {
      if (__DEV__) {
        console.error('Error calling AI proxy:', error);
      }
      throw new Error(
        `Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async generateFollowUpSuggestions(
    lastUserMessage: string,
    language: SupportedLanguageCode,
  ): Promise<string[]> {
    let systemContent: string;
    if (language === 'mr') {
      systemContent = `Respond ONLY in Marathi. Keep each suggestion short (max 6 words). Use Arabic numerals (0-9). Do NOT use English verbs. Use these terms when applicable: ${JSON.stringify(GLOSSARY_MR)}. Return as a JSON array of strings.`;
    } else if (language === 'hi') {
      systemContent = `Respond ONLY in Hindi. Keep each suggestion short (max 6 words). Use Arabic numerals (0-9). Do NOT use English verbs. Use these terms when applicable: ${JSON.stringify(GLOSSARY_HI)}. Return as a JSON array of strings.`;
    } else {
      systemContent =
        'You are a helpful assistant. Generate 3-4 brief follow-up questions or suggestions based on the conversation. Each should be a short phrase (max 8 words). Return as a JSON array of strings.';
    }

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: `User's last message: "${lastUserMessage}"\n\nGenerate relevant follow-up suggestions.`,
      },
    ];

    try {
      const response = await callOpenAIProxy({
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '[]';
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
    } catch {
      return [];
    }
  }

  async extractActivityLoggingIntent(input: {
    transcript: string;
    language: SupportedLanguageCode;
    farmNames: string[];
    contextFarmName?: string | null;
  }): Promise<ActivityLogExtractionResult | null> {
    const normalizedFarmNames = input.farmNames.filter((name) => name.trim().length > 0);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: `You extract farm activity logging intent and slots for a farming app.
Return only valid JSON with keys:
- intent: "log_activity" | "query_history" | "advisory" | "none"
- intent_confidence: number from 0 to 1
- activity_type: "irrigation" | "spray" | "harvest" | "expense" | "fertigation" | null
- cancel: boolean
- farm_name: string | null
- date_relative: "today" | "yesterday" | null
- date_iso: "YYYY-MM-DD" | null
- irrigation: { duration_hours: number | null }
- spray: { water_volume: number | null, chemicals: [{ name: string, quantity: number | null, unit: string | null }] }
- harvest: { quantity: number | null, grade: string | null, price: number | null, buyer: string | null }
- expense: { cost: number | null, expense_type: string | null, remarks: string | null }
- fertigation: { water_volume: number | null, fertilizers: [{ name: string, quantity: number | null, unit: string | null }] }
- confidence: number from 0 to 1

Rules:
- Detect one dominant intent:
  - log_activity: user wants to create/save/add a new record
  - query_history: user asks about past logged records/totals/history
  - advisory: user asks for recommendations or guidance
  - none: unrelated or unclear
- Use intent_confidence for intent certainty.
- If user wants to cancel/stop this logging flow, set cancel=true.
- If intent is not log_activity, set activity_type=null.
- For irrigation duration in minutes, convert to fractional hours.
- For spray and fertigation, extract list items from user text if present.
- Keep unknown fields null or empty arrays.
- If user says "kal"/"कल", infer date_relative from context (often "yesterday" for past logs, "none" if ambiguous).
- Use date_relative for relative expressions.
- Use date_iso only when the user clearly gives a concrete date.
- Prefer exact farm name text when possible.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          transcript: input.transcript,
          language: input.language,
          today_iso: todayIso,
          context_farm_name: input.contextFarmName ?? null,
          known_farm_names: normalizedFarmNames,
        }),
      },
    ];

    try {
      const response = await callOpenAIProxy({
        messages,
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      return parseExtractionResult(content);
    } catch (error) {
      if (__DEV__) {
        console.warn('Activity logging extraction failed:', error);
      }
      return null;
    }
  }
}

export const aiService = new AIService();
