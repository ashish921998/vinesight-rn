/**
 * Cost Tracking Utilities
 * Calculates API costs for STT, TTS, LLM, and embeddings.
 */

function envNumber(name: string, fallback: number): number {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Prices verified 2026-02-26 (OpenAI pricing page); override via env vars when needed.
export const PRICING = {
  sarvam: {
    stt_per_second: envNumber('ASSISTANT_PRICE_SARVAM_STT_PER_SECOND', 0.00013),
    tts_per_char: envNumber('ASSISTANT_PRICE_SARVAM_TTS_PER_CHAR', 0.00000001),
  },
  openai: {
    stt_per_second: envNumber('ASSISTANT_PRICE_OPENAI_STT_PER_SECOND', 0.0001),
    tts_per_char: envNumber('ASSISTANT_PRICE_OPENAI_TTS_PER_CHAR', 0.000015),
    gpt_4o_mini_input_per_1k: envNumber('ASSISTANT_PRICE_GPT4O_MINI_INPUT_PER_1K', 0.00015),
    gpt_4o_mini_output_per_1k: envNumber('ASSISTANT_PRICE_GPT4O_MINI_OUTPUT_PER_1K', 0.0006),
    embedding_3_small_per_1k: envNumber('ASSISTANT_PRICE_EMBEDDING_3_SMALL_PER_1K', 0.00002),
  },
};

export interface CostBreakdown {
  stt_cost_usd: number;
  llm_input_cost_usd: number;
  llm_output_cost_usd: number;
  tts_cost_usd: number;
  embedding_cost_usd: number;
  total_cost_usd: number;
}

/**
 * Round to 6 decimal places for USD amounts
 */
export function roundUsd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Calculate total cost breakdown for an AI gateway request
 */
export function calculateCost(input: {
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

/**
 * Estimate token count from text (approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
}
