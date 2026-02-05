/**
 * AI Chat Service for Vinesight
 * Uses backend (Supabase Edge Function) for OpenAI access
 */

import { supabase } from '@/lib/supabase';
import type { ChatMessage, SendMessageResponse } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';
import { extractErrorReason } from '@/utils/subscription-errors';

class AIService {
  isConfigured(): boolean {
    return true;
  }

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
  ): Promise<SendMessageResponse> {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message: userMessage,
        history: conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        farmContext,
        language,
      },
    });

    if (error) {
      let reason = extractErrorReason(error);

      if (
        !reason &&
        typeof error === 'object' &&
        error &&
        'context' in error &&
        error.context instanceof Response
      ) {
        try {
          const payload = await error.context.clone().json();
          if (payload?.reason && typeof payload.reason === 'string') {
            reason = extractErrorReason(payload.reason);
          }
        } catch {
          // Ignore parsing errors for function error payloads.
        }
      }

      if (reason === 'ai_disabled') {
        throw new Error('ai_disabled');
      }
      if (reason === 'ai_rate_limited') {
        throw new Error('ai_rate_limited');
      }
      throw new Error(error.message || 'Failed to get AI response');
    }

    if (!data || !data.message) {
      throw new Error('No response from AI');
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: data.message,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    };

    return {
      message,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    };
  }
}

export const aiService = new AIService();
