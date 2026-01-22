/**
 * AI Chat Service for Vinesight
 * Uses OpenAI GPT-4o for farming assistance
 */

import OpenAI from 'openai';
import { ChatMessage, SendMessageResponse } from '../types/ai';

const SYSTEM_PROMPT = `You are Vinesight AI, an expert agricultural assistant specialized in grape farming and viticulture. You help farmers with:
- Disease identification and management
- Irrigation recommendations
- Fertilizer and nutrient management
- Pest control strategies
- Pruning and canopy management
- Weather-based farming advice
- Harvest timing and quality management
- Soil health and improvement

Provide clear, practical, and actionable advice. When suggesting treatments, always mention safety precautions and recommended dosages. Be concise but thorough. Use metrics appropriate for grape farming (acres, mm/day, kg/acre, etc.).`;

class AIService {
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    // TODO: Move all OpenAI interactions to a backend endpoint (BFF/serverless) that holds the secret.
    // Currently using client-side key for development - this should be removed in production.
    // The mobile client should authenticate to the backend while the backend enforces rate limiting,
    // input validation, and usage monitoring.
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || null;
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
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
  ): Promise<SendMessageResponse> {
    if (!this.openai) {
      throw new Error(
        'OpenAI API key not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment.',
      );
    }

    const contextInfo = farmContext
      ? `\n\nCurrent Farm Context:\n- Farm: ${farmContext.farmName || 'Not specified'}\n- Crop: ${farmContext.cropVariety || 'Grapes'}\n- Area: ${farmContext.area || 'Not specified'} acres\n- Region: ${farmContext.region || 'Not specified'}\n- Growth Stage: ${farmContext.growthStage || 'Not specified'}\n- Days Since Pruning: ${farmContext.daysSincePruning || 'Not specified'} days`
      : '';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT + contextInfo,
      },
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const assistantMessage =
        response.choices[0]?.message?.content ||
        'I apologize, but I encountered an issue generating a response. Please try again.';

      const suggestions = await this.generateFollowUpSuggestions(userMessage, conversationHistory);

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
        console.error('Error calling OpenAI API:', error);
      }
      throw new Error(
        `Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async generateFollowUpSuggestions(
    lastUserMessage: string,
    _conversationHistory: ChatMessage[],
  ): Promise<string[]> {
    if (!this.openai) return [];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Generate 3-4 brief follow-up questions or suggestions based on the conversation. Each should be a short phrase (max 8 words). Return as a JSON array of strings.',
      },
      {
        role: 'user',
        content: `User's last message: "${lastUserMessage}"\n\nGenerate relevant follow-up suggestions.`,
      },
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
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

  isConfigured(): boolean {
    return this.apiKey !== null;
  }
}

export const aiService = new AIService();
