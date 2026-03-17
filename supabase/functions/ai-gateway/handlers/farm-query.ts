/**
 * Farm Query Handler Module
 * Handles deterministic farm data queries with aggregation.
 */

import {
  queryFarmRecords,
  detectActivity,
  detectQueryType,
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
  const queryType = detectQueryType(transcript);

  const result = await queryFarmRecords({
    transcript,
    userId,
    farmId,
    activity,
    locale,
    toolCalls,
  });

  return {
    assistantText:
      result.answer ??
      (queryType === 'weather'
        ? locale === 'hi'
          ? 'मौसम संबंधी सवाल के लिए थोड़ा और संदर्भ दें।'
          : locale === 'mr'
            ? 'हवामानाच्या प्रश्नासाठी थोडा अधिक संदर्भ द्या.'
            : 'Please share a bit more context for the weather question.'
        : locale === 'hi'
          ? 'कृपया बताएं आप किस रिकॉर्ड के बारे में जानना चाहते हैं।'
          : locale === 'mr'
            ? 'कृपया सांगा तुम्हाला कोणत्या नोंदीबद्दल माहिती हवी आहे.'
            : 'Please specify which record you want to know about.'),
    citations: result.citations,
    activity,
  };
}
