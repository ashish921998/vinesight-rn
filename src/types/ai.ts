/**
 * AI Chat Types for Vinesight
 * Chat interface for farming AI assistant
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  farmId?: number;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageResponse {
  message: ChatMessage;
  suggestions?: string[];
}
