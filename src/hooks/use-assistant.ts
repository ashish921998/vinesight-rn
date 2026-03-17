/**
 * useAssistant Hook
 * Manages state and logic for the AI chat screen:
 * - messages array
 * - conversationId
 * - isLoading
 * - inputText
 * - suggestions
 * - error
 * - voiceLogAction (from backend response)
 * - attachments (image attachments to send)
 * Sends messages via assistant-gateway service.
 */

import { useState, useCallback, useRef } from 'react';
import {
  sendAssistantTurn,
  cancelPendingAssistantTurnRequest,
  AssistantGatewayError,
  AssistantGatewayErrorCode,
} from '@/services/assistant-gateway';
import { assistantMemoryService } from '@/services/assistant-memory';
import type { AIMessageAttachmentInput, AssistantVoiceLogAction, ChatMessage } from '@/types/ai';
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
  voiceLogAction: AssistantVoiceLogAction | null;
  attachments: AIMessageAttachmentInput[];
  setInputText: (text: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  startNewConversation: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearError: () => void;
  dismissVoiceLogAction: () => void;
  addAttachment: (attachment: AIMessageAttachmentInput) => void;
  removeAttachment: (index: number) => void;
  /** Add a message directly (used by voice mode to persist voice turns to main chat) */
  addMessage: (message: ChatMessage) => void;
  /** Sync conversation ID from voice mode when it creates a new conversation */
  syncConversationId: (id: string) => void;
  /** Set voice log action (used by voice mode to propagate activity log actions) */
  setVoiceLogAction: (action: AssistantVoiceLogAction | null) => void;
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
  const [voiceLogAction, setVoiceLogAction] = useState<AssistantVoiceLogAction | null>(null);
  const [attachments, setAttachments] = useState<AIMessageAttachmentInput[]>([]);

  const lastUserMessageRef = useRef<string>('');
  const lastAttachmentsRef = useRef<AIMessageAttachmentInput[]>([]);
  // Tracks the ID of the currently in-flight sendMessage request.
  // Used to cancel superseded requests when a new message is sent mid-flight.
  const currentRequestIdRef = useRef<string | null>(null);
  const loadConversationRequestRef = useRef(0);

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? inputText).trim();
      if (!messageText) return;

      // Generate a unique ID for this request
      const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

      // Cancel any existing in-flight request (VAL-CROSS-011: request cancellation)
      if (currentRequestIdRef.current) {
        cancelPendingAssistantTurnRequest(currentRequestIdRef.current);
      }
      // Register this request as the current one
      currentRequestIdRef.current = requestId;

      lastUserMessageRef.current = messageText;
      setInputText('');
      setError(null);

      // Capture attachments snapshot and clear them for next message
      const pendingAttachments = attachments.slice();
      // Store for potential retry
      lastAttachmentsRef.current = pendingAttachments;
      setAttachments([]);

      const userMessage: ChatMessage = {
        id: `user-${requestId}`,
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
            attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
            clientPersistedUserTurn: false,
          },
          { requestId },
        );

        // If superseded by a newer request, discard this response
        if (currentRequestIdRef.current !== requestId) return;
        currentRequestIdRef.current = null;

        const newConversationId = response.message.conversationId;
        if (newConversationId && newConversationId !== conversationId) {
          setConversationId(newConversationId);
        }

        setMessages((prev) => [...prev, response.message]);
        setSuggestions(response.suggestions ?? []);

        // Extract voiceLogAction if present and ready
        if (response.voiceLogAction != null) {
          setVoiceLogAction(response.voiceLogAction);
        }
      } catch (err) {
        // If superseded by a newer request, silently ignore this error
        if (currentRequestIdRef.current !== requestId) return;
        currentRequestIdRef.current = null;

        // Silently ignore cancellation errors (triggered by a newer message)
        if (
          err instanceof AssistantGatewayError &&
          err.code === AssistantGatewayErrorCode.CANCELED
        ) {
          return;
        }

        const normalizedError =
          err instanceof AssistantGatewayError || err instanceof Error
            ? err
            : new Error(String(err));
        setError(normalizedError);
      } finally {
        // Only clear loading state when no newer request is in flight
        if (currentRequestIdRef.current === null) {
          setIsLoading(false);
        }
      }
    },
    [inputText, conversationId, options, attachments],
  );

  const retryLastMessage = useCallback(async () => {
    const lastMessage = lastUserMessageRef.current;
    const lastAttachments = lastAttachmentsRef.current;
    if (!lastMessage || isLoading) return;

    const requestId = `chat-retry-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    if (currentRequestIdRef.current) {
      cancelPendingAssistantTurnRequest(currentRequestIdRef.current);
    }
    currentRequestIdRef.current = requestId;

    setError(null);
    setIsLoading(true);

    try {
      const response = await sendAssistantTurn(
        {
          conversationId,
          userMessage: lastMessage,
          language: options.language,
          inputMode: 'text',
          farmContext: options.farmContext,
          attachments: lastAttachments.length > 0 ? lastAttachments : undefined,
          clientPersistedUserTurn: false,
        },
        { requestId },
      );

      if (currentRequestIdRef.current !== requestId) return;
      currentRequestIdRef.current = null;

      const newConversationId = response.message.conversationId;
      if (newConversationId && newConversationId !== conversationId) {
        setConversationId(newConversationId);
      }

      setMessages((prev) => [...prev, response.message]);
      setSuggestions(response.suggestions ?? []);

      if (response.voiceLogAction != null) {
        setVoiceLogAction(response.voiceLogAction);
      }
    } catch (err) {
      if (currentRequestIdRef.current !== requestId) return;
      currentRequestIdRef.current = null;

      if (err instanceof AssistantGatewayError && err.code === AssistantGatewayErrorCode.CANCELED) {
        return;
      }

      const normalizedError =
        err instanceof AssistantGatewayError || err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
    } finally {
      if (currentRequestIdRef.current === null) {
        setIsLoading(false);
      }
    }
  }, [isLoading, conversationId, options]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const dismissVoiceLogAction = useCallback(() => {
    setVoiceLogAction(null);
  }, []);

  const addAttachment = useCallback((attachment: AIMessageAttachmentInput) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startNewConversation = useCallback(() => {
    if (currentRequestIdRef.current) {
      cancelPendingAssistantTurnRequest(currentRequestIdRef.current);
    }
    currentRequestIdRef.current = null;
    loadConversationRequestRef.current += 1;
    setMessages([]);
    setConversationId(null);
    setIsLoading(false);
    setInputText('');
    setSuggestions([]);
    setError(null);
    setVoiceLogAction(null);
    setAttachments([]);
    lastUserMessageRef.current = '';
    lastAttachmentsRef.current = [];
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const syncConversationId = useCallback(
    (id: string) => {
      if (id && id !== conversationId) {
        setConversationId(id);
      }
    },
    [conversationId],
  );

  const loadConversation = useCallback(async (conversationId: string) => {
    const loadRequestId = loadConversationRequestRef.current + 1;
    loadConversationRequestRef.current = loadRequestId;
    setMessages([]);
    setConversationId(conversationId);
    setIsLoading(true);
    setInputText('');
    setSuggestions([]);
    setError(null);
    setVoiceLogAction(null);
    setAttachments([]);
    lastUserMessageRef.current = '';
    lastAttachmentsRef.current = [];

    try {
      const loaded = await assistantMemoryService.loadRecentMessages(conversationId);
      if (loadConversationRequestRef.current !== loadRequestId) return;
      setMessages(loaded);
    } catch (err) {
      if (loadConversationRequestRef.current !== loadRequestId) return;
      const normalizedError =
        err instanceof AssistantGatewayError || err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
    } finally {
      if (loadConversationRequestRef.current === loadRequestId) {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    inputText,
    suggestions,
    error,
    voiceLogAction,
    attachments,
    setInputText,
    sendMessage,
    startNewConversation,
    loadConversation,
    retryLastMessage,
    clearError,
    dismissVoiceLogAction,
    addAttachment,
    removeAttachment,
    addMessage,
    syncConversationId,
    setVoiceLogAction,
  };
}

export { DEFAULT_SUGGESTIONS };
