/**
 * useAssistant Hook
 * Manages state and logic for the AI chat screen:
 * - messages array
 * - conversationId
 * - isLoading
 * - inputText
 * - suggestions
 * - error
 * Sends messages via assistant-gateway service.
 */

import { useState, useCallback, useRef } from 'react';
import {
  sendAssistantTurn,
  cancelAllPendingAssistantTurnRequests,
  AssistantGatewayError,
} from '@/services/assistant-gateway';
import type { ChatMessage } from '@/types/ai';
import type { SupportedLanguageCode } from '@/i18n/languages';

export interface AssistantFarmContext {
  farmId?: number | null;
  farmName?: string;
  cropVariety?: string;
  area?: number;
  region?: string;
  growthStage?: string;
  daysSincePruning?: number;
}

export interface UseAssistantOptions {
  language: SupportedLanguageCode;
  farmContext?: AssistantFarmContext;
}

export interface UseAssistantReturn {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  inputText: string;
  suggestions: string[];
  error: AssistantGatewayError | Error | null;
  setInputText: (text: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  startNewConversation: () => void;
  retryLastMessage: () => Promise<void>;
}

const DEFAULT_SUGGESTIONS = [
  'ai.defaultSuggestions.waterNeed',
  'ai.defaultSuggestions.diseases',
  'ai.defaultSuggestions.fertilizer',
  'ai.defaultSuggestions.pruning',
] as const;

export function useAssistant(options: UseAssistantOptions): UseAssistantReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<AssistantGatewayError | Error | null>(null);

  const lastUserMessageRef = useRef<string>('');

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText || isLoading) return;

      lastUserMessageRef.current = messageText;
      setInputText('');
      setError(null);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
        conversationId: conversationId ?? undefined,
        inputMode: 'text',
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await sendAssistantTurn(
          {
            conversationId,
            userMessage: messageText,
            language: options.language,
            inputMode: 'text',
            farmContext: options.farmContext,
            clientPersistedUserTurn: true,
          },
          {
            requestId: `chat-${Date.now()}`,
          },
        );

        const newConversationId =
          response.message.conversationId ?? response.message.conversationId;
        if (newConversationId && !conversationId) {
          setConversationId(newConversationId);
        }

        setMessages((prev) => [...prev, response.message]);
        setSuggestions(response.suggestions ?? []);
      } catch (err) {
        const normalizedError =
          err instanceof AssistantGatewayError || err instanceof Error
            ? err
            : new Error(String(err));
        setError(normalizedError);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, isLoading, conversationId, options],
  );

  const retryLastMessage = useCallback(async () => {
    const lastMessage = lastUserMessageRef.current;
    if (!lastMessage) return;
    setError(null);
    await sendMessage(lastMessage);
  }, [sendMessage]);

  const startNewConversation = useCallback(() => {
    cancelAllPendingAssistantTurnRequests();
    setMessages([]);
    setConversationId(null);
    setIsLoading(false);
    setInputText('');
    setSuggestions([]);
    setError(null);
    lastUserMessageRef.current = '';
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    inputText,
    suggestions,
    error,
    setInputText,
    sendMessage,
    startNewConversation,
    retryLastMessage,
  };
}

export { DEFAULT_SUGGESTIONS };
