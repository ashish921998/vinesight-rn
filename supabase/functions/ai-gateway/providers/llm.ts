/**
 * LLM (Large Language Model) Provider Module
 * Handles chat completions and intent extraction via Sarvam.
 */

import {
  LLM_TIMEOUT_MS,
  stringifyUnknown,
  toOptionalNumber,
  toRecord,
  withAbortTimeout,
} from '../utils/index.ts';

const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')?.trim() ?? '';

// Model configuration
const ADVISORY_MODEL = Deno.env.get('ASSISTANT_SARVAM_CHAT_MODEL')?.trim() || 'sarvam-105b';
const EXTRACTION_MODEL =
  Deno.env.get('ASSISTANT_SARVAM_EXTRACTION_MODEL')?.trim() || ADVISORY_MODEL;

export interface ChatCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface ImageAttachment {
  dataUrl: string;
  mimeType: string;
  name: string;
}

/**
 * Call Sarvam chat completion API.
 * IMPORTANT: Farm/memory/RAG context blocks are placed in the system message,
 * NOT in the user message. This ensures the context is always available
 * to the model regardless of message length constraints.
 */
export async function chatCompletion(input: {
  prompt: string;
  locale: 'en' | 'hi' | 'mr';
  contextBlocks: string[];
  imageAttachments?: ImageAttachment[];
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured');
  }
  if (input.imageAttachments?.length) {
    throw new Error('Image attachments are not supported by the configured Sarvam chat model');
  }

  const languageInstruction =
    input.locale === 'hi'
      ? 'Respond in Hindi only.'
      : input.locale === 'mr'
        ? 'Respond in Marathi only.'
        : 'Respond in English only.';

  const safetyInstruction =
    'You are a vineyard assistant. Give concise, practical guidance. For spray/fertigation recommendations, use short headings for: Condition, Confidence, Dosage Range, Safety/PPE, Re-entry Interval, Uncertainty, and Escalation Trigger. If evidence is insufficient, ask clarifying questions instead of guessing dosage.';

  // Build system message with context blocks (farm, memory, RAG context)
  // This is the correct placement - context should be in system message, not user message
  const contextSection =
    input.contextBlocks.length > 0 ? `\n\nContext:\n${input.contextBlocks.join('\n\n')}` : '';

  const systemMessage = `${languageInstruction} ${safetyInstruction}${contextSection}`;

  const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ADVISORY_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      reasoning_effort: null,
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        { role: 'user', content: input.prompt },
      ],
    }),
    signal: input.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? 'Sarvam chat request failed';
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Sarvam returned an empty response');
  }

  const usage = toRecord(data?.usage);
  const inputTokens =
    toOptionalNumber(usage?.prompt_tokens) ?? toOptionalNumber(usage?.input_tokens) ?? 0;
  const outputTokens =
    toOptionalNumber(usage?.completion_tokens) ?? toOptionalNumber(usage?.output_tokens) ?? 0;

  return { text: content.trim(), inputTokens, outputTokens };
}

/**
 * Extract intent using Sarvam JSON mode.
 */
export async function extractIntent(input: {
  transcript: string;
  locale: 'en' | 'hi' | 'mr';
  farmNames: string[];
  contextFarmName?: string | null;
  signal?: AbortSignal;
}): Promise<string> {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured');
  }

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      max_tokens: 280,
      reasoning_effort: null,
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
    signal: input.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    console.warn('Intent extraction failed', stringifyUnknown(data));
    return '';
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return '';
  }

  return content.trim();
}

/**
 * Get configured advisory model
 */
export function getAdvisoryModel(): string {
  return ADVISORY_MODEL;
}

/**
 * Get configured extraction model
 */
export function getExtractionModel(): string {
  return EXTRACTION_MODEL;
}

/**
 * Run chat completion with timeout
 */
export async function chatCompletionWithTimeout(input: {
  prompt: string;
  locale: 'en' | 'hi' | 'mr';
  contextBlocks: string[];
  imageAttachments?: ImageAttachment[];
}): Promise<ChatCompletionResult> {
  return withAbortTimeout(
    (signal) => chatCompletion({ ...input, signal }),
    LLM_TIMEOUT_MS,
    `Advisory generation timed out after ${LLM_TIMEOUT_MS}ms`,
  );
}

/**
 * Run intent extraction with timeout
 */
export async function extractIntentWithTimeout(input: {
  transcript: string;
  locale: 'en' | 'hi' | 'mr';
  farmNames: string[];
  contextFarmName?: string | null;
}): Promise<string> {
  return withAbortTimeout(
    (signal) => extractIntent({ ...input, signal }),
    LLM_TIMEOUT_MS,
    `Intent extraction timed out after ${LLM_TIMEOUT_MS}ms`,
  );
}
