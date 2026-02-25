import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types/ai';
import { assistantFeatureFlags } from '@/constants/assistant-flags';
import { ASSISTANT_MEMORY_RETENTION_DAYS } from '@/constants/assistant-memory';
import { getUserId } from '@/lib/auth-utils';

interface ConversationRow {
  id: string;
  farm_id?: number | null;
  locale?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TurnRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: unknown;
  created_at?: string | null;
}

export interface AssistantUserDataExport {
  conversations: Array<Record<string, unknown>>;
  turns: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
}

export interface AssistantConversationSummary {
  id: string;
  farmId?: number | null;
  locale?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

function parseDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

class AssistantMemoryService {
  async listConversations(input?: {
    farmId?: number | null;
    limit?: number;
  }): Promise<AssistantConversationSummary[]> {
    if (!assistantFeatureFlags.memoryEnabled) return [];

    try {
      const userId = await getUserId();
      if (!userId) return [];

      const limit = Math.max(1, Math.min(input?.limit ?? 25, 100));
      let conversationQuery = supabase
        .from('assistant_conversations')
        .select('id, farm_id, locale, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (input?.farmId !== undefined && input.farmId !== null) {
        conversationQuery = conversationQuery.eq('farm_id', input.farmId);
      }

      const { data: conversations, error: conversationsError } = await conversationQuery;
      if (conversationsError) {
        if (__DEV__)
          console.warn('Assistant conversations list failed:', conversationsError.message);
        return [];
      }

      const conversationRows = (conversations ?? []) as ConversationRow[];
      if (conversationRows.length === 0) return [];

      const conversationIds = conversationRows.map((row) => row.id);
      const { data: turns, error: turnsError } = await supabase
        .from('assistant_turns')
        .select('conversation_id, content, created_at')
        .in('conversation_id', conversationIds)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: false });

      if (turnsError && __DEV__) {
        console.warn('Assistant conversations last turn lookup failed:', turnsError.message);
      }

      const lastTurnByConversation = new Map<
        string,
        { content: string | null; createdAt: Date | null }
      >();

      (
        (turns ?? []) as Array<{ conversation_id?: string; content?: string; created_at?: string }>
      ).forEach((row) => {
        const conversationId = row.conversation_id;
        if (!conversationId || lastTurnByConversation.has(conversationId)) return;
        lastTurnByConversation.set(conversationId, {
          content: typeof row.content === 'string' ? row.content : null,
          createdAt: parseDate(row.created_at),
        });
      });

      return conversationRows
        .map((row) => {
          const lastTurn = lastTurnByConversation.get(row.id);
          return {
            id: row.id,
            farmId: row.farm_id ?? null,
            locale: row.locale ?? null,
            createdAt: parseDate(row.created_at),
            updatedAt: parseDate(row.updated_at ?? row.created_at),
            lastMessage: lastTurn?.content ?? null,
            lastMessageAt: lastTurn?.createdAt ?? null,
          };
        })
        .sort((a, b) => {
          const aTime = (a.lastMessageAt ?? a.updatedAt).getTime();
          const bTime = (b.lastMessageAt ?? b.updatedAt).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      if (__DEV__) console.warn('Assistant conversations list failed:', error);
      return [];
    }
  }

  async createConversation(input: {
    farmId?: number | null;
    locale?: string | null;
  }): Promise<string | null> {
    if (!assistantFeatureFlags.memoryEnabled) return null;

    try {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('assistant_conversations')
        .insert({
          user_id: userId,
          farm_id: input.farmId ?? null,
          locale: input.locale ?? 'en',
        })
        .select('id')
        .single();

      if (error) {
        if (__DEV__) console.warn('Assistant conversation create failed:', error.message);
        return null;
      }

      return data?.id ?? null;
    } catch (error) {
      if (__DEV__) console.warn('Assistant conversation create failed:', error);
      return null;
    }
  }

