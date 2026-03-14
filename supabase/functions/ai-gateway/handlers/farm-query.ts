/**
 * Farm Query Handler Module
 * Handles deterministic farm data queries with aggregation.
 */

import {
  queryFarmRecords,
  detectActivity,
  type Citation,
  type ToolCall,
} from '../context/index.ts';

export interface FarmQueryHandlerInput {
  transcript: string;
  userId: string | null;
  farmId: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}

export interface FarmQueryHandlerResult {
  assistantText: string;
  citations: Citation[];
  activity: 'irrigation' | 'spray' | 'fertigation' | 'expense' | null;
}

/**
 * Handle farm data query
 */
export async function handleFarmQuery(
  input: FarmQueryHandlerInput,
): Promise<FarmQueryHandlerResult> {
  const { transcript, userId, farmId, locale, toolCalls } = input;

  const activity = detectActivity(transcript);

  if (!activity) {
    return {
      assistantText:
        locale === 'hi'
          ? 'कृपया बताएं आप किस गतिविधि के बारे में जानना चाहते हैं।'
          : locale === 'mr'
            ? 'कृपया सांगा आप कोणत्या क्रियाकलापाबद्दल जाणून घेऊन इच्छिता.'
            : 'Please specify which activity you want to know about.',
      citations: [],
      activity: null,
    };
  }

  const result = await queryFarmRecords({
    transcript,
    userId,
    farmId,
    activity,
    locale,
    toolCalls,
  });

  return {
    assistantText: result.answer ?? '',
    citations: result.citations,
    activity,
  };
}