  async loadRecentMessages(conversationId: string, limit = 20): Promise<ChatMessage[]> {
    if (!assistantFeatureFlags.memoryEnabled) return [];
    if (!conversationId) return [];

    try {
      const { data, error } = await supabase
        .from('assistant_turns')
        .select('id, conversation_id, role, content, citations, created_at')
        .eq('conversation_id', conversationId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (__DEV__) console.warn('Assistant message load failed:', error.message);
        return [];
      }

      const messages = ((data ?? []) as TurnRow[]).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: parseDate(row.created_at),
        conversationId: row.conversation_id,
        citations: Array.isArray(row.citations) ? row.citations : undefined,
      }));
      return messages.reverse();
    } catch (error) {
      if (__DEV__) console.warn('Assistant message load failed:', error);
      return [];
    }
  }

  async persistTurn(input: {
    conversationId: string;
    farmId?: number | null;
    role: 'user' | 'assistant';
    content: string;
    inputMode?: 'text' | 'audio';
    traceId?: string | null;
    latencyMs?: number | null;
    citations?: unknown[];
    safety?: unknown | null;
    provider?: string | null;
    model?: string | null;
  }): Promise<boolean> {
    if (!assistantFeatureFlags.memoryEnabled) return false;
    if (!input.conversationId || !input.content.trim()) return false;

    try {
      const userId = await getUserId();
      if (!userId) return false;

      const { error } = await supabase.from('assistant_turns').insert({
        conversation_id: input.conversationId,
        user_id: userId,
        farm_id: input.farmId ?? null,
        role: input.role,
        content: input.content,
        input_mode: input.inputMode ?? 'text',
        trace_id: input.traceId ?? null,
        latency_ms: input.latencyMs ?? null,
        citations: input.citations ?? null,
        safety_flags: input.safety ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
      });

      if (error) {
        if (__DEV__) {
          console.warn('Assistant turn persist failed:', error.message);
        }
        return false;
      }

      return true;
    } catch (error) {
      if (__DEV__) console.warn('Assistant turn persist failed:', error);
      return false;
    }
  }

  async writeMemoryFact(input: {
    conversationId: string;
    farmId?: number | null;
    memoryType: 'preference' | 'farm_fact' | 'task_pattern' | 'summary';
    content: string;
    metadata?: Record<string, unknown>;
    importance?: number;
  }): Promise<void> {
    if (!assistantFeatureFlags.memoryEnabled) return;
    if (!input.content.trim()) return;

    try {
      const userId = await getUserId();
      if (!userId) return;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ASSISTANT_MEMORY_RETENTION_DAYS);

      const { error } = await supabase.from('assistant_memories').insert({
        conversation_id: input.conversationId,
        user_id: userId,
        farm_id: input.farmId ?? null,
        memory_type: input.memoryType,
        content: input.content,
        metadata: input.metadata ?? {},
        importance: input.importance ?? 0.5,
        expires_at: expiresAt.toISOString(),
      });

      if (error && __DEV__) {
        console.warn('Assistant memory write failed:', error.message);
      }
    } catch (error) {
      if (__DEV__) console.warn('Assistant memory write failed:', error);
    }
  }

  async resolveLatestConversation(input: {
    farmId?: number | null;
    locale?: string | null;
  }): Promise<string | null> {
    if (!assistantFeatureFlags.memoryEnabled) return null;

    try {
      const userId = await getUserId();
      if (!userId) return null;

      let query = supabase
        .from('assistant_conversations')
        .select('id, farm_id, locale, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (input.farmId !== undefined && input.farmId !== null) {
        query = query.eq('farm_id', input.farmId);
      }

      const { data, error } = await query;

      if (error) {
        if (__DEV__) console.warn('Assistant conversation resolve failed:', error.message);
        return null;
      }

      const latest = (data as ConversationRow[] | null)?.[0];
      if (latest?.id) return latest.id;

      return this.createConversation(input);
    } catch (error) {
      if (__DEV__) console.warn('Assistant conversation resolve failed:', error);
      return null;
    }
  }

  async exportUserData(): Promise<AssistantUserDataExport | null> {
    if (!assistantFeatureFlags.memoryEnabled) return null;

    try {
      const { data, error } = await supabase.rpc('assistant_export_user_data');
      if (error) {
        if (__DEV__) console.warn('Assistant data export failed:', error.message);
        return null;
      }

      const payload = data as Record<string, unknown> | null;
      if (!payload || typeof payload !== 'object') return null;

      return {
        conversations: Array.isArray(payload.conversations)
          ? (payload.conversations as Array<Record<string, unknown>>)
          : [],
        turns: Array.isArray(payload.turns)
          ? (payload.turns as Array<Record<string, unknown>>)
          : [],
        memories: Array.isArray(payload.memories)
          ? (payload.memories as Array<Record<string, unknown>>)
          : [],
      };
    } catch (error) {
      if (__DEV__) console.warn('Assistant data export failed:', error);
      return null;
    }
  }

  async deleteUserData(): Promise<boolean> {
    if (!assistantFeatureFlags.memoryEnabled) return false;

    try {
      const { error } = await supabase.rpc('assistant_delete_user_data');
      if (error) {
        if (__DEV__) console.warn('Assistant data delete failed:', error.message);
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) console.warn('Assistant data delete failed:', error);
      return false;
    }
  }
}

export const assistantMemoryService = new AssistantMemoryService();
